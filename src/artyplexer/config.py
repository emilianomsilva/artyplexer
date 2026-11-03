import json
import os
import sys
from pathlib import Path
from typing import List, Tuple
from PySide6.QtCore import QStandardPaths
from artyplexer.models import ServiceConfig, AppSettings


def get_base_path() -> Path:
    """Returns the base path, accounting for PyInstaller bundled executable."""
    if hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)
    # When running in dev from repo root or src
    current = Path(__file__).resolve().parent
    if (current.parent.parent / "resources").exists():
        return current.parent.parent
    return current


BASE_DIR = get_base_path()
RESOURCES_DIR = BASE_DIR / "resources"
ICONS_DIR = RESOURCES_DIR / "icons"


def get_config_dir() -> Path:
    base = QStandardPaths.writableLocation(QStandardPaths.StandardLocation.AppConfigLocation)
    p = Path(base) if base else Path(os.path.expanduser("~/.config"))
    if p.name.lower() != "artyplexer":
        p = p / "artyplexer"
    return p


def get_data_dir() -> Path:
    base = QStandardPaths.writableLocation(QStandardPaths.StandardLocation.AppDataLocation)
    p = Path(base) if base else Path(os.path.expanduser("~/.local/share"))
    if p.name.lower() != "artyplexer":
        p = p / "artyplexer"
    return p


CONFIG_DIR = get_config_dir()
DATA_DIR = get_data_dir()
PROFILES_DIR = DATA_DIR / "profiles"


class ConfigManager:
    def __init__(self):
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        PROFILES_DIR.mkdir(parents=True, exist_ok=True)
        self.config_file = CONFIG_DIR / "config.json"
        self.services: List[ServiceConfig] = []
        self.settings: AppSettings = AppSettings()
        self.load()

    def get_default_services(self) -> List[ServiceConfig]:
        return [
            ServiceConfig(
                id="wa_personal",
                name="WhatsApp (Personal)",
                url="https://web.whatsapp.com",
                icon_type="whatsapp",
                custom_color="#25D366",
            ),
            ServiceConfig(
                id="wa_work",
                name="WhatsApp (Work)",
                url="https://web.whatsapp.com",
                icon_type="whatsapp",
                custom_color="#3b82f6",
            ),
            ServiceConfig(
                id="telegram",
                name="Telegram",
                url="https://web.telegram.org/a/",
                icon_type="telegram",
                custom_color="#229ED9",
            ),
        ]

    def load(self):
        if not self.config_file.exists():
            self.services = self.get_default_services()
            self.settings = AppSettings()
            self.save()
            return

        try:
            with open(self.config_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            raw_services = data.get("services", [])
            if raw_services:
                self.services = [ServiceConfig.from_dict(s) for s in raw_services]
            else:
                self.services = self.get_default_services()

            self.settings = AppSettings.from_dict(data.get("settings", {}))
        except Exception as e:
            print(f"Error loading config, falling back to defaults: {e}", file=sys.stderr)
            self.services = self.get_default_services()
            self.settings = AppSettings()

    def save(self):
        try:
            data = {
                "services": [s.to_dict() for s in self.services],
                "settings": self.settings.to_dict(),
            }
            with open(self.config_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving config: {e}", file=sys.stderr)

    def add_service(self, service: ServiceConfig):
        self.services.append(service)
        self.save()

    def remove_service(self, service_id: str):
        self.services = [s for s in self.services if s.id != service_id]
        self.save()

    def update_service(self, updated_service: ServiceConfig):
        for i, s in enumerate(self.services):
            if s.id == updated_service.id:
                self.services[i] = updated_service
                break
        self.save()

    def get_service_profile_dir(self, service_id: str) -> Path:
        dir_path = PROFILES_DIR / service_id
        dir_path.mkdir(parents=True, exist_ok=True)
        return dir_path
