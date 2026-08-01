use parking_lot::Mutex;
use reqwest::Client;
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::error::Error;
use std::fs;
use std::path::PathBuf;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{App, AppHandle, Manager, State, Url, WebviewUrl, WebviewWindowBuilder};

const PROTOCOL_VERSION: i64 = 1;
const DEFAULT_SERVER_ORIGIN: &str = "https://ygkit.usotsuki-kaze.com";
const MAX_DOCUMENT_BYTES: usize = 8 * 1024 * 1024;

pub struct DesktopStore {
    connection: Mutex<Connection>,
    database_path: PathBuf,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopBootstrap {
    protocol_version: i64,
    app_version: &'static str,
    database_path: String,
    server_origin: &'static str,
    pending_sync_count: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalDocument {
    namespace: String,
    id: String,
    revision: i64,
    payload: Value,
    checksum: String,
    updated_at: i64,
    sync_status: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncQueueEntry {
    id: i64,
    namespace: String,
    document_id: String,
    operation: String,
    payload: Option<Value>,
    revision: i64,
    created_at: i64,
    attempt_count: i64,
    last_error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteHealth {
    online: bool,
    origin: String,
    service: Option<String>,
    protocol_version: Option<i64>,
    latency_ms: u128,
    checked_at: i64,
    detail: Option<String>,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn error_text(error: impl std::fmt::Display) -> String {
    error.to_string()
}

fn validate_key(label: &str, value: &str, max_len: usize) -> Result<(), String> {
    if value.is_empty() || value.len() > max_len {
        return Err(format!(
            "{label} must contain between 1 and {max_len} characters."
        ));
    }
    if !value
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || "-_.:".contains(character))
    {
        return Err(format!("{label} contains unsupported characters."));
    }
    Ok(())
}

fn checksum(payload_json: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(payload_json.as_bytes());
    hex::encode(hasher.finalize())
}

fn migrate(connection: &Connection) -> Result<(), rusqlite::Error> {
    connection.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        PRAGMA busy_timeout = 5000;

        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS documents (
            namespace TEXT NOT NULL,
            id TEXT NOT NULL,
            revision INTEGER NOT NULL,
            payload_json TEXT NOT NULL,
            checksum TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            sync_status TEXT NOT NULL CHECK(sync_status IN ('local', 'pending', 'synced', 'failed')),
            PRIMARY KEY(namespace, id)
        );

        CREATE TABLE IF NOT EXISTS sync_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            namespace TEXT NOT NULL,
            document_id TEXT NOT NULL,
            operation TEXT NOT NULL CHECK(operation IN ('upsert', 'delete')),
            payload_json TEXT,
            revision INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            attempt_count INTEGER NOT NULL DEFAULT 0,
            last_error TEXT,
            UNIQUE(namespace, document_id, operation)
        );

        CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at
            ON sync_queue(created_at, id);

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value_json TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );
        "#,
    )?;
    connection.execute(
        "INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?1, ?2)",
        params![PROTOCOL_VERSION, now_ms()],
    )?;
    Ok(())
}

pub fn initialize(app: &mut App) -> Result<(), Box<dyn Error>> {
    let data_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&data_dir)?;
    let database_path = data_dir.join("unified-client.db");
    let connection = Connection::open(&database_path)?;
    migrate(&connection)?;
    app.manage(DesktopStore {
        connection: Mutex::new(connection),
        database_path,
    });
    Ok(())
}

fn read_document(
    connection: &Connection,
    namespace: &str,
    id: &str,
) -> Result<Option<LocalDocument>, String> {
    let row = connection
        .query_row(
            r#"
            SELECT revision, payload_json, checksum, updated_at, sync_status
            FROM documents
            WHERE namespace = ?1 AND id = ?2
            "#,
            params![namespace, id],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, String>(4)?,
                ))
            },
        )
        .optional()
        .map_err(error_text)?;

    row.map(
        |(revision, payload_json, checksum, updated_at, sync_status)| {
            let payload = serde_json::from_str(&payload_json).map_err(error_text)?;
            Ok(LocalDocument {
                namespace: namespace.to_string(),
                id: id.to_string(),
                revision,
                payload,
                checksum,
                updated_at,
                sync_status,
            })
        },
    )
    .transpose()
}

