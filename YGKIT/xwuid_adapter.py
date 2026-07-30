import importlib
import re
import sys
from types import ModuleType
from typing import Any

from .config import settings

_VALUE_RE = re.compile(r"^\s*([-+]?\d+(?:\.\d+)?)\s*(%)?\s*$")
_FIXED_SECONDARY = {
    4: ("攻击", 150.0),
    3: ("攻击", 100.0),
    1: ("生命", 2280.0),
}

_XWUID_PREFIXES = (
    "XutheringWavesUID",
    "XutheringWavesUID.XutheringWavesUID",
    "gsuid_core.plugins.XutheringWavesUID",
    "gsuid_core.plugins.XutheringWavesUID.XutheringWavesUID",
    "plugins.XutheringWavesUID",
    "plugins.XutheringWavesUID.XutheringWavesUID",
)


def _import_xwuid(suffix: str) -> ModuleType:
    loaded_suffix = f"XutheringWavesUID.{suffix}"
    for name, module in tuple(sys.modules.items()):
        if module is not None and (name == loaded_suffix or name.endswith(f".{loaded_suffix}")):
            return module

    errors: list[str] = []
    for prefix in _XWUID_PREFIXES:
        module_name = f"{prefix}.{suffix}"
        try:
            return importlib.import_module(module_name)
        except ModuleNotFoundError as error:
            errors.append(f"{module_name}: {error}")

    tried = "\n".join(errors)
    raise ModuleNotFoundError(
        "无法定位 XutheringWavesUID 的 Python 包。"
        "请确认 YGKIT 与 XutheringWavesUID 同级并已重启 gsuid-core。\n"
        f"已尝试：\n{tried}"
    )


def get_waves_bind() -> Any:
    return getattr(_import_xwuid("utils.database.models"), "WavesBind")


def _read(value: Any, name: str, default: Any = None) -> Any:
    if isinstance(value, dict):
        return value.get(name, default)
    return getattr(value, name, default)


def _parse_stat(stat: Any) -> dict[str, Any] | None:
    name = str(_read(stat, "attributeName", "") or "").strip()
    raw_value = _read(stat, "attributeValue", "")
    if not name:
        return None
    match = _VALUE_RE.match(str(raw_value))
    if not match:
        return {"name": name, "value": raw_value, "unit": ""}
    return {
        "name": name,
        "value": float(match.group(1)),
        "unit": match.group(2) or "",
    }


def _is_fixed_secondary(stat: dict[str, Any], cost: int) -> bool:
    fixed = _FIXED_SECONDARY.get(cost)
    if not fixed:
        return False
    return stat["name"] == fixed[0] and abs(float(stat["value"]) - fixed[1]) < 0.001


def _echo_payload(echo: Any) -> dict[str, Any]:
    phantom = _read(echo, "phantomProp", {}) or {}
    cost = int(_read(phantom, "cost", _read(echo, "cost", 0)) or 0)
    main_props = [
        parsed
        for item in (_read(echo, "mainProps", []) or [])
        if (parsed := _parse_stat(item)) is not None
    ]
    primary = next(
        (item for item in main_props if not _is_fixed_secondary(item, cost)),
        main_props[0] if main_props else None,
    )
    substats = [
        parsed
        for item in (_read(echo, "subProps", []) or [])
        if (parsed := _parse_stat(item)) is not None
    ]
    return {
        "name": str(_read(phantom, "name", "") or ""),
        "cost": cost,
        "mainStat": primary,
        "substats": substats[:5],
    }


def _character_payload(detail: Any) -> dict[str, Any]:
    role = _read(detail, "role", {}) or {}
    phantom_data = _read(detail, "phantomData", {}) or {}
    return {
        "roleId": str(_read(role, "roleId", "") or ""),
        "character": str(_read(role, "roleName", "") or ""),
        "echoes": [
            _echo_payload(echo)
            for echo in (_read(phantom_data, "equipPhantomList", []) or [])
        ],
    }


async def get_uid_characters(uid: str) -> dict[str, Any]:
    get_all_role_detail_info = getattr(
        _import_xwuid("utils.char_info_utils"),
        "get_all_role_detail_info",
    )

    role_details = await get_all_role_detail_info(uid)
    characters = [
        _character_payload(detail)
        for detail in (role_details or {}).values()
    ]
    return {
        "uid": uid,
        "source": "XutheringWavesUID",
        "xwuidCommit": settings.xwuid_commit,
        "characters": characters,
    }
