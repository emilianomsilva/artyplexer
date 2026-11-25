# Artyplexer

<p align="center">
  <img src="frontend/public/artyplexer.png" alt="Artyplexer app icon" width="96" height="96">
</p>

**English (US)** · [Português (Brasil)](README.pt-BR.md)

![Electron 45](https://img.shields.io/badge/Electron-45-47848F?logo=electron)
![Chromium 156](https://img.shields.io/badge/Chromium-156-356AC3)
![Node.js 22](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
![Svelte 4](https://img.shields.io/badge/Svelte-4-FF3E00?logo=svelte&logoColor=white)
![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite 5](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Rust 2024](https://img.shields.io/badge/Rust-2024-333333?logo=rust)
![GitHub Actions](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=githubactions&logoColor=white)

Artyplexer brings WhatsApp, Telegram, Discord, Slack, and other web services together in a single desktop window. Each service has its own persistent session. The interface defaults to US English and includes a Brazilian Portuguese translation.

- Press `Ctrl+K` to search for services or `Ctrl+1` through `Ctrl+9` to switch directly. Drag sidebar icons to change their order.
- Press `Ctrl+J` to open downloads or `Ctrl+Shift+B` to toggle the navigation bar.
- Hibernate a service from its context menu to free resources. Automatic hibernation is off by default and its timeout can be configured in Settings.

On macOS, use Command in place of Ctrl.

## Stack

| Layer | Technologies | Responsibility |
| --- | --- | --- |
| Desktop app ([`electron/`](electron/)) | Electron 45, Chromium 156, JavaScript, and embedded Node.js | Windows, system tray, webviews, per-service sessions, and IPC |
| Interface ([`frontend/`](frontend/)) | Svelte 4, TypeScript 5, Vite 5, and CSS | Sidebar, navigation, settings, downloads, and translation catalogs |
| Media helper ([`rust-helper/`](rust-helper/)) | Rust (2024 edition), Cargo, Serde, and serde_json | Temporary media storage and JSON communication with Electron over standard input and output |
| Development tools | Node.js 22, npm, svelte-check, and Cargo | Dependency installation, type checking, and testing |
| Packaging and CI | electron-builder 26 and GitHub Actions | DEB packages for Linux, NSIS installers for Windows, and DMG images for macOS |

## Development

Install Node.js 22 with npm and the stable Rust toolchain with Cargo.

```sh
npm ci
npm --prefix frontend ci
npm run build
npm start
```

```sh
npm --prefix frontend run check
cargo test --manifest-path rust-helper/Cargo.toml
npm test
```

`npm test` runs migration tests and an Electron smoke test with a temporary profile. The smoke test needs a graphical session.

## Packaging and installation

- **Linux** · `npm run dist` generates a `.deb` file in `dist/`. For a per-user installation, run `npm run pack` followed by `./scripts/install-user.sh`.
- **Windows** · `npm run dist:win` generates an NSIS installer in `dist/`.
- **macOS** · `npm run dist:mac` generates a DMG in `dist/` for the build Mac's architecture. CI builds use ad-hoc signing and lack Apple notarization, so Gatekeeper may block them.

The [Build Installers](https://github.com/emilianomsilva/artyplexer/actions/workflows/build.yml) workflow builds packages for Linux x64, Windows x64, Intel Macs, and Apple Silicon Macs.

On Linux systems that restrict user namespaces, use the system package or set `ARTYPLEXER_CHROME_SANDBOX` for the per-user installer to the path of a compatible, root-owned Chromium helper with the setuid bit enabled.

## Local data

On Linux the app stores settings and data in `${XDG_DATA_HOME:-~/.local/share}/artyplexer/data` and Chromium profiles in `${XDG_CONFIG_HOME:-~/.config}/artyplexer/electron`. Set `ARTYPLEXER_DATA_DIR` to run with an isolated profile.

On first launch, Artyplexer can import settings, icons, temporary media, and session partitions from an Ironplexer installation. Close Ironplexer before importing.
