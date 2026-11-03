import re
from PySide6.QtCore import QUrl, Signal, QCoreApplication
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebEngineCore import (
    QWebEngineProfile,
    QWebEnginePage,
    QWebEngineSettings,
)
from artyplexer.models import ServiceConfig


class ServiceView(QWebEngineView):
    unread_changed = Signal(str, int)  # service_id, unread_count
    title_updated = Signal(str, str)   # service_id, title
    web_notification_received = Signal(str, str, str)  # service_id, title, message

    def __init__(self, service: ServiceConfig, profile_dir: str, parent=None):
        super().__init__(parent)
        self.service = service
        self.profile_dir = profile_dir
        self.is_loaded = False
        self.unread_count = 0

        # Create isolated persistent profile owned by QCoreApplication
        app_instance = QCoreApplication.instance()
        self.profile = QWebEngineProfile(f"profile_{self.service.id}", app_instance)
        self.profile.setPersistentStoragePath(str(self.profile_dir))
        self.profile.setPersistentCookiesPolicy(
            QWebEngineProfile.PersistentCookiesPolicy.ForcePersistentCookies
        )
        self.profile.setHttpUserAgent(self.service.user_agent)

        # Hook native web notifications from WhatsApp / Telegram
        self.profile.setNotificationPresenter(self._handle_web_notification)

        # Enable modern web settings
        settings = self.profile.settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.ScrollAnimatorEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.PluginsEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.FullScreenSupportEnabled, True)

        # Create page
        self.page_obj = QWebEnginePage(self.profile, self)
        self.page_obj.featurePermissionRequested.connect(self._handle_permission_request)
        self.setPage(self.page_obj)

        # Connect signals
        self.titleChanged.connect(self._on_title_changed)

    def load_if_needed(self):
        """Loads URL on demand (Lazy Loading)."""
        if not self.is_loaded:
            self.load(QUrl(self.service.url))
            self.is_loaded = True

    def _handle_permission_request(self, origin, feature):
        # Auto-grant notifications, microphone, camera, etc. for active messaging services
        self.page_obj.setFeaturePermission(
            origin, feature, QWebEnginePage.PermissionPolicy.PermissionGrantedByUser
        )

    def _handle_web_notification(self, notification):
        try:
            title = notification.title()
            msg = notification.message()
            self.web_notification_received.emit(self.service.id, title, msg)
        except Exception as e:
            print(f"Error handling notification: {e}")

    def _on_title_changed(self, title: str):
        self.title_updated.emit(self.service.id, title)
        
        # Check for unread indicators, e.g. "(3) WhatsApp" or "(12) Telegram"
        match = re.search(r"\((\d+)\+?\)", title)
        new_count = int(match.group(1)) if match else 0

        if new_count != self.unread_count:
            self.unread_count = new_count
            self.unread_changed.emit(self.service.id, self.unread_count)
