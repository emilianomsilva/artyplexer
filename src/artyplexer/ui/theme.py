import os
import shutil
import subprocess
from pathlib import Path

from PySide6.QtCore import QObject, QSettings, Qt, QTimer, Signal
from PySide6.QtGui import QColor, QPalette
from PySide6.QtWidgets import QApplication


THEMES = {
    "dark": {
        "window": "#111217",
        "panel": "#1e1f29",
        "surface": "#262938",
        "surface_hover": "#33384c",
        "active": "#2d3240",
        "text": "#e2e8f0",
        "muted": "#94a3b8",
        "border": "#333846",
        "accent": "#38bdf8",
        "selection": "#3b82f6",
        "selection_text": "#ffffff",
        "separator": "#2d3240",
    },
    "light": {
        "window": "#f5f6f8",
        "panel": "#ffffff",
        "surface": "#eef0f4",
        "surface_hover": "#e1e5ec",
        "active": "#e2e8f0",
        "text": "#1e293b",
        "muted": "#64748b",
        "border": "#cbd5e1",
        "accent": "#2563eb",
        "selection": "#2563eb",
        "selection_text": "#ffffff",
        "separator": "#d8dee8",
    },
}

PORTAL_SERVICE = "org.freedesktop.portal.Desktop"
PORTAL_PATH = "/org/freedesktop/portal/desktop"
PORTAL_INTERFACE = "org.freedesktop.portal.Settings"


def theme_colors(dark: bool) -> dict[str, str]:
    return THEMES["dark" if dark else "light"]


def _portal_color_scheme() -> bool | None:
    """Reads the desktop color scheme from the XDG desktop portal."""
    try:
        from PySide6.QtDBus import QDBus, QDBusConnection, QDBusMessage
    except ImportError:
        return None
    try:
        bus = QDBusConnection.sessionBus()
        if not bus.isConnected() or not bus.interface().isServiceRegistered(PORTAL_SERVICE).value():
            return None
        message = QDBusMessage.createMethodCall(
            PORTAL_SERVICE, PORTAL_PATH, PORTAL_INTERFACE, "Read"
        )
        message.setArguments(["org.freedesktop.appearance", "color-scheme"])
        reply = bus.call(message, QDBus.CallMode.Block, 250)
        if reply.type() != QDBusMessage.MessageType.ReplyMessage or not reply.arguments():
            return None
        value = reply.arguments()[0]
        while hasattr(value, "variant"):
            value = value.variant()
        if value == 1:
            return True
        if value == 2:
            return False
        return None
    except Exception:
        return None


def _gsettings_color_scheme() -> bool | None:
    """Reads the GNOME color scheme preference."""
    if not shutil.which("gsettings"):
        return None
    try:
        result = subprocess.run(
            ["gsettings", "get", "org.gnome.desktop.interface", "color-scheme"],
            capture_output=True,
            text=True,
            timeout=1.5,
        )
        value = result.stdout.strip().strip("'").lower()
        if value == "prefer-dark":
            return True
        if value == "prefer-light":
            return False
        if value in ("", "default"):
            result = subprocess.run(
                ["gsettings", "get", "org.gnome.desktop.interface", "gtk-theme"],
                capture_output=True,
                text=True,
                timeout=1.5,
            )
            theme = result.stdout.strip().strip("'").lower()
            if theme:
                return "dark" in theme
    except Exception:
        pass
    return None


def _kde_color_scheme() -> bool | None:
    """Reads the KDE color scheme from kdeglobals."""
    config = Path.home() / ".config" / "kdeglobals"
    if not config.exists():
        return None
    try:
        settings = QSettings(str(config), QSettings.Format.IniFormat)
        scheme = str(settings.value("General/ColorScheme", "")).lower()
        if scheme:
            return "dark" in scheme
    except Exception:
        pass
    return None


def _linux_system_scheme(app: QApplication) -> bool | None:
    scheme = app.styleHints().colorScheme()
    if scheme == Qt.ColorScheme.Dark:
        return True
    if scheme == Qt.ColorScheme.Light:
        return False

    gtk_theme = os.environ.get("GTK_THEME", "").lower()
    if gtk_theme:
        return "dark" in gtk_theme

    for probe in (_portal_color_scheme, _gsettings_color_scheme, _kde_color_scheme):
        result = probe()
        if result is not None:
            return result
    return None


class ThemeManager(QObject):
    changed = Signal(bool)

    def __init__(self, app: QApplication, mode: str = "system"):
        super().__init__(app)
        self.app = app
        self.mode = mode if mode in {"system", "light", "dark"} else "system"
        self._palette_dark = (
            app.palette().color(QPalette.ColorRole.Window).lightness() < 128
        )
        self._system_dark = self._detect_system_dark()
        self._style_hints = app.styleHints()
        self._style_hints.colorSchemeChanged.connect(self._on_system_scheme_changed)

        # On Linux the Qt platform plugin may not report the scheme (e.g. under xcb).
        # Poll the desktop portals at a low frequency as a fallback.
        self._poll_timer = QTimer(self)
        self._poll_timer.setInterval(5000)
        self._poll_timer.timeout.connect(self._poll_system_scheme)
        self._update_polling()

        self.apply()

    @property
    def is_dark(self) -> bool:
        if self.mode == "dark":
            return True
        if self.mode == "light":
            return False
        return self._system_dark

    def set_mode(self, mode: str):
        self.mode = mode if mode in {"system", "light", "dark"} else "system"
        self.apply()
        self._update_polling()

    def _detect_system_dark(self) -> bool:
        if os.name == "posix":
            detected = _linux_system_scheme(self.app)
            if detected is not None:
                return detected
        return self._palette_dark

    def _update_polling(self):
        unknown_scheme = self._style_hints.colorScheme() == Qt.ColorScheme.Unknown
        if self.mode == "system" and os.name == "posix" and unknown_scheme:
            self._poll_timer.start()
        else:
            self._poll_timer.stop()

    def _poll_system_scheme(self):
        if self.mode != "system":
            self._poll_timer.stop()
            return
        detected = _linux_system_scheme(self.app)
        if detected is not None and detected != self._system_dark:
            self._system_dark = detected
            self.apply()
            self._update_polling()

    def _on_system_scheme_changed(self, _scheme):
        if self.mode != "system":
            return
        self._system_dark = self._detect_system_dark()
        self.apply()
        self._update_polling()

    def apply(self):
        dark = self.is_dark
        c = theme_colors(dark)
        palette = QPalette()
        palette.setColor(QPalette.ColorRole.Window, QColor(c["window"]))
        palette.setColor(QPalette.ColorRole.WindowText, QColor(c["text"]))
        palette.setColor(QPalette.ColorRole.Base, QColor(c["panel"]))
        palette.setColor(QPalette.ColorRole.AlternateBase, QColor(c["surface"]))
        palette.setColor(QPalette.ColorRole.Text, QColor(c["text"]))
        palette.setColor(QPalette.ColorRole.Button, QColor(c["surface"]))
        palette.setColor(QPalette.ColorRole.ButtonText, QColor(c["text"]))
        palette.setColor(QPalette.ColorRole.Highlight, QColor(c["selection"]))
        palette.setColor(QPalette.ColorRole.HighlightedText, QColor(c["selection_text"]))
        palette.setColor(QPalette.ColorRole.ToolTipBase, QColor(c["panel"]))
        palette.setColor(QPalette.ColorRole.ToolTipText, QColor(c["text"]))
        self.app.setPalette(palette)
        self.changed.emit(dark)
