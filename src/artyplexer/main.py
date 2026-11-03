import sys
import signal
from PySide6.QtCore import Qt, QCoreApplication
from PySide6.QtGui import QIcon
from PySide6.QtWidgets import QApplication
from artyplexer.config import ConfigManager, ICONS_DIR
from artyplexer.ui.main_window import MainWindow


def main():
    # Handle Ctrl+C in terminal
    signal.signal(signal.SIGINT, signal.SIG_DFL)

    # High DPI & Wayland / X11 compatibility
    QCoreApplication.setOrganizationName("Artyplexer")
    QCoreApplication.setApplicationName("Artyplexer")

    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    app.setQuitOnLastWindowClosed(False)

    # Set Application Icon
    app_icon = QIcon(str(ICONS_DIR / "app.svg"))
    app.setWindowIcon(app_icon)

    # Initialize configuration
    config_mgr = ConfigManager()

    # Create Main Window
    window = MainWindow(config_mgr)

    if not config_mgr.settings.start_minimized:
        window.show()

    # Ensure tray icon is visible
    window.tray.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
