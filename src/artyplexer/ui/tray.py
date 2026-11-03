from typing import Dict, List, Optional
from PySide6.QtCore import Qt, Signal, QRectF, QPoint
from PySide6.QtGui import (
    QIcon,
    QPixmap,
    QPainter,
    QColor,
    QFont,
    QPen,
    QBrush,
    QAction,
)
from PySide6.QtWidgets import QSystemTrayIcon, QMenu
from PySide6.QtSvg import QSvgRenderer
from artyplexer.models import ServiceConfig
from artyplexer.config import ICONS_DIR


class ArtyplexerTray(QSystemTrayIcon):
    show_window_requested = Signal()
    hide_window_requested = Signal()
    toggle_window_requested = Signal()
    service_selected = Signal(str)
    toggle_dnd_requested = Signal()
    settings_requested = Signal()
    quit_requested = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.total_unread = 0
        self.global_dnd = False
        self.services: List[ServiceConfig] = []
        self.active_service_id: Optional[str] = None
        
        self.app_svg = QSvgRenderer(str(ICONS_DIR / "app.svg"))
        self._update_icon()

        self._create_menu()
        self.activated.connect(self._on_activated)

    def _update_icon(self):
        """Generates dynamic icon with unread badge counter."""
        pixmap = QPixmap(64, 64)
        pixmap.fill(Qt.GlobalColor.transparent)

        painter = QPainter(pixmap)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)

        if self.app_svg.isValid():
            self.app_svg.render(painter, QRectF(4, 4, 56, 56))

        if self.total_unread > 0:
            badge_text = str(self.total_unread) if self.total_unread <= 99 else "99+"
            font = QFont("Arial", 14, QFont.Weight.Bold)
            painter.setFont(font)

            badge_width = 24 if len(badge_text) <= 1 else (32 if len(badge_text) == 2 else 40)
            badge_height = 24
            badge_rect = QRectF(60 - badge_width, 4, badge_width, badge_height)

            painter.setBrush(QBrush(QColor("#ef4444")))
            painter.setPen(QPen(QColor("#181920"), 2))
            painter.drawRoundedRect(badge_rect, 12, 12)

            painter.setPen(QPen(QColor("#ffffff")))
            painter.drawText(badge_rect, Qt.AlignmentFlag.AlignCenter, badge_text)

        painter.end()
        self.setIcon(QIcon(pixmap))

    def _create_menu(self):
        self.menu = QMenu()
        self.menu.setStyleSheet("""
            QMenu {
                background-color: #232530;
                color: #e2e8f0;
                border: 1px solid #333846;
                border-radius: 6px;
                padding: 4px;
            }
            QMenu::item {
                padding: 6px 20px;
                border-radius: 4px;
            }
            QMenu::item:selected {
                background-color: #3b82f6;
                color: #ffffff;
            }
        """)

        # Title
        header_text = "Artyplexer"
        if self.total_unread > 0:
            header_text += f" ({self.total_unread} unread)"
        header_act = self.menu.addAction(header_text)
        header_act.setEnabled(False)

        self.menu.addSeparator()

        # Service shortcuts
        for svc in self.services:
            act = self.menu.addAction(svc.name)
            act.triggered.connect(lambda _, s_id=svc.id: self.service_selected.emit(s_id))

        if self.services:
            self.menu.addSeparator()

        # Window toggle
        toggle_act = self.menu.addAction("Show / Hide Window")
        toggle_act.triggered.connect(self.toggle_window_requested.emit)

        # DND
        dnd_title = "Disable Do Not Disturb" if self.global_dnd else "Enable Do Not Disturb"
        dnd_act = self.menu.addAction(dnd_title)
        dnd_act.triggered.connect(self.toggle_dnd_requested.emit)

        # Settings
        settings_act = self.menu.addAction("Settings...")
        settings_act.triggered.connect(self.settings_requested.emit)

        self.menu.addSeparator()

        # Quit
        quit_act = self.menu.addAction("Quit Artyplexer")
        quit_act.triggered.connect(self.quit_requested.emit)

        self.setContextMenu(self.menu)

    def set_services(self, services: List[ServiceConfig], active_id: Optional[str]):
        self.services = services
        self.active_service_id = active_id
        self._create_menu()

    def set_total_unread(self, count: int):
        if self.total_unread != count:
            self.total_unread = count
            self._update_icon()
            self._create_menu()

    def set_global_dnd(self, enabled: bool):
        self.global_dnd = enabled
        self._create_menu()

    def _on_activated(self, reason):
        if reason == QSystemTrayIcon.ActivationReason.Trigger:
            self.toggle_window_requested.emit()

    def notify(self, title: str, message: str):
        if not self.global_dnd:
            self.showMessage(
                title,
                message,
                QSystemTrayIcon.MessageIcon.Information,
                5000,
            )
