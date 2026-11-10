# Artyplexer

> A lightweight, modern multiplexer alternative for WhatsApp, Telegram, and web messaging services, built with Python, PySide6, and Chromium (Qt6 WebEngine).

---

## Features

- **Multi-Account & Multi-Instance**: Run multiple WhatsApp, Telegram, or custom web services simultaneously without session conflicts.
- **Isolated Profiles**: Strict data and session separation per service in `~/.local/share/artyplexer/profiles/`.
- **Integrated Download Manager**: Seamless support for chat exports, media, and document downloads with direct saving to `~/Downloads` (or custom folder) and completion notifications.
- **Adaptive Dark/Light Theme**: Seamlessly detects and syncs with system themes across Linux desktops (GNOME, KDE, XDG Portals), with manual override options.
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
