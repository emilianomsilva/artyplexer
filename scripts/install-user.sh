#!/usr/bin/env bash
# Install the Linux bundle for the current user.
set -euo pipefail
cd "$(dirname "$0")/.."

data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
app_root="$data_home/artyplexer"
desktop_dir="$data_home/applications"
icon_dir="$data_home/icons/hicolor/512x512/apps"
bin_dir="${XDG_BIN_HOME:-$HOME/.local/bin}"
bundle="$PWD/dist/linux-unpacked"
sandbox_helper="${ARTYPLEXER_CHROME_SANDBOX:-}"

if [[ ! -x "$bundle/artyplexer" || ! -f build/icon.png ]]; then
  echo "Build the Linux bundle first with npm run pack." >&2
  exit 1
fi
if [[ -n "$sandbox_helper" ]] &&
   [[ "$sandbox_helper" != /* || ! -x "$sandbox_helper" || ! -u "$sandbox_helper" || "$(stat -Lc %u "$sandbox_helper")" != 0 ]]; then
  echo "ARTYPLEXER_CHROME_SANDBOX must point to a root-owned, setuid Chromium sandbox helper." >&2
  exit 1
fi

mkdir -p "$app_root" "$desktop_dir" "$icon_dir" "$bin_dir"
stage="$(mktemp -d "$app_root/.install-XXXXXX")"
trap 'rm -rf -- "$stage"' EXIT
cp -a "$bundle" "$stage/app"
install -m 644 build/icon.png "$stage/app/launcher-icon.png"
if [[ -n "$sandbox_helper" ]]; then
  ln -sfn -- "$sandbox_helper" "$stage/app/chrome-sandbox"
fi

cat > "$stage/artyplexer.desktop" <<DESKTOP
[Desktop Entry]
Name=Artyplexer
Comment=Desktop workspace for WhatsApp, Telegram and web messaging
Exec="$app_root/app/artyplexer"
Icon=$app_root/app/launcher-icon.png
Terminal=false
Type=Application
Categories=Network;InstantMessaging;Chat;
StartupNotify=true
StartupWMClass=artyplexer
DESKTOP
if command -v desktop-file-validate >/dev/null; then
  desktop-file-validate "$stage/artyplexer.desktop"
fi

if [[ -d "$app_root/app" ]]; then
  mv -T -- "$app_root/app" "$stage/previous"
fi
if ! mv -T -- "$stage/app" "$app_root/app"; then
  if [[ -d "$stage/previous" ]]; then
    mv -T -- "$stage/previous" "$app_root/app"
  fi
  exit 1
fi
install -m 644 build/icon.png "$icon_dir/artyplexer.png"
install -m 644 "$stage/artyplexer.desktop" "$desktop_dir/artyplexer.desktop"
ln -sfn -- "$app_root/app/artyplexer" "$bin_dir/artyplexer"
if command -v gtk-update-icon-cache >/dev/null; then
  gtk-update-icon-cache -f -t "$data_home/icons/hicolor"
fi
if command -v update-desktop-database >/dev/null; then
  update-desktop-database "$desktop_dir"
fi

echo "Artyplexer installed. Launch it from the app menu or run artyplexer."
