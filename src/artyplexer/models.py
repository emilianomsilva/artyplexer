from dataclasses import dataclass, field, asdict
from typing import Optional, Dict, Any


DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


@dataclass
class ServiceConfig:
    id: str
    name: str
    url: str
    icon_type: str = "generic"  # 'whatsapp', 'telegram', 'discord', 'slack', 'generic'
    custom_color: Optional[str] = None  # Hex color, e.g. '#3b82f6'
    enabled: bool = True
    notifications_enabled: bool = True
    muted: bool = False
    user_agent: str = DEFAULT_USER_AGENT

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ServiceConfig":
        return cls(
            id=data["id"],
            name=data["name"],
            url=data["url"],
            icon_type=data.get("icon_type", "generic"),
            custom_color=data.get("custom_color"),
            enabled=data.get("enabled", True),
            notifications_enabled=data.get("notifications_enabled", True),
            muted=data.get("muted", False),
            user_agent=data.get("user_agent", DEFAULT_USER_AGENT),
        )


@dataclass
class AppSettings:
    minimize_to_tray: bool = True
    start_minimized: bool = False
    global_dnd: bool = False
    last_active_service_id: Optional[str] = None
    window_width: int = 1200
    window_height: int = 800

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AppSettings":
        return cls(
            minimize_to_tray=data.get("minimize_to_tray", True),
            start_minimized=data.get("start_minimized", False),
            global_dnd=data.get("global_dnd", False),
            last_active_service_id=data.get("last_active_service_id"),
            window_width=data.get("window_width", 1200),
            window_height=data.get("window_height", 800),
        )
