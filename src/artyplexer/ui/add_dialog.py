import uuid
from typing import Optional
from PySide6.QtCore import Qt, Signal, QByteArray
from PySide6.QtGui import QColor, QPainter, QPixmap, QIcon
from PySide6.QtWidgets import (
    QDialog,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QCheckBox,
    QComboBox,
    QGridLayout,
    QFrame,
    QColorDialog,
)
from PySide6.QtSvg import QSvgRenderer
from artyplexer.models import ServiceConfig, DEFAULT_USER_AGENT
from artyplexer.config import ICONS_DIR


PRESETS = [
    {
        "name": "WhatsApp",
        "url": "https://web.whatsapp.com",
        "icon_type": "whatsapp",
    },
    {
        "name": "Telegram",
        "url": "https://web.telegram.org/a/",
        "icon_type": "telegram",
    },
    {
        "name": "Discord",
        "url": "https://discord.com/app",
        "icon_type": "discord",
    },
    {
        "name": "Slack",
        "url": "https://app.slack.com/client/",
        "icon_type": "slack",
    },
    {
        "name": "YouTube",
        "url": "https://www.youtube.com",
        "icon_type": "youtube",
    },
    {
        "name": "Spotify",
        "url": "https://open.spotify.com",
        "icon_type": "spotify",
    },
    {
        "name": "Custom",
        "url": "https://",
        "icon_type": "generic",
    },
]


