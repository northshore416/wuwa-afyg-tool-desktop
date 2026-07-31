import asyncio
import json
import urllib.error
import urllib.request
from typing import TypedDict

from .config import settings


class TicketResponse(TypedDict):
    ticket: str
    expiresIn: int
    loginUrl: str


def _post_ticket(subject: str, uids: list[str], profile: dict[str, str]) -> TicketResponse:
    body = json.dumps(
        {"subject": subject, "uids": uids, "profile": profile},
        ensure_ascii=False,
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{settings.server_url}/api/ygkit/internal/tickets",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {settings.issuer_token}",
            "Content-Type": "application/json",
            "User-Agent": "YGKIT-gsuid/1",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"椰果服务返回 HTTP {error.code}: {detail}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"无法连接椰果服务：{error.reason}") from error


async def issue_ticket(
    subject: str,
    uids: list[str],
    profile: dict[str, str],
) -> TicketResponse:
    return await asyncio.to_thread(_post_ticket, subject, uids, profile)
