import os
import re
from dataclasses import dataclass
from pathlib import Path

_ENV_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_LOADED_ENV = False


def _env_candidates() -> list[Path]:
    plugin_dir = Path(__file__).resolve().parent
    roots = (Path.cwd(), plugin_dir)
    candidates: list[Path] = []
    seen: set[Path] = set()

    for root in roots:
        for directory in (root, *list(root.parents)[:4]):
            for filename in (".env", ".env.prod", ".env.production"):
                path = directory / filename
                if path not in seen:
                    seen.add(path)
                    candidates.append(path)
    return candidates


def _load_env_files() -> None:
    global _LOADED_ENV
    if _LOADED_ENV:
        return
    _LOADED_ENV = True

    for path in _env_candidates():
        if not path.is_file():
            continue
        try:
            lines = path.read_text(encoding="utf-8-sig").splitlines()
        except OSError:
            continue

        for raw_line in lines:
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[7:].lstrip()
            if "=" not in line:
                continue

            name, value = line.split("=", 1)
            name = name.strip()
            if not name.startswith("YGKIT_") or not _ENV_NAME_RE.fullmatch(name):
                continue

            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                value = value[1:-1]
            os.environ.setdefault(name, value)


def _required(name: str) -> str:
    _load_env_files()
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"缺少环境变量 {name}")
    return value


@dataclass(frozen=True)
class YGKitSettings:
    server_url: str
    issuer_token: str
    reader_token: str
    xwuid_commit: str


class _LazySettings:
    @property
    def server_url(self) -> str:
        _load_env_files()
        return os.getenv("YGKIT_SERVER_URL", "https://ygkit.usotsuki-kaze.com").rstrip("/")

    @property
    def issuer_token(self) -> str:
        return _required("YGKIT_ISSUER_TOKEN")

    @property
    def reader_token(self) -> str:
        return _required("YGKIT_READER_TOKEN")

    @property
    def xwuid_commit(self) -> str:
        return "a118a1b7230b223be3d3368efdf340e3f7863b65"


settings = _LazySettings()
