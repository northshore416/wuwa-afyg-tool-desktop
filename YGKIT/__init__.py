from gsuid_core.sv import SL, Plugins, SV
from gsuid_core.bot import Bot
from gsuid_core.models import Event

from .config import settings
from .ticket_client import issue_ticket
from .xwuid_adapter import get_waves_bind
from . import routes as _routes

if "YGKIT" not in SL.plugins:
    Plugins(name="YGKIT", force_prefix=["yg"], allow_empty_prefix=False)

login_sv = SV("YGKIT 登录", priority=5)


@login_sv.on_command(("登录", "绑定", "ticket", "令牌"))
async def ygkit_login(bot: Bot, ev: Event):
    if getattr(ev, "group_id", None):
        await bot.send("为了保护账号信息，请私聊机器人发送「yg登录」。")
        return

    try:
        WavesBind = get_waves_bind()
        uids = await WavesBind.get_uid_list_by_game(ev.user_id, ev.bot_id)
        uids = [str(uid) for uid in (uids or []) if uid]
        if not uids:
            await bot.send("还没有查询到鸣潮 UID，请先用 XWUID 完成 UID 绑定。")
            return

        subject = f"qq:{ev.bot_id}:{ev.user_id}"
        ticket = await issue_ticket(subject, uids)
        message = (
            "椰果工具箱登录凭证（一次性、短时有效）：\n"
            f"{ticket['ticket']}\n\n"
            f"打开 {ticket['loginUrl']} 后粘贴凭证即可登录。"
        )
        await bot.send(message)
    except Exception as error:
        await bot.send(f"YGKIT 暂时无法签发登录凭证：{error}")


__all__ = ["login_sv", "settings"]