#[tauri::command]
pub fn desktop_bootstrap(store: State<'_, DesktopStore>) -> Result<DesktopBootstrap, String> {
    let connection = store.connection.lock();
    let pending_sync_count = connection
        .query_row("SELECT COUNT(*) FROM sync_queue", [], |row| row.get(0))
        .map_err(error_text)?;
    Ok(DesktopBootstrap {
        protocol_version: PROTOCOL_VERSION,
        app_version: env!("CARGO_PKG_VERSION"),
        database_path: store.database_path.to_string_lossy().to_string(),
        server_origin: DEFAULT_SERVER_ORIGIN,
        pending_sync_count,
    })
}

#[tauri::command]
pub fn local_store_get(
    store: State<'_, DesktopStore>,
    namespace: String,
    id: String,
) -> Result<Option<LocalDocument>, String> {
    validate_key("namespace", &namespace, 64)?;
    validate_key("id", &id, 160)?;
    read_document(&store.connection.lock(), &namespace, &id)
}

#[tauri::command]
pub fn local_store_put(
    store: State<'_, DesktopStore>,
    namespace: String,
    id: String,
    payload: Value,
    revision: Option<i64>,
    syncable: Option<bool>,
) -> Result<LocalDocument, String> {
    validate_key("namespace", &namespace, 64)?;
    validate_key("id", &id, 160)?;
    let payload_json = serde_json::to_string(&payload).map_err(error_text)?;
    if payload_json.len() > MAX_DOCUMENT_BYTES {
        return Err(format!(
            "Document exceeds the {} MiB local storage limit.",
            MAX_DOCUMENT_BYTES / 1024 / 1024
        ));
    }
    let updated_at = now_ms();
    let revision = revision.unwrap_or(updated_at);
    let should_sync = syncable.unwrap_or(false);
    let sync_status = if should_sync { "pending" } else { "local" };
    let checksum = checksum(&payload_json);

    let mut connection = store.connection.lock();
    let transaction = connection.transaction().map_err(error_text)?;
    transaction
        .execute(
            r#"
            INSERT INTO documents(
                namespace, id, revision, payload_json, checksum, updated_at, sync_status
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            ON CONFLICT(namespace, id) DO UPDATE SET
                revision = excluded.revision,
                payload_json = excluded.payload_json,
                checksum = excluded.checksum,
                updated_at = excluded.updated_at,
                sync_status = excluded.sync_status
            "#,
            params![
                namespace,
                id,
                revision,
                payload_json,
                checksum,
                updated_at,
                sync_status
            ],
        )
        .map_err(error_text)?;

    if should_sync {
        transaction
            .execute(
                r#"
                INSERT INTO sync_queue(
                    namespace, document_id, operation, payload_json, revision, created_at
                ) VALUES (?1, ?2, 'upsert', ?3, ?4, ?5)
                ON CONFLICT(namespace, document_id, operation) DO UPDATE SET
                    payload_json = excluded.payload_json,
                    revision = excluded.revision,
                    created_at = excluded.created_at,
                    attempt_count = 0,
                    last_error = NULL
                "#,
                params![namespace, id, payload_json, revision, updated_at],
            )
            .map_err(error_text)?;
    }
    transaction.commit().map_err(error_text)?;
    drop(connection);
    read_document(&store.connection.lock(), &namespace, &id)?
        .ok_or_else(|| String::from("Document was not available after it was saved."))
}

#[tauri::command]
pub fn local_store_delete(
    store: State<'_, DesktopStore>,
    namespace: String,
    id: String,
    syncable: Option<bool>,
) -> Result<bool, String> {
    validate_key("namespace", &namespace, 64)?;
    validate_key("id", &id, 160)?;
    let revision = now_ms();
    let should_sync = syncable.unwrap_or(false);
    let mut connection = store.connection.lock();
    let transaction = connection.transaction().map_err(error_text)?;
    let deleted = transaction
        .execute(
            "DELETE FROM documents WHERE namespace = ?1 AND id = ?2",
            params![namespace, id],
        )
        .map_err(error_text)?
        > 0;
    if should_sync {
        transaction
            .execute(
                r#"
                INSERT INTO sync_queue(
                    namespace, document_id, operation, payload_json, revision, created_at
                ) VALUES (?1, ?2, 'delete', NULL, ?3, ?3)
                ON CONFLICT(namespace, document_id, operation) DO UPDATE SET
                    payload_json = NULL,
                    revision = excluded.revision,
                    created_at = excluded.created_at,
                    attempt_count = 0,
                    last_error = NULL
                "#,
                params![namespace, id, revision],
            )
            .map_err(error_text)?;
    }
    transaction.commit().map_err(error_text)?;
    Ok(deleted)
}

#[tauri::command]
pub fn sync_queue_list(
    store: State<'_, DesktopStore>,
    limit: Option<i64>,
) -> Result<Vec<SyncQueueEntry>, String> {
    let connection = store.connection.lock();
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, namespace, document_id, operation, payload_json, revision,
                   created_at, attempt_count, last_error
            FROM sync_queue
            ORDER BY created_at, id
            LIMIT ?1
            "#,
        )
        .map_err(error_text)?;
    let rows = statement
        .query_map(params![limit.unwrap_or(50).clamp(1, 200)], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, i64>(7)?,
                row.get::<_, Option<String>>(8)?,
            ))
        })
        .map_err(error_text)?;

    rows.map(|row| {
        let (
            id,
            namespace,
            document_id,
            operation,
            payload_json,
            revision,
            created_at,
            attempt_count,
            last_error,
        ) = row.map_err(error_text)?;
        let payload = payload_json
            .map(|json| serde_json::from_str(&json).map_err(error_text))
            .transpose()?;
        Ok(SyncQueueEntry {
            id,
            namespace,
            document_id,
            operation,
            payload,
            revision,
            created_at,
            attempt_count,
            last_error,
        })
    })
    .collect()
}

