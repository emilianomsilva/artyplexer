import os
from pathlib import Path
from typing import Dict, Optional
from PySide6.QtCore import Qt, QEvent, QStandardPaths
from PySide6.QtGui import QKeySequence, QShortcut, QIcon, QCloseEvent
from PySide6.QtWidgets import (
    QApplication,
    QMainWindow,
    QWidget,
    QHBoxLayout,
    QVBoxLayout,
    QStackedLayout,
    QLabel,
    QPushButton,
    QMessageBox,
    QFileDialog,
)
from PySide6.QtWebEngineCore import QWebEngineDownloadRequest
from artyplexer.config import ConfigManager, ICONS_DIR
from artyplexer.models import ServiceConfig, AppSettings
from artyplexer.ui.sidebar import Sidebar
from artyplexer.ui.service_view import ServiceView
from artyplexer.ui.tray import ArtyplexerTray
from artyplexer.ui.add_dialog import AddServiceDialog
from artyplexer.ui.settings_dialog import SettingsDialog
from artyplexer.ui.theme import theme_colors


class MainWindow(QMainWindow):
    def __init__(self, config_manager: ConfigManager, theme_manager, parent=None):
        super().__init__(parent)
        self.config_manager = config_manager
        self.theme_manager = theme_manager
        self.settings = config_manager.settings
        
        self.views: Dict[str, ServiceView] = {}
        self.unread_map: Dict[str, int] = {}
        self.active_service_id: Optional[str] = None
        self.has_shown_tray_hint = False
        self._active_downloads = set()

        self.setWindowTitle("Artyplexer")
        self.resize(self.settings.window_width, self.settings.window_height)
        self.setWindowIcon(QIcon(str(ICONS_DIR / "app.svg")))

        # Tray Icon
        self.tray = ArtyplexerTray(self)
        self._connect_tray_signals()

        self._init_ui()
        self._init_shortcuts()

        # Restore last active service or first service
        initial_id = self.settings.last_active_service_id
        if not initial_id or initial_id not in self.views:
            if self.config_manager.services:
                initial_id = self.config_manager.services[0].id

        if initial_id:
            self.switch_service(initial_id, bring_to_front=False)

    def _init_ui(self):
        central_widget = QWidget(self)
        self.setCentralWidget(central_widget)
        main_layout = QHBoxLayout(central_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # 1. Sidebar (Ferdium style)
        self.sidebar = Sidebar(
            services=self.config_manager.services,
            active_service_id=self.active_service_id,
            parent=self,
        )
        self._connect_sidebar_signals()
        main_layout.addWidget(self.sidebar)

        # 2. Right Content Area (Top bar + WebViews)
        self.right_container = QWidget()
        right_layout = QVBoxLayout(self.right_container)
        right_layout.setContentsMargins(0, 0, 0, 0)
        right_layout.setSpacing(0)

        # Top Header Bar (subtle status / reload controls)
        self.header_bar = QWidget()
        self.header_bar.setMinimumHeight(40)
        self.header_bar.setMaximumHeight(48)
        header_layout = QHBoxLayout(self.header_bar)
        header_layout.setContentsMargins(12, 0, 12, 0)
        header_layout.setSpacing(8)

        self.service_title_label = QLabel("No service selected")
        header_layout.addWidget(self.service_title_label)

        header_layout.addStretch()

        self.reload_btn = QPushButton("↻ Reload")
        self.reload_btn.setToolTip("Reload current service (Ctrl+R)")
        self.reload_btn.clicked.connect(self._reload_current_service)
        header_layout.addWidget(self.reload_btn)

        right_layout.addWidget(self.header_bar)

        # Stacked Layout of WebViews
        self.stack = QStackedLayout()
        
        for svc in self.config_manager.services:
            self._create_service_view(svc)

        right_layout.addLayout(self.stack)
        main_layout.addWidget(self.right_container)

        self.tray.set_services(self.config_manager.services, self.active_service_id)
        self.theme_manager.changed.connect(self.apply_theme)
        self.apply_theme(self.theme_manager.is_dark)

    def apply_theme(self, dark: bool):
        c = theme_colors(dark)
        self.right_container.setStyleSheet(f"background-color: {c['window']};")
        self.header_bar.setStyleSheet(f"""
            QWidget {{ background-color: {c['panel']}; border-bottom: 1px solid {c['border']}; }}
            QLabel {{ color: {c['muted']}; font-size: 13px; font-weight: 500; }}
            QPushButton {{ background-color: transparent; border: 1px solid {c['border']};
                color: {c['text']}; padding: 4px 10px; border-radius: 4px; font-size: 12px; }}
            QPushButton:hover {{ background-color: {c['surface_hover']}; color: {c['text']};
                border-color: {c['accent']}; }}
        """)
        self.service_title_label.setStyleSheet(f"color: {c['text']}; font-weight: bold;")
        self.sidebar.apply_theme(dark)
        self.tray.apply_theme(dark)
        for dialog in self.findChildren(SettingsDialog) + self.findChildren(AddServiceDialog):
            dialog.apply_theme(dark)

    def _create_service_view(self, service: ServiceConfig) -> ServiceView:
        profile_dir = self.config_manager.get_service_profile_dir(service.id)
        view = ServiceView(service, profile_dir=str(profile_dir))

        target_dir = self.settings.download_dir or QStandardPaths.writableLocation(
            QStandardPaths.StandardLocation.DownloadLocation
        )
        if target_dir:
            view.profile.setDownloadPath(str(target_dir))

        view.unread_changed.connect(self._on_service_unread_changed)
        view.web_notification_received.connect(self._on_web_notification)
        view.download_requested.connect(
            lambda dl, s=service: self._handle_download_request(dl, s)
        )
        
        self.stack.addWidget(view)
        self.views[service.id] = view
        self.unread_map[service.id] = 0
        return view

    def _connect_sidebar_signals(self):
        self.sidebar.service_selected.connect(lambda s_id: self.switch_service(s_id, bring_to_front=False))
        self.sidebar.service_reload_requested.connect(self._reload_service)
        self.sidebar.service_mute_toggled.connect(self._toggle_service_mute)
        self.sidebar.service_edit_requested.connect(self._edit_service)
        self.sidebar.service_delete_requested.connect(self._delete_service)
        self.sidebar.service_color_changed.connect(self._on_service_color_changed)
        self.sidebar.add_service_requested.connect(self._open_add_dialog)
        self.sidebar.toggle_dnd_requested.connect(self._toggle_global_dnd)
        self.sidebar.settings_requested.connect(self._open_settings_dialog)

    def _on_service_color_changed(self, service_id: str, color_hex: str):
        for svc in self.config_manager.services:
            if svc.id == service_id:
                svc.custom_color = color_hex
                self.config_manager.save()
                self.sidebar.update_service_button(svc)
                break

    def _connect_tray_signals(self):
        self.tray.toggle_window_requested.connect(self._toggle_window_visibility)
        self.tray.service_selected.connect(lambda s_id: self.switch_service(s_id, bring_to_front=True))
        self.tray.toggle_dnd_requested.connect(self._toggle_global_dnd)
        self.tray.settings_requested.connect(self._open_settings_dialog)
        self.tray.quit_requested.connect(self._force_quit)

    def _init_shortcuts(self):
        # Ctrl+1 to Ctrl+9
        for i in range(9):
            shortcut = QShortcut(QKeySequence(f"Ctrl+{i+1}"), self)
            shortcut.activated.connect(lambda idx=i: self._switch_by_index(idx))

        # Ctrl+R: reload
        reload_sc = QShortcut(QKeySequence("Ctrl+R"), self)
        reload_sc.activated.connect(self._reload_current_service)

        # Ctrl+N: add service
        add_sc = QShortcut(QKeySequence("Ctrl+N"), self)
        add_sc.activated.connect(self._open_add_dialog)

        # F11: toggle fullscreen
        f11_sc = QShortcut(QKeySequence("F11"), self)
        f11_sc.activated.connect(self._toggle_fullscreen)

    def _switch_by_index(self, index: int):
        if 0 <= index < len(self.config_manager.services):
            svc_id = self.config_manager.services[index].id
            self.switch_service(svc_id, bring_to_front=False)

    def switch_service(self, service_id: str, bring_to_front: bool = False):
        if service_id not in self.views:
            return

        self.active_service_id = service_id
        target_view = self.views[service_id]

        # Switch stacked layout
        self.stack.setCurrentWidget(target_view)
        target_view.load_if_needed()

        # Update sidebar active indicator
        self.sidebar.set_active_service(service_id)

        # Update header bar
        self.service_title_label.setText(f"{target_view.service.name} • {target_view.service.url}")
        self.setWindowTitle(f"{target_view.service.name} - Artyplexer")

        # Remember last active
        self.settings.last_active_service_id = service_id
        self.config_manager.save()
        self.tray.set_services(self.config_manager.services, service_id)

        # Only bring window to front when explicitly requested (e.g. from tray menu)
        if bring_to_front:
            self.show_and_activate()

    def _on_service_unread_changed(self, service_id: str, count: int):
        prev_count = self.unread_map.get(service_id, 0)
        self.unread_map[service_id] = count

        # Update sidebar
        self.sidebar.set_service_unread(service_id, count)

        # Total unread
        total = sum(self.unread_map.values())
        self.tray.set_total_unread(total)

        # Send notification if count increased
        if count > prev_count and service_id in self.views:
            svc = self.views[service_id].service
            if svc.notifications_enabled and not svc.muted and not self.settings.global_dnd:
                diff = count - prev_count
                title = f"{svc.name}"
                msg = f"{count} unread messages ({diff} new)"
                self.tray.notify(title, msg)

    def _on_web_notification(self, service_id: str, title: str, message: str):
        if service_id not in self.views:
            return
        svc = self.views[service_id].service
        if svc.notifications_enabled and not svc.muted and not self.settings.global_dnd:
            self.tray.notify(f"{svc.name}: {title}", message)

    def _reload_service(self, service_id: str):
        if service_id in self.views:
            self.views[service_id].reload()

    def _reload_current_service(self):
        if self.active_service_id:
            self._reload_service(self.active_service_id)

    def _toggle_service_mute(self, service_id: str):
        for svc in self.config_manager.services:
            if svc.id == service_id:
                svc.muted = not svc.muted
                self.config_manager.save()
                self.sidebar.buttons[service_id].update()
                break

    def _open_add_dialog(self):
        dialog = AddServiceDialog(parent=self)
        dialog.apply_theme(self.theme_manager.is_dark)
        dialog.service_created.connect(self._on_service_created)
        dialog.exec()

    def _on_service_created(self, service: ServiceConfig):
        self.config_manager.add_service(service)
        self._create_service_view(service)
        self.sidebar.refresh_services(self.config_manager.services, self.active_service_id)
        self.tray.set_services(self.config_manager.services, self.active_service_id)
        self.switch_service(service.id, bring_to_front=False)

    def _edit_service(self, service_id: str):
        svc = next((s for s in self.config_manager.services if s.id == service_id), None)
        if not svc:
            return
        dialog = AddServiceDialog(editing_service=svc, parent=self)
        dialog.apply_theme(self.theme_manager.is_dark)
        dialog.service_created.connect(self._on_service_updated)
        dialog.exec()

    def _on_service_updated(self, service: ServiceConfig):
        self.config_manager.update_service(service)
        if service.id in self.views:
            self.views[service.id].service = service
        self.sidebar.refresh_services(self.config_manager.services, self.active_service_id)
        self.tray.set_services(self.config_manager.services, self.active_service_id)
        if self.active_service_id == service.id:
            self.service_title_label.setText(f"{service.name} • {service.url}")

    def _delete_service(self, service_id: str):
        svc = next((s for s in self.config_manager.services if s.id == service_id), None)
        if not svc:
            return
        confirm = QMessageBox.question(
            self,
            "Delete Service",
            f"Are you sure you want to delete the service '{svc.name}'?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )
        if confirm == QMessageBox.StandardButton.Yes:
            self._remove_service_internal(service_id)

    def _remove_service_internal(self, service_id: str):
        self.config_manager.remove_service(service_id)
        if service_id in self.views:
            view = self.views.pop(service_id)
            self.stack.removeWidget(view)
            view.deleteLater()
        self.unread_map.pop(service_id, None)

        # Switch to first available
        remaining = self.config_manager.services
        next_id = remaining[0].id if remaining else None
        self.sidebar.refresh_services(remaining, next_id)
        self.tray.set_services(remaining, next_id)

        if next_id:
            self.switch_service(next_id, bring_to_front=False)
        else:
            self.active_service_id = None
            self.service_title_label.setText("No services configured")

    def _open_settings_dialog(self):
        dialog = SettingsDialog(self.config_manager, parent=self)
        dialog.apply_theme(self.theme_manager.is_dark)
        dialog.settings_changed.connect(self._on_settings_changed)
        dialog.service_deleted.connect(self._remove_service_internal)
        dialog.exec()

    def _on_settings_changed(self, new_settings: AppSettings):
        self.settings = new_settings
        self.sidebar.set_global_dnd(self.settings.global_dnd)
        self.tray.set_global_dnd(self.settings.global_dnd)
        self.theme_manager.set_mode(self.settings.theme_mode)

        target_dir = self.settings.download_dir or QStandardPaths.writableLocation(
            QStandardPaths.StandardLocation.DownloadLocation
        )
        if target_dir:
            for view in self.views.values():
                if hasattr(view, "profile"):
                    view.profile.setDownloadPath(str(target_dir))

    def _handle_download_request(self, download: QWebEngineDownloadRequest, service: ServiceConfig):
        suggested_name = download.suggestedFileName() or download.downloadFileName() or "download"
        default_dir = self.settings.download_dir or QStandardPaths.writableLocation(
            QStandardPaths.StandardLocation.DownloadLocation
        )
        if not default_dir:
            default_dir = str(Path.home() / "Downloads")

        if self.settings.always_ask_download:
            initial_path = os.path.join(default_dir, suggested_name)
            file_path, _ = QFileDialog.getSaveFileName(
                self,
                "Salvar arquivo como...",
                initial_path,
            )
            if file_path:
                target_path = Path(file_path)
                download.setDownloadDirectory(str(target_path.parent))
                download.setDownloadFileName(target_path.name)
                self._track_and_accept_download(download, service.name)
            else:
                download.cancel()
        else:
            os.makedirs(default_dir, exist_ok=True)
            download.setDownloadDirectory(str(default_dir))
            self._track_and_accept_download(download, service.name)

    def _track_and_accept_download(self, download: QWebEngineDownloadRequest, service_name: str):
        self._active_downloads.add(download)

        def on_state_changed(state):
            if state == QWebEngineDownloadRequest.DownloadState.DownloadCompleted:
                if self.settings.notify_download_complete and not self.settings.global_dnd:
                    fname = download.downloadFileName() or download.suggestedFileName()
                    self.tray.notify(
                        "Download concluído",
                        f"{fname} foi salvo em {download.downloadDirectory()}."
                    )
                self._active_downloads.discard(download)
            elif state == QWebEngineDownloadRequest.DownloadState.DownloadInterrupted:
                if not self.settings.global_dnd:
                    fname = download.downloadFileName() or download.suggestedFileName()
                    reason = download.interruptReasonString()
                    self.tray.notify(
                        "Erro no download",
                        f"Falha ao baixar {fname}: {reason}"
                    )
                self._active_downloads.discard(download)
            elif state == QWebEngineDownloadRequest.DownloadState.DownloadCancelled:
                self._active_downloads.discard(download)

        download.stateChanged.connect(on_state_changed)
        download.isFinishedChanged.connect(
            lambda: self._active_downloads.discard(download) if download.isFinished() else None
        )
        download.accept()

    def _toggle_global_dnd(self):
        self.settings.global_dnd = not self.settings.global_dnd
        self.config_manager.settings = self.settings
        self.config_manager.save()
        self.sidebar.set_global_dnd(self.settings.global_dnd)
        self.tray.set_global_dnd(self.settings.global_dnd)

    def changeEvent(self, event):
        if event.type() == QEvent.Type.WindowStateChange:
            if not self.isMinimized():
                self.settings.is_maximized = self.isMaximized()
        super().changeEvent(event)

    def _toggle_fullscreen(self):
        if self.isFullScreen():
            if self.settings.is_maximized:
                self.showMaximized()
            else:
                self.showNormal()
        else:
            self.showFullScreen()

    def show_and_activate(self):
        was_max = (
            self.isMaximized()
            or bool(self.windowState() & Qt.WindowState.WindowMaximized)
            or self.settings.is_maximized
        )
        self.setWindowState(self.windowState() & ~Qt.WindowState.WindowMinimized)
        if was_max:
            self.showMaximized()
        else:
            self.showNormal()
        self.raise_()
        self.activateWindow()

    def _toggle_window_visibility(self):
        if self.isVisible() and not self.isMinimized() and self.isActiveWindow():
            self.hide()
        else:
            self.show_and_activate()

    def _force_quit(self):
        self._is_quitting = True
        if not self.isMinimized():
            self.settings.is_maximized = self.isMaximized()
        if not self.isMaximized():
            self.settings.window_width = self.width()
            self.settings.window_height = self.height()
        self.config_manager.save()
        self.tray.hide()
        QApplication.quit()

    def closeEvent(self, event: QCloseEvent):
        if getattr(self, "_is_quitting", False):
            event.accept()
            return

        if self.settings.minimize_to_tray:
            if not self.isMinimized():
                self.settings.is_maximized = self.isMaximized()
            if not self.isMaximized():
                self.settings.window_width = self.width()
                self.settings.window_height = self.height()
            self.config_manager.save()
            event.ignore()
            self.hide()
            if not self.has_shown_tray_hint:
                self.tray.notify(
                    "Artyplexer",
                    "The application will keep running in the system tray. Click the icon to reopen.",
                )
                self.has_shown_tray_hint = True
        else:
            self._force_quit()
            event.accept()
