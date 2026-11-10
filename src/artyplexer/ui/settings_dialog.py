import shutil
from pathlib import Path
from PySide6.QtCore import Qt, Signal, QStandardPaths
from PySide6.QtWidgets import (
    QDialog,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QCheckBox,
    QComboBox,
    QLineEdit,
    QFileDialog,
    QTabWidget,
    QWidget,
    QListWidget,
    QListWidgetItem,
    QMessageBox,
)
from artyplexer.models import AppSettings
from artyplexer.config import ConfigManager, ICONS_DIR
from artyplexer.ui.theme import theme_colors


class SettingsDialog(QDialog):
    settings_changed = Signal(AppSettings)
    service_deleted = Signal(str)

    def __init__(self, config_manager: ConfigManager, parent=None):
        super().__init__(parent)
        self.config_manager = config_manager
        self.settings = config_manager.settings
        self.setWindowTitle("Settings - Artyplexer")
        self.setMinimumSize(560, 480)
        self.resize(600, 520)
        self.dark = True

        self._init_ui()
        self.apply_theme(True)

    def apply_theme(self, dark: bool):
        self.dark = dark
        c = theme_colors(dark)
        chevron = (ICONS_DIR / "chevron-down.svg").as_posix()
        self.setStyleSheet(f"""
            QDialog {{
                background-color: {c['panel']};
                color: {c['text']};
            }}
            QLabel {{
                color: {c['text']};
            }}
            QLineEdit {{
                background-color: {c['surface']};
                border: 1px solid {c['border']};
                border-radius: 6px;
                padding: 6px 12px;
                color: {c['text']};
                font-size: 13px;
            }}
            QTabWidget::pane {{
                border: 1px solid {c['border']};
                background-color: {c['window']};
                border-radius: 6px;
            }}
            QTabBar::tab {{
                background-color: {c['surface']};
                color: {c['muted']};
                padding: 10px 18px;
                border-top-left-radius: 6px;
                border-top-right-radius: 6px;
                margin-right: 2px;
                font-weight: 500;
                font-size: 13px;
            }}
            QTabBar::tab:selected {{
                background-color: {c['window']};
                color: {c['accent']};
                font-weight: bold;
            }}
            QCheckBox {{
                color: {c['text']};
                font-size: 13px;
                spacing: 10px;
                padding: 4px 0;
            }}
            QComboBox {{
                background-color: {c['surface']};
                border: 1px solid {c['border']};
                border-radius: 6px;
                padding: 6px 12px;
                min-height: 22px;
                color: {c['text']};
                font-size: 13px;
            }}
            QComboBox::drop-down {{
                border: none;
                width: 26px;
            }}
            QComboBox::down-arrow {{
                image: url("{chevron}");
                width: 14px;
                height: 14px;
            }}
            QComboBox QAbstractItemView {{
                background-color: {c['panel']};
                color: {c['text']};
                selection-background-color: {c['selection']};
                selection-color: {c['selection_text']};
                border: 1px solid {c['border']};
            }}
            QPushButton {{
                background-color: {c['surface']};
                border: 1px solid {c['border']};
                color: {c['text']};
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 13px;
            }}
            QPushButton:hover {{
                background-color: {c['surface_hover']};
            }}
        """)
        self.service_list.setStyleSheet(f"""
            QListWidget {{
                background-color: {c['surface']};
                border: 1px solid {c['border']};
                border-radius: 6px;
                color: {c['text']};
                padding: 4px;
            }}
            QListWidget::item {{
                padding: 8px;
                border-bottom: 1px solid {c['separator']};
            }}
            QListWidget::item:selected {{
                background-color: {c['selection']};
                color: {c['selection_text']};
            }}
        """)
        self.about_title.setStyleSheet(
            f"font-size: 16px; font-weight: bold; color: {c['accent']};"
        )
        self.about_desc.setStyleSheet(f"color: {c['muted']}; font-size: 13px; line-height: 1.5;")

    def _init_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(16, 16, 16, 16)
        main_layout.setSpacing(12)

        tabs = QTabWidget()

        # Tab 1: General
        general_tab = QWidget()
        gen_layout = QVBoxLayout(general_tab)
        gen_layout.setContentsMargins(16, 16, 16, 16)
        gen_layout.setSpacing(14)

        self.tray_check = QCheckBox("Minimize to system tray when closing the window")
        self.tray_check.setChecked(self.settings.minimize_to_tray)
        gen_layout.addWidget(self.tray_check)

        self.start_min_check = QCheckBox("Start minimized in system tray")
        self.start_min_check.setChecked(self.settings.start_minimized)
        gen_layout.addWidget(self.start_min_check)

        self.dnd_check = QCheckBox("Global Do Not Disturb (Mute all notifications and sounds)")
        self.dnd_check.setChecked(self.settings.global_dnd)
        gen_layout.addWidget(self.dnd_check)

        gen_layout.addSpacing(10)
        gen_layout.addWidget(QLabel("Appearance:"))
        self.theme_combo = QComboBox()
        self.theme_combo.addItem("Follow system", "system")
        self.theme_combo.addItem("Light", "light")
        self.theme_combo.addItem("Dark", "dark")
        theme_index = self.theme_combo.findData(self.settings.theme_mode)
        self.theme_combo.setCurrentIndex(max(0, theme_index))
        gen_layout.addWidget(self.theme_combo)

        gen_layout.addStretch()
        tabs.addTab(general_tab, "General")

        # Tab 2: Downloads
        downloads_tab = QWidget()
        dl_layout = QVBoxLayout(downloads_tab)
        dl_layout.setContentsMargins(16, 16, 16, 16)
        dl_layout.setSpacing(14)

        dl_layout.addWidget(QLabel("Default download location:"))
        path_row = QHBoxLayout()
        path_row.setSpacing(8)

        default_dl = (
            self.settings.download_dir
            or QStandardPaths.writableLocation(QStandardPaths.StandardLocation.DownloadLocation)
            or str(Path.home() / "Downloads")
        )

        self.dl_path_edit = QLineEdit(default_dl)
        self.dl_path_edit.setReadOnly(True)
        path_row.addWidget(self.dl_path_edit)

        browse_btn = QPushButton("Browse...")
        browse_btn.clicked.connect(self._browse_download_dir)
        path_row.addWidget(browse_btn)

        reset_btn = QPushButton("Reset")
        reset_btn.setToolTip("Reset to system default Downloads folder")
        reset_btn.clicked.connect(self._reset_download_dir)
        path_row.addWidget(reset_btn)

        dl_layout.addLayout(path_row)
        dl_layout.addSpacing(10)

        self.always_ask_check = QCheckBox("Always ask where to save each file before downloading")
        self.always_ask_check.setChecked(self.settings.always_ask_download)
        dl_layout.addWidget(self.always_ask_check)

        self.notify_dl_check = QCheckBox("Show system notification when a download completes")
        self.notify_dl_check.setChecked(self.settings.notify_download_complete)
        dl_layout.addWidget(self.notify_dl_check)

        dl_layout.addStretch()
        tabs.addTab(downloads_tab, "Downloads")

        # Tab 3: Services
        services_tab = QWidget()
        svc_layout = QVBoxLayout(services_tab)
        svc_layout.setContentsMargins(16, 16, 16, 16)
        svc_layout.setSpacing(10)

        svc_layout.addWidget(QLabel("Active configured services:"))
        self.service_list = QListWidget()
        for s in self.config_manager.services:
            item = QListWidgetItem(f"{s.name} ({s.url})")
            item.setData(Qt.ItemDataRole.UserRole, s.id)
            self.service_list.addItem(item)
        svc_layout.addWidget(self.service_list)

        btn_row = QHBoxLayout()
        clear_cache_btn = QPushButton("Clear Service Data/Session")
        clear_cache_btn.clicked.connect(self._clear_selected_service_cache)
        btn_row.addWidget(clear_cache_btn)

        del_svc_btn = QPushButton("Delete Selected Service")
        del_svc_btn.setStyleSheet("color: #ef4444; border-color: #ef4444;")
        del_svc_btn.clicked.connect(self._delete_selected_service)
        btn_row.addWidget(del_svc_btn)

        svc_layout.addLayout(btn_row)
        tabs.addTab(services_tab, "Services")

        # Tab 3: About
        about_tab = QWidget()
        about_layout = QVBoxLayout(about_tab)
        about_layout.setContentsMargins(16, 16, 16, 16)
        about_layout.setSpacing(12)

        self.about_title = QLabel("Artyplexer v0.1.0")
        about_layout.addWidget(self.about_title)

        self.about_desc = QLabel(
            "Simple, modern, fast, and ultra-lightweight multiplexer alternative.\n"
            "Built with Python, PySide6, and Chromium (Qt WebEngine).\n\n"
            "• Isolated sessions with QWebEngineProfile\n"
            "• Full compatibility with WhatsApp Web, Telegram, Discord\n"
            "• Low idle resource consumption without Electron overhead"
        )
        about_layout.addWidget(self.about_desc)
        about_layout.addStretch()

        tabs.addTab(about_tab, "About")

        main_layout.addWidget(tabs)

        # Bottom buttons
        bottom_layout = QHBoxLayout()
        bottom_layout.addStretch()

        save_btn = QPushButton("Save Settings")
        save_btn.setStyleSheet("""
            QPushButton {
                background-color: #2563eb;
                border: none;
                color: #ffffff;
                font-weight: bold;
                padding: 8px 18px;
            }
            QPushButton:hover {
                background-color: #1d4ed8;
            }
        """)
        save_btn.clicked.connect(self._save)
        bottom_layout.addWidget(save_btn)

        main_layout.addLayout(bottom_layout)

    def _clear_selected_service_cache(self):
        item = self.service_list.currentItem()
        if not item:
            return
        service_id = item.data(Qt.ItemDataRole.UserRole)
        confirm = QMessageBox.question(
            self,
            "Clear Data",
            "Are you sure you want to clear all saved cookies and data for this service? You will need to sign in again.",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )
        if confirm == QMessageBox.StandardButton.Yes:
            profile_dir = self.config_manager.get_service_profile_dir(service_id)
            if profile_dir.exists():
                shutil.rmtree(profile_dir, ignore_errors=True)
            QMessageBox.information(self, "Success", "Service data cleared successfully.")

    def _delete_selected_service(self):
        item = self.service_list.currentItem()
        if not item:
            return
        service_id = item.data(Qt.ItemDataRole.UserRole)
        confirm = QMessageBox.question(
            self,
            "Delete Service",
            "Are you sure you want to delete the selected service?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )
        if confirm == QMessageBox.StandardButton.Yes:
            self.service_deleted.emit(service_id)
            row = self.service_list.row(item)
            self.service_list.takeItem(row)

    def _browse_download_dir(self):
        current = self.dl_path_edit.text()
        chosen = QFileDialog.getExistingDirectory(self, "Select Download Directory", current)
        if chosen:
            self.dl_path_edit.setText(chosen)

    def _reset_download_dir(self):
        default_dl = (
            QStandardPaths.writableLocation(QStandardPaths.StandardLocation.DownloadLocation)
            or str(Path.home() / "Downloads")
        )
        self.dl_path_edit.setText(default_dl)

    def _save(self):
        self.settings.minimize_to_tray = self.tray_check.isChecked()
        self.settings.start_minimized = self.start_min_check.isChecked()
        self.settings.global_dnd = self.dnd_check.isChecked()
        self.settings.theme_mode = self.theme_combo.currentData() or "system"

        # Downloads settings
        chosen_dl = self.dl_path_edit.text().strip()
        default_dl = (
            QStandardPaths.writableLocation(QStandardPaths.StandardLocation.DownloadLocation)
            or str(Path.home() / "Downloads")
        )
        self.settings.download_dir = chosen_dl if chosen_dl and chosen_dl != default_dl else None
        self.settings.always_ask_download = self.always_ask_check.isChecked()
        self.settings.notify_download_complete = self.notify_dl_check.isChecked()

        self.config_manager.settings = self.settings
        self.config_manager.save()
        self.settings_changed.emit(self.settings)
        self.accept()