#[tauri::command]
pub fn sync_queue_ack(store: State<'_, DesktopStore>, queue_id: i64) -> Result<bool, String> {
    let mut connection = store.connection.lock();
    let transaction = connection.transaction().map_err(error_text)?;
    let target = transaction
        .query_row(
            "SELECT namespace, document_id FROM sync_queue WHERE id = ?1",
            params![queue_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()
        .map_err(error_text)?;
    let deleted = transaction
        .execute("DELETE FROM sync_queue WHERE id = ?1", params![queue_id])
        .map_err(error_text)?
        > 0;
    if let Some((namespace, document_id)) = target {
        transaction
            .execute(
                r#"
                UPDATE documents
                SET sync_status = 'synced'
                WHERE namespace = ?1
                  AND id = ?2
                  AND NOT EXISTS (
                    SELECT 1 FROM sync_queue
                    WHERE namespace = ?1 AND document_id = ?2
                  )
                "#,
                params![namespace, document_id],
            )
            .map_err(error_text)?;
    }
    transaction.commit().map_err(error_text)?;
    Ok(deleted)
}

#[tauri::command]
pub fn sync_queue_fail(
    store: State<'_, DesktopStore>,
    queue_id: i64,
    message: String,
) -> Result<bool, String> {
    let message: String = message.chars().take(1000).collect();
    let connection = store.connection.lock();
    let changed = connection
        .execute(
            r#"
            UPDATE sync_queue
            SET attempt_count = attempt_count + 1, last_error = ?2
            WHERE id = ?1
            "#,
            params![queue_id, message],
        )
        .map_err(error_text)?
        > 0;
    if changed {
        connection
            .execute(
                r#"
                UPDATE documents
                SET sync_status = 'failed'
                WHERE EXISTS (
                    SELECT 1 FROM sync_queue
                    WHERE sync_queue.id = ?1
                      AND sync_queue.namespace = documents.namespace
                      AND sync_queue.document_id = documents.id
                )
                "#,
                params![queue_id],
            )
            .map_err(error_text)?;
    }
    Ok(changed)
}

fn normalized_server_url(value: &str) -> Result<Url, String> {
    let mut url = Url::parse(value).map_err(error_text)?;
    if !url.username().is_empty() || url.password().is_some() {
        return Err(String::from("Server URL must not contain credentials."));
    }
    let host = url
        .host_str()
        .ok_or_else(|| String::from("Server URL has no host."))?
        .to_ascii_lowercase();
    let loopback = host == "localhost" || host == "127.0.0.1" || host == "::1";
    if url.scheme() != "https" && !(cfg!(debug_assertions) && loopback) {
        return Err(String::from(
            "The desktop client only accepts HTTPS servers.",
        ));
    }
    if !loopback && host != "usotsuki-kaze.com" && !host.ends_with(".usotsuki-kaze.com") {
        return Err(String::from(
            "The server host is not in the desktop allowlist.",
        ));
    }
    url.set_path("/");
    url.set_query(None);
    url.set_fragment(None);
    Ok(url)
}

#[tauri::command]
pub async fn remote_health(server_origin: String) -> Result<RemoteHealth, String> {
    let origin = normalized_server_url(&server_origin)?;
    let started = Instant::now();
    let checked_at = now_ms();
    let client = Client::builder()
        .timeout(Duration::from_secs(8))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(error_text)?;
    let mut last_detail = None;

    for path in ["/api/client/v1/capabilities", "/api/ygkit/health"] {
        let endpoint = origin.join(path).map_err(error_text)?;
        match client
            .get(endpoint)
            .header("accept", "application/json")
            .header("user-agent", "YGKit-Desktop/0.3")
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => {
                let body = response.json::<Value>().await.unwrap_or(Value::Null);
                return Ok(RemoteHealth {
                    online: true,
                    origin: origin.as_str().trim_end_matches('/').to_string(),
                    service: body
                        .get("service")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                    protocol_version: body.get("protocolVersion").and_then(Value::as_i64),
                    latency_ms: started.elapsed().as_millis(),
                    checked_at,
                    detail: None,
                });
            }
            Ok(response) => {
                last_detail = Some(format!("HTTP {} from {path}", response.status()));
            }
            Err(error) => {
                last_detail = Some(error.to_string());
            }
        }
    }

    Ok(RemoteHealth {
        online: false,
        origin: origin.as_str().trim_end_matches('/').to_string(),
        service: None,
        protocol_version: None,
        latency_ms: started.elapsed().as_millis(),
        checked_at,
        detail: last_detail,
    })
}

#[tauri::command]
pub async fn open_afyg_portal(app: AppHandle, server_origin: String) -> Result<(), String> {
    let origin = normalized_server_url(&server_origin)?;
    if let Some(window) = app.get_webview_window("afyg-portal") {
        let _ = window.unminimize();
        window.show().map_err(error_text)?;
        window.set_focus().map_err(error_text)?;
        return Ok(());
    }

    let window =
        WebviewWindowBuilder::new(&app, "afyg-portal", WebviewUrl::External(origin.clone()))
            .title("椰果拉表")
            .inner_size(1320.0, 860.0)
            .min_inner_size(1080.0, 680.0)
            .resizable(true)
            .center()
            .on_navigation(|target| normalized_server_url(target.as_str()).is_ok())
            .build()
            .map_err(error_text)?;
    window.show().map_err(error_text)?;
    window.set_focus().map_err(error_text)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_the_configured_service_hosts() {
        assert!(normalized_server_url(DEFAULT_SERVER_ORIGIN).is_ok());
        assert!(normalized_server_url("https://gsuid.usotsuki-kaze.com/path").is_ok());
    }

    #[test]
    fn rejects_untrusted_remote_hosts() {
        assert!(normalized_server_url("https://example.com").is_err());
        assert!(normalized_server_url("file:///tmp/test").is_err());
    }
    #[test]
    fn migrates_and_reopens_the_local_database() {
        let database_path = std::env::temp_dir().join(format!(
            "ygkit-unified-store-test-{}-{}.db",
            std::process::id(),
            now_ms()
        ));

        {
            let connection = Connection::open(&database_path).expect("open temporary database");
            migrate(&connection).expect("apply desktop database migrations");
            let version: i64 = connection
                .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| {
                    row.get(0)
                })
                .expect("read migration version");
            let journal_mode: String = connection
                .query_row("PRAGMA journal_mode", [], |row| row.get(0))
                .expect("read journal mode");
            assert_eq!(version, PROTOCOL_VERSION);
            assert_eq!(journal_mode.to_ascii_lowercase(), "wal");
        }

        {
            let connection = Connection::open(&database_path).expect("reopen temporary database");
            let table_count: i64 = connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('documents', 'sync_queue', 'settings')",
                    [],
                    |row| row.get(0),
                )
                .expect("read migrated tables");
            assert_eq!(table_count, 3);
        }

        let _ = std::fs::remove_file(&database_path);
        let _ = std::fs::remove_file(database_path.with_extension("db-wal"));
        let _ = std::fs::remove_file(database_path.with_extension("db-shm"));
    }
}
