from pathlib import Path
from typing import Dict, List, Optional
from PySide6.QtCore import Qt, Signal, QRect, QRectF, QPoint, QByteArray
from PySide6.QtGui import (
    QPainter,
    QColor,
    QIcon,
    QFont,
    QPen,
    QBrush,
    QAction,
    QContextMenuEvent,
)
from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QScrollArea,
    QPushButton,
    QMenu,
    QFrame,
    QSizePolicy,
    QColorDialog,
)
from PySide6.QtSvg import QSvgRenderer
from artyplexer.models import ServiceConfig
from artyplexer.config import ICONS_DIR


def create_svg_renderer(icon_type: str, custom_color: Optional[str] = None) -> QSvgRenderer:
    """Loads and recolors SVG icon in memory if a custom color is specified."""
    icon_path = ICONS_DIR / f"{icon_type}.svg"
    if not icon_path.exists():
        icon_path = ICONS_DIR / "generic.svg"
    try:
        content = icon_path.read_text(encoding="utf-8")
        if custom_color:
            # Match brand color fills in SVG icons
            for default_color in ["#25D366", "#229ED9", "#5865F2", "#4A154B", "#334155"]:
                if default_color.lower() in content.lower():
                    content = content.replace(default_color, custom_color).replace(default_color.lower(), custom_color)
                    break
        return QSvgRenderer(QByteArray(content.encode("utf-8")))
    except Exception:
        return QSvgRenderer(str(icon_path))


