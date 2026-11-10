import sys
import os
import signal
from PySide6.QtCore import QCoreApplication
from PySide6.QtGui import QIcon, QGuiApplication
from PySide6.QtWidgets import QApplication
from PySide6.QtNetwork import QLocalSocket, QLocalServer
from artyplexer.config import ConfigManager, ICONS_DIR
from artyplexer.ui.main_window import MainWindow
from artyplexer.ui.theme import ThemeManager


def get_socket_name() -> str:
    uid = getattr(os, "getuid", lambda: "default")()
    return f"artyplexer_single_instance_{uid}"


def main():
    # Handle Ctrl+C in terminal
    signal.signal(signal.SIGINT, signal.SIG_DFL)

    # Use xcb (XWayland) on Linux for full system tray, focus & window restore support
    if "QT_QPA_PLATFORM" not in os.environ and os.name == "posix":
        os.environ["QT_QPA_PLATFORM"] = "xcb"

    # High DPI & desktop integration
    QCoreApplication.setOrganizationName("Artyplexer")
    QCoreApplication.setApplicationName("artyplexer")
    QGuiApplication.setDesktopFileName("artyplexer")

    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    app.setQuitOnLastWindowClosed(False)

    config_mgr = ConfigManager()
    theme_manager = ThemeManager(app, config_mgr.settings.theme_mode)

    socket_name = get_socket_name()

    # 1. Single Instance Check: Check if an instance is already running
    test_socket = QLocalSocket()
    test_socket.connectToServer(socket_name)
    if test_socket.waitForConnected(500):
        # Existing instance found! Send wake-up signal and exit
        test_socket.write(b"SHOW\n")
        test_socket.flush()
        test_socket.waitForBytesWritten(1000)
        test_socket.disconnectFromServer()
        sys.exit(0)

    # 2. Primary Instance: Start IPC server for single-instance control
    server = QLocalServer()
    # Remove stale socket file if previously crashed
    QLocalServer.removeServer(socket_name)
    if not server.listen(socket_name):
        print(f"Warning: Could not listen on IPC socket: {server.errorString()}", file=sys.stderr)

    # Set Application Icon
    icon_path = ICONS_DIR / "app.png"
    if not icon_path.exists():
        icon_path = ICONS_DIR / "app.svg"
    app_icon = QIcon(str(icon_path))
    app.setWindowIcon(app_icon)

    # Initialize configuration
    # Create Main Window
    window = MainWindow(config_mgr, theme_manager)

    # Handle incoming requests from secondary instances
    def on_new_connection():
        client = server.nextPendingConnection()
        if client:
            client.readyRead.connect(lambda: _handle_client(client))

    def _handle_client(client):
        try:
            client.readAll()
            window.show_and_activate()
        finally:
            client.disconnectFromServer()

    server.newConnection.connect(on_new_connection)

    if not config_mgr.settings.start_minimized:
        if config_mgr.settings.is_maximized:
            window.showMaximized()
        else:
            window.show()

    # Ensure tray icon is visible
    window.tray.show()

    exit_code = app.exec()
    server.close()
    QLocalServer.removeServer(socket_name)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
