import hmac
from typing import Annotated

from fastapi import Header, HTTPException
from gsuid_core.web_app import app

from .config import settings
from .xwuid_adapter import get_uid_characters


def _authorize(authorization: str | None) -> None:
    expected = f"Bearer {settings.reader_token}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="invalid reader token")


@app.get("/api/ygkit/v1/health")
async def ygkit_health(
    authorization: Annotated[str | None, Header()] = None,
):
    _authorize(authorization)
    return {
        "ok": True,
        "plugin": "YGKIT",
        "xwuidCommit": settings.xwuid_commit,
    }


@app.get("/api/ygkit/v1/uids/{uid}/characters")
async def ygkit_uid_characters(
    uid: str,
    authorization: Annotated[str | None, Header()] = None,
):
    _authorize(authorization)
    if not uid.isdigit() or len(uid) > 20:
        raise HTTPException(status_code=400, detail="invalid uid")
    try:
        return await get_uid_characters(uid)
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail="XWUID 尚未缓存该 UID 的角色详情，请先通过 QQ 查询角色面板",
        ) from error
