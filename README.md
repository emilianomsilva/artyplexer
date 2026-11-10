# Artyplexer

<p align="center">
  <img src="resources/icons/app.svg" alt="Artyplexer Logo" width="88" height="88" />
</p>

<p align="center">
  <strong>Lightweight, modern desktop multiplexer for WhatsApp, Telegram, and web messaging tools.</strong>
  <br />
  <em>Zero Electron overhead, native system integration, and fully isolated profile environments.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Framework-PySide6%20%2F%20Qt6-41CD52?style=flat-square&logo=qt&logoColor=white" alt="PySide6" />
  <img src="https://img.shields.io/badge/Engine-Chromium%20WebEngine-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Chromium" />
  <img src="https://img.shields.io/badge/Package%20Manager-uv-DE5FE9?style=flat-square&logo=astral&logoColor=white" alt="uv" />
  <img src="https://img.shields.io/badge/Platform-Linux-FCC624?style=flat-square&logo=linux&logoColor=black" alt="Linux" />
</p>

---

## Features

- **Multi-Account & Multi-Instance**: Run multiple WhatsApp, Telegram, or custom web services simultaneously without session conflicts.
- **Isolated Profiles**: Strict data and session separation per service in `~/.local/share/artyplexer/profiles/`.
- **Integrated Download Manager**: Seamless support for chat exports, media, and document downloads with direct saving to `~/Downloads` (or custom folder) and completion notifications.
- **Adaptive Dark/Light Theme**: Automatically detects and syncs with system themes across Linux desktops (GNOME, KDE, XDG Portals), with manual override options.
- **System Tray Integration**:
  - Dynamic tray icon with unread message badges.
  - Global Do Not Disturb toggle.
  - Minimize-to-tray behavior on window close.
- **Native Desktop Notifications**: Integrated desktop alerts for incoming messages.
- **Fast Keyboard Shortcuts**:
  - `Ctrl+1` – `Ctrl+9`: Switch between accounts/services.
  - `Ctrl+N`: Add a new service.
  - `Ctrl+R`: Reload active service.
  - `F11`: Toggle fullscreen.
- **Resource Efficient**: Ultra-low idle memory footprint compared to Electron-based wrappers.

---

## Tech Stack

| Technology | Purpose |
| :--- | :--- |
| **[Python 3.10+](https://www.python.org/)** | Core application runtime & business logic |
| **[PySide6 (Qt6)](https://wiki.qt.io/Qt_for_Python)** | Native desktop UI, windowing, and widgets |
| **[QtWebEngine (Chromium)](https://doc.qt.io/qt-6/qtwebengine-index.html)** | Isolated web engine renderer & download pipeline |
| **[uv](https://github.com/astral-sh/uv)** | Next-generation Python package and virtualenv management |
| **[PyInstaller](https://pyinstaller.org/)** | Packaging into standalone executable binaries |

---

## Installation & Development

Artyplexer uses [`uv`](https://github.com/astral-sh/uv) for fast and reliable dependency management:

```bash
# 1. Create a virtual environment (Python 3.10+)
uv venv --python 3.12 .venv

# 2. Install dependencies in editable mode
uv pip install -e .

# 3. Launch Artyplexer
uv run artyplexer
```

---

## Build Standalone Executable

To generate a standalone desktop binary and `.desktop` entry via PyInstaller:

```bash
uv run python build_installer.py
```

The compiled binary will be placed in `dist/artyplexer/artyplexer`.
