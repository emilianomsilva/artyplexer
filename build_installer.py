#!/usr/bin/env python3
"""
Artyplexer Installer & Standalone Binary Builder
Uses PyInstaller to bundle Artyplexer into a standalone desktop application.
"""

import os
import sys
import subprocess
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent
DIST_DIR = ROOT_DIR / "dist"
RESOURCES_DIR = ROOT_DIR / "resources"


def build_binary():
    print("🚀 Iniciando compilação do Artyplexer com PyInstaller...")

    is_windows = sys.platform.startswith("win")
    is_linux = sys.platform.startswith("linux")

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--name=artyplexer",
        "--windowed",
        "--noconfirm",
        "--clean",
        f"--add-data={RESOURCES_DIR}{os.pathsep}resources",
        "--collect-all=PySide6",
        "--collect-all=PySide6.QtWebEngineWidgets",
        "--collect-all=PySide6.QtWebEngineCore",
        "--collect-all=PySide6.QtSvg",
    ]

    ico_path = RESOURCES_DIR / "icons" / "app.ico"
    png_path = RESOURCES_DIR / "icons" / "app.png"
    if is_windows and ico_path.exists():
        cmd.append(f"--icon={ico_path}")
    elif is_linux and png_path.exists():
        cmd.append(f"--icon={png_path}")

    cmd.append(str(ROOT_DIR / "src" / "artyplexer" / "main.py"))

    print(f"Executando: {' '.join(cmd)}")
    result = subprocess.run(cmd)

    if result.returncode != 0:
        print("❌ Erro durante a compilação do executável.", file=sys.stderr)
        sys.exit(result.returncode)

    exe_name = "artyplexer.exe" if is_windows else "artyplexer"
    print("\n✅ Compilação concluída com sucesso!")
    print(f"📂 O executável compilado está em: {DIST_DIR / 'artyplexer' / exe_name}")

    if is_linux:
        generate_desktop_entry()


def generate_desktop_entry():
    desktop_file_path = DIST_DIR / "artyplexer.desktop"
    exec_path = (DIST_DIR / "artyplexer" / "artyplexer").resolve()
    icon_path = (RESOURCES_DIR / "icons" / "app.svg").resolve()

    content = f"""[Desktop Entry]
Name=Artyplexer
Comment=Multiplexer leve para WhatsApp, Telegram e Mensagens
Exec={exec_path}
Icon={icon_path}
Terminal=false
Type=Application
Categories=Network;InstantMessaging;Chat;
StartupNotify=true
"""
    with open(desktop_file_path, "w", encoding="utf-8") as f:
        f.write(content)

    desktop_file_path.chmod(0o755)
    print(f"📄 Arquivo de atalho para Linux gerado em: {desktop_file_path}")
    print("\nPara instalar no seu sistema após testar, basta rodar:")
    print(f"  cp {desktop_file_path} ~/.local/share/applications/")


if __name__ == "__main__":
    build_binary()
