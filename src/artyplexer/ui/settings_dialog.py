import shutil
from typing import List
from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QDialog,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QCheckBox,
    QTabWidget,
    QWidget,
    QListWidget,
    QListWidgetItem,
    QMessageBox,
)
from artyplexer.models import AppSettings, ServiceConfig
from artyplexer.config import ConfigManager


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
        self.setStyleSheet("""
            QDialog {
                background-color: #1e1f29;
                color: #e2e8f0;
            }
            QTabWidget::pane {
                border: 1px solid #333846;
                background-color: #181920;
                border-radius: 6px;
            }
            QTabBar::tab {
                background-color: #262938;
                color: #94a3b8;
                padding: 10px 18px;
                border-top-left-radius: 6px;
                border-top-right-radius: 6px;
                margin-right: 2px;
                font-weight: 500;
                font-size: 13px;
            }
            QTabBar::tab:selected {
                background-color: #181920;
                color: #38bdf8;
                font-weight: bold;
            }
            QCheckBox {
                color: #e2e8f0;
                font-size: 13px;
                spacing: 10px;
                padding: 4px 0;
            }
            QPushButton {
                background-color: #262938;
                border: 1px solid #3b3f54;
                color: #ffffff;
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 13px;
            }
            QPushButton:hover {
                background-color: #33384c;
            }
        """)

        self._init_ui()

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

        gen_layout.addStretch()
        tabs.addTab(general_tab, "General")

        # Tab 2: Services
        services_tab = QWidget()
        svc_layout = QVBoxLayout(services_tab)
        svc_layout.setContentsMargins(16, 16, 16, 16)
        svc_layout.setSpacing(10)

        svc_layout.addWidget(QLabel("Active configured services:"))
        self.service_list = QListWidget()
        self.service_list.setStyleSheet("""
            QListWidget {
                background-color: #262938;
                border: 1px solid #333846;
                border-radius: 6px;
                color: #e2e8f0;
                padding: 4px;
            }
            QListWidget::item {
                padding: 8px;
                border-bottom: 1px solid #2d3240;
            }
        """)
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

        about_title = QLabel("Artyplexer v0.1.0")
        about_title.setStyleSheet("font-size: 16px; font-weight: bold; color: #38bdf8;")
        about_layout.addWidget(about_title)

        about_desc = QLabel(
            "Modern, fast, and ultra-lightweight Ferdium alternative.\n"
            "Built with Python, PySide6, and Chromium (Qt WebEngine).\n\n"
            "• Isolated sessions with QWebEngineProfile\n"
            "• Full compatibility with WhatsApp Web, Telegram, Discord\n"
            "• Low idle resource consumption without Electron overhead"
        )
        about_desc.setStyleSheet("color: #94a3b8; font-size: 13px; line-height: 1.5;")
        about_layout.addWidget(about_desc)
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

    def _save(self):
        self.settings.minimize_to_tray = self.tray_check.isChecked()
        self.settings.start_minimized = self.start_min_check.isChecked()
        self.settings.global_dnd = self.dnd_check.isChecked()
        self.config_manager.settings = self.settings
        self.config_manager.save()
        self.settings_changed.emit(self.settings)
        self.accept()