class ServiceButton(QPushButton):
    service_selected = Signal(str)  # service_id
    service_reload_requested = Signal(str)
    service_mute_toggled = Signal(str)
    service_edit_requested = Signal(str)
    service_delete_requested = Signal(str)
    service_color_changed = Signal(str, str)  # service_id, color_hex

    def __init__(self, service: ServiceConfig, is_active: bool = False, parent=None):
        super().__init__(parent)
        self.service = service
        self.is_active = is_active
        self.unread_count = 0
        self.setFixedSize(68, 56)
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setToolTip(f"{self.service.name}\n({self.service.url})")

        # Load SVG icon with custom color support
        self.svg_renderer = create_svg_renderer(self.service.icon_type, self.service.custom_color)

    def update_service(self, service: ServiceConfig):
        self.service = service
        self.svg_renderer = create_svg_renderer(self.service.icon_type, self.service.custom_color)
        self.setToolTip(f"{self.service.name}\n({self.service.url})")
        self.update()

    def set_active(self, active: bool):
        if self.is_active != active:
            self.is_active = active
            self.update()

    def set_unread_count(self, count: int):
        if self.unread_count != count:
            self.unread_count = count
            self.update()

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)

        # 1. Background container (centered horizontally)
        icon_rect = QRect(14, 8, 40, 40)
        
        if self.is_active:
            # Active background
            painter.setBrush(QBrush(QColor("#2d3240")))
            painter.setPen(Qt.PenStyle.NoPen)
            painter.drawRoundedRect(icon_rect, 10, 10)

            # Left active indicator pill (Ferdium / Discord style)
            pill_rect = QRectF(0, 16, 3.5, 24)
            painter.setBrush(QBrush(QColor("#ffffff")))
            painter.drawRoundedRect(pill_rect, 1.75, 1.75)
        elif self.underMouse():
            # Hover background
            painter.setBrush(QBrush(QColor("#262933")))
            painter.setPen(Qt.PenStyle.NoPen)
            painter.drawRoundedRect(icon_rect, 10, 10)

        # 2. Render SVG Icon centered inside icon_rect with 4px padding
        svg_target = QRectF(18, 12, 32, 32)
        if self.svg_renderer.isValid():
            self.svg_renderer.render(painter, svg_target)

        # 3. Muted icon indicator if service is muted
        if self.service.muted:
            painter.setBrush(QBrush(QColor("#181920")))
            painter.setPen(QPen(QColor("#ef4444"), 1.5))
            painter.drawEllipse(QPoint(50, 44), 5, 5)

        # 4. Red Notification Badge (dynamic sizing to avoid font clipping)
        if self.unread_count > 0:
            badge_text = str(self.unread_count) if self.unread_count <= 99 else "99+"
            
            font = QFont("Arial", 9, QFont.Weight.Bold)
            painter.setFont(font)
            fm = painter.fontMetrics()

            text_width = fm.horizontalAdvance(badge_text)
            text_height = fm.height()

            badge_width = max(20, text_width + 10)
            badge_height = max(18, text_height + 2)

            # Keep badge inside the 68px width boundary
            badge_x = min(68.0 - badge_width - 2.0, 50.0 - badge_width / 2.0)
            badge_rect = QRectF(badge_x, 3.0, badge_width, badge_height)

            # Shadow / Border
            painter.setBrush(QBrush(QColor("#ef4444")))
            painter.setPen(QPen(QColor("#181920"), 1.5))
            painter.drawRoundedRect(badge_rect, badge_height / 2.0, badge_height / 2.0)

            # Centered Text
            painter.setPen(QPen(QColor("#ffffff")))
            painter.drawText(badge_rect, Qt.AlignmentFlag.AlignCenter, badge_text)

        painter.end()

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.service_selected.emit(self.service.id)
        super().mousePressEvent(event)

    def contextMenuEvent(self, event: QContextMenuEvent):
        menu = QMenu(self)
        menu.setStyleSheet("""
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

        reload_act = QAction(f"Reload {self.service.name}", self)
        reload_act.triggered.connect(lambda: self.service_reload_requested.emit(self.service.id))
        menu.addAction(reload_act)

        mute_title = "Unmute Notifications" if self.service.muted else "Mute Notifications"
        mute_act = QAction(mute_title, self)
        mute_act.triggered.connect(lambda: self.service_mute_toggled.emit(self.service.id))
        menu.addAction(mute_act)

        menu.addSeparator()

        color_act = QAction("Change Icon Color...", self)
        color_act.triggered.connect(self._pick_custom_color)
        menu.addAction(color_act)

        edit_act = QAction("Edit Service...", self)
        edit_act.triggered.connect(lambda: self.service_edit_requested.emit(self.service.id))
        menu.addAction(edit_act)

        delete_act = QAction("Delete Service", self)
        delete_act.triggered.connect(lambda: self.service_delete_requested.emit(self.service.id))
        menu.addAction(delete_act)

        menu.exec(event.globalPos())

    def _pick_custom_color(self):
        initial = QColor(self.service.custom_color or "#25D366")
        color = QColorDialog.getColor(initial, self, "Select Icon Color")
        if color.isValid():
            self.service_color_changed.emit(self.service.id, color.name())


class Sidebar(QWidget):
    service_selected = Signal(str)
    service_reload_requested = Signal(str)
    service_mute_toggled = Signal(str)
    service_edit_requested = Signal(str)
    service_delete_requested = Signal(str)
    service_color_changed = Signal(str, str)  # service_id, color_hex
    add_service_requested = Signal()
    toggle_dnd_requested = Signal()
    settings_requested = Signal()

    def __init__(self, services: List[ServiceConfig], active_service_id: Optional[str] = None, parent=None):
        super().__init__(parent)
        self.setFixedWidth(68)
        self.buttons: Dict[str, ServiceButton] = {}
        self.active_id = active_service_id
        self.global_dnd = False

        self._init_ui(services)

    def _init_ui(self, services: List[ServiceConfig]):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 8, 0, 8)
        main_layout.setSpacing(4)

        # Style Sidebar container
        self.setStyleSheet("background-color: #181920;")

        # Scroll area for services
        self.scroll_area = QScrollArea()
        self.scroll_area.setWidgetResizable(True)
        self.scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.scroll_area.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.scroll_area.setFrameShape(QFrame.Shape.NoFrame)
        self.scroll_area.setStyleSheet("background-color: transparent;")

        self.services_container = QWidget()
        self.services_container.setStyleSheet("background-color: transparent;")
        self.services_layout = QVBoxLayout(self.services_container)
        self.services_layout.setContentsMargins(0, 0, 0, 0)
        self.services_layout.setSpacing(4)
        self.services_layout.setAlignment(Qt.AlignmentFlag.AlignTop)

        for svc in services:
            self._add_service_button(svc)

        self.scroll_area.setWidget(self.services_container)
        main_layout.addWidget(self.scroll_area)

        # Bottom actions separator
        sep = QFrame()
        sep.setFrameShape(QFrame.Shape.HLine)
        sep.setStyleSheet("background-color: #2d3240; max-height: 1px; margin: 4px 10px;")
        main_layout.addWidget(sep)

        # Bottom Actions: Add (+), DND (Bell), Settings (Gear)
        self.add_btn = self._create_bottom_button("plus.svg", "Add new service")
        self.add_btn.clicked.connect(self.add_service_requested.emit)
        main_layout.addWidget(self.add_btn)

        self.dnd_btn = self._create_bottom_button("bell.svg", "Do Not Disturb mode (Mute all)")
        self.dnd_btn.clicked.connect(self.toggle_dnd_requested.emit)
        main_layout.addWidget(self.dnd_btn)

        self.settings_btn = self._create_bottom_button("settings.svg", "Settings")
        self.settings_btn.clicked.connect(self.settings_requested.emit)
        main_layout.addWidget(self.settings_btn)

    def _create_bottom_button(self, icon_name: str, tooltip: str) -> QPushButton:
        btn = QPushButton()
        btn.setFixedSize(68, 44)
        btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn.setToolTip(tooltip)
        icon_path = ICONS_DIR / icon_name
        btn.setIcon(QIcon(str(icon_path)))
        btn.setIconSize(btn.size() * 0.45)
        btn.setStyleSheet("""
            QPushButton {
                background-color: transparent;
                border: none;
                border-radius: 8px;
            }
            QPushButton:hover {
                background-color: #262933;
            }
        """)
        return btn

    def _add_service_button(self, service: ServiceConfig):
        is_active = (service.id == self.active_id)
        btn = ServiceButton(service, is_active=is_active)
        btn.service_selected.connect(self.service_selected.emit)
        btn.service_reload_requested.connect(self.service_reload_requested.emit)
        btn.service_mute_toggled.connect(self.service_mute_toggled.emit)
        btn.service_edit_requested.connect(self.service_edit_requested.emit)
        btn.service_delete_requested.connect(self.service_delete_requested.emit)
        btn.service_color_changed.connect(self.service_color_changed.emit)
        
        self.services_layout.addWidget(btn)
        self.buttons[service.id] = btn

    def update_service_button(self, service: ServiceConfig):
        if service.id in self.buttons:
            self.buttons[service.id].update_service(service)

    def set_active_service(self, service_id: str):
        self.active_id = service_id
        for s_id, btn in self.buttons.items():
            btn.set_active(s_id == service_id)

    def set_service_unread(self, service_id: str, count: int):
        if service_id in self.buttons:
            self.buttons[service_id].set_unread_count(count)

    def set_global_dnd(self, enabled: bool):
        self.global_dnd = enabled
        icon_name = "bell-slash.svg" if enabled else "bell.svg"
        tooltip = "Do Not Disturb enabled (Click to unmute)" if enabled else "Do Not Disturb mode (Mute all)"
        self.dnd_btn.setIcon(QIcon(str(ICONS_DIR / icon_name)))
        self.dnd_btn.setToolTip(tooltip)

    def refresh_services(self, services: List[ServiceConfig], active_id: Optional[str]):
        # Clear existing buttons
        while self.services_layout.count():
            item = self.services_layout.takeAt(0)
            widget = item.widget()
            if widget:
                widget.deleteLater()
        self.buttons.clear()

        self.active_id = active_id
        for svc in services:
            self._add_service_button(svc)