class AddServiceDialog(QDialog):
    service_created = Signal(ServiceConfig)

    def __init__(self, editing_service: Optional[ServiceConfig] = None, parent=None):
        super().__init__(parent)
        self.editing_service = editing_service
        self.setWindowTitle("Edit Service" if editing_service else "Add New Service")
        self.setMinimumSize(480, 420)
        self.resize(520, 460)
        self.setStyleSheet("""
            QDialog {
                background-color: #1e1f29;
                color: #e2e8f0;
            }
            QLabel {
                color: #94a3b8;
                font-size: 13px;
                font-weight: 500;
            }
            QLineEdit, QComboBox {
                background-color: #262938;
                border: 1px solid #3b3f54;
                border-radius: 6px;
                padding: 6px 12px;
                min-height: 24px;
                color: #ffffff;
                font-size: 13px;
            }
            QLineEdit:focus, QComboBox:focus {
                border: 1px solid #38bdf8;
            }
            QComboBox QAbstractItemView {
                background-color: #232530;
                color: #ffffff;
                selection-background-color: #3b82f6;
                selection-color: #ffffff;
                border: 1px solid #3b3f54;
                padding: 4px;
            }
            QPushButton {
                border-radius: 6px;
                padding: 8px 16px;
                min-height: 22px;
                font-weight: bold;
                font-size: 13px;
            }
        """)

        self._init_ui()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 20, 24, 20)
        layout.setSpacing(14)

        title = QLabel("Service Configuration")
        title.setStyleSheet("font-size: 16px; font-weight: bold; color: #ffffff;")
        layout.addWidget(title)

        if not self.editing_service:
            # Preset selector dropdown
            preset_label = QLabel("Template Preset:")
            layout.addWidget(preset_label)

            self.preset_combo = QComboBox()
            for p in PRESETS:
                icon_path = ICONS_DIR / f"{p['icon_type']}.svg"
                if not icon_path.exists():
                    icon_path = ICONS_DIR / "generic.svg"
                self.preset_combo.addItem(QIcon(str(icon_path)), p["name"], p)

            self.preset_combo.currentIndexChanged.connect(self._on_preset_dropdown_changed)
            layout.addWidget(self.preset_combo)

        # Fields
        layout.addWidget(QLabel("Service Name (e.g. WhatsApp Personal):"))
        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("Name / Identifier")
        layout.addWidget(self.name_input)

        layout.addWidget(QLabel("Service URL:"))
        self.url_input = QLineEdit()
        self.url_input.setPlaceholderText("https://...")
        layout.addWidget(self.url_input)

        layout.addWidget(QLabel("Icon Type & Color:"))
        icon_row = QHBoxLayout()
        self.icon_combo = QComboBox()
        self.icon_combo.addItem("WhatsApp", "whatsapp")
        self.icon_combo.addItem("Telegram", "telegram")
        self.icon_combo.addItem("Discord", "discord")
        self.icon_combo.addItem("Slack", "slack")
        self.icon_combo.addItem("YouTube", "youtube")
        self.icon_combo.addItem("Spotify", "spotify")
        self.icon_combo.addItem("Generic / Browser", "generic")
        self.icon_combo.currentIndexChanged.connect(self._update_icon_preview)
        icon_row.addWidget(self.icon_combo, stretch=1)

        # Icon Preview
        self.preview_label = QLabel()
        self.preview_label.setFixedSize(36, 36)
        self.preview_label.setStyleSheet("background-color: #181920; border-radius: 8px; border: 1px solid #333846;")
        self.preview_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        icon_row.addWidget(self.preview_label)
        layout.addLayout(icon_row)

        # Color presets
        layout.addWidget(QLabel("Icon Color (Differentiate between accounts):"))
        color_row = QHBoxLayout()
        color_row.setSpacing(6)

        self.color_swatches = [
            ("#25D366", "WhatsApp Green"),
            ("#1DB954", "Spotify Green"),
            ("#FF0000", "YouTube Red"),
            ("#229ED9", "Telegram Blue"),
            ("#5865F2", "Discord Blurple"),
            ("#f97316", "Orange"),
            ("#8b5cf6", "Purple"),
            ("#06b6d4", "Teal"),
            ("#eab308", "Yellow"),
            ("#64748b", "Slate"),
        ]
        self.color_buttons = []
        self.selected_color = "#25D366"

        for hex_code, tip in self.color_swatches:
            c_btn = QPushButton()
            c_btn.setFixedSize(26, 26)
            c_btn.setCursor(Qt.CursorShape.PointingHandCursor)
            c_btn.setToolTip(tip)
            c_btn.setStyleSheet(f"""
                QPushButton {{
                    background-color: {hex_code};
                    border: 2px solid transparent;
                    border-radius: 13px;
                }}
                QPushButton:hover {{
                    border-color: #ffffff;
                }}
            """)
            c_btn.clicked.connect(lambda _, c=hex_code: self._select_color(c))
            color_row.addWidget(c_btn)
            self.color_buttons.append((c_btn, hex_code))

        # Custom color button
        self.custom_color_btn = QPushButton("Custom...")
        self.custom_color_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.custom_color_btn.setStyleSheet("""
            QPushButton {
                background-color: #262938;
                border: 1px solid #3b3f54;
                color: #e2e8f0;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
            }
            QPushButton:hover {
                border-color: #38bdf8;
                color: #ffffff;
            }
        """)
        self.custom_color_btn.clicked.connect(self._pick_custom_color)
        color_row.addWidget(self.custom_color_btn)
        color_row.addStretch()
        layout.addLayout(color_row)

        self.notif_check = QCheckBox("Enable desktop notifications for this service")
        self.notif_check.setChecked(True)
        self.notif_check.setStyleSheet("color: #cbd5e1; margin-top: 6px;")
        layout.addWidget(self.notif_check)

        layout.addStretch()

        # Action Buttons
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()

        cancel_btn = QPushButton("Cancel")
        cancel_btn.setStyleSheet("""
            QPushButton {
                background-color: transparent;
                border: 1px solid #475569;
                color: #cbd5e1;
            }
            QPushButton:hover {
                background-color: #334155;
            }
        """)
        cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(cancel_btn)

        save_btn = QPushButton("Save Service")
        save_btn.setStyleSheet("""
            QPushButton {
                background-color: #2563eb;
                border: none;
                color: #ffffff;
            }
            QPushButton:hover {
                background-color: #1d4ed8;
            }
        """)
        save_btn.clicked.connect(self._save)
        btn_layout.addWidget(save_btn)

        layout.addLayout(btn_layout)

        # Fill if editing
        if self.editing_service:
            self.name_input.setText(self.editing_service.name)
            self.url_input.setText(self.editing_service.url)
            self.notif_check.setChecked(self.editing_service.notifications_enabled)
            idx = self.icon_combo.findData(self.editing_service.icon_type)
            if idx >= 0:
                self.icon_combo.setCurrentIndex(idx)
            self._select_color(self.editing_service.custom_color or "#25D366")
        else:
            self._apply_preset(PRESETS[0])

    def _select_color(self, hex_code: str):
        self.selected_color = hex_code
        for btn, h in self.color_buttons:
            if h.lower() == hex_code.lower():
                btn.setStyleSheet(f"""
                    QPushButton {{
                        background-color: {h};
                        border: 2px solid #ffffff;
                        border-radius: 13px;
                    }}
                """)
            else:
                btn.setStyleSheet(f"""
                    QPushButton {{
                        background-color: {h};
                        border: 2px solid transparent;
                        border-radius: 13px;
                    }}
                    QPushButton:hover {{
                        border-color: #ffffff;
                    }}
                """)
        self._update_icon_preview()

    def _pick_custom_color(self):
        color = QColorDialog.getColor(QColor(self.selected_color), self, "Select Custom Icon Color")
        if color.isValid():
            self._select_color(color.name())

    def _update_icon_preview(self):
        icon_type = self.icon_combo.currentData() or "generic"
        icon_path = ICONS_DIR / f"{icon_type}.svg"
        if not icon_path.exists():
            icon_path = ICONS_DIR / "generic.svg"

        content = icon_path.read_text(encoding="utf-8")
        if self.selected_color:
            for default_color in ["#25D366", "#229ED9", "#5865F2", "#4A154B", "#FF0000", "#1DB954", "#334155"]:
                if default_color.lower() in content.lower():
                    content = content.replace(default_color, self.selected_color).replace(default_color.lower(), self.selected_color)
                    break

        renderer = QSvgRenderer(QByteArray(content.encode("utf-8")))
        pixmap = QPixmap(28, 28)
        pixmap.fill(Qt.GlobalColor.transparent)
        painter = QPainter(pixmap)
        if renderer.isValid():
            renderer.render(painter)
        painter.end()
        self.preview_label.setPixmap(pixmap)

    def _on_preset_dropdown_changed(self, index: int):
        preset = self.preset_combo.itemData(index)
        if preset:
            self._apply_preset(preset)

    def _apply_preset(self, preset):
        self.name_input.setText(preset["name"])
        self.url_input.setText(preset["url"])
        idx = self.icon_combo.findData(preset["icon_type"])
        if idx >= 0:
            self.icon_combo.setCurrentIndex(idx)
        if preset["icon_type"] == "whatsapp":
            self._select_color("#25D366")
        elif preset["icon_type"] == "spotify":
            self._select_color("#1DB954")
        elif preset["icon_type"] == "youtube":
            self._select_color("#FF0000")
        elif preset["icon_type"] == "telegram":
            self._select_color("#229ED9")
        elif preset["icon_type"] == "discord":
            self._select_color("#5865F2")
        elif preset["icon_type"] == "slack":
            self._select_color("#4A154B")
        else:
            self._select_color("#3b82f6")

    def _save(self):
        name = self.name_input.text().strip()
        url = self.url_input.text().strip()
        icon_type = self.icon_combo.currentData()
        notif_enabled = self.notif_check.isChecked()

        if not name or not url:
            return

        if self.editing_service:
            self.editing_service.name = name
            self.editing_service.url = url
            self.editing_service.icon_type = icon_type
            self.editing_service.custom_color = self.selected_color
            self.editing_service.notifications_enabled = notif_enabled
            self.service_created.emit(self.editing_service)
        else:
            service_id = f"{icon_type}_{uuid.uuid4().hex[:6]}"
            new_service = ServiceConfig(
                id=service_id,
                name=name,
                url=url,
                icon_type=icon_type,
                custom_color=self.selected_color,
                notifications_enabled=notif_enabled,
            )
            self.service_created.emit(new_service)

        self.accept()
