# Artyplexer

<p align="center">
  <img src="frontend/public/artyplexer.png" alt="Ícone do Artyplexer" width="96" height="96">
</p>

[English (US)](README.md) · **Português (Brasil)**

![Electron 45](https://img.shields.io/badge/Electron-45-47848F?logo=electron)
![Chromium 156](https://img.shields.io/badge/Chromium-156-356AC3)
![Node.js 22](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
![Svelte 4](https://img.shields.io/badge/Svelte-4-FF3E00?logo=svelte&logoColor=white)
![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite 5](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Rust 2024](https://img.shields.io/badge/Rust-2024-333333?logo=rust)
![GitHub Actions](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=githubactions&logoColor=white)

Aplicativo desktop para reunir WhatsApp, Telegram, Discord, Slack e outros serviços web em uma janela. Cada serviço tem uma sessão persistente independente. A interface abre em inglês (EUA) e inclui tradução para português do Brasil.

- Abra a busca de serviços com `Ctrl+K` e acesse os primeiros nove com `Ctrl+1` a `Ctrl+9`. Arraste os ícones da barra lateral para mudar a ordem.
- Abra os downloads com `Ctrl+J` ou alterne a barra de navegação com `Ctrl+Shift+B`.
- Hiberne serviços pelo menu de contexto para liberar recursos. A hibernação automática é opcional e o intervalo pode ser configurado em Settings.

No macOS, use Command no lugar de Ctrl.

## Stack

| Camada | Tecnologias | Responsabilidade |
| --- | --- | --- |
| Aplicativo desktop ([`electron/`](electron/)) | Electron 45, Chromium 156, JavaScript e Node.js embutido | Janelas, bandeja, webviews, sessões por serviço e comunicação IPC com a interface |
| Interface ([`frontend/`](frontend/)) | Svelte 4, TypeScript 5, Vite 5 e CSS | Barra lateral, navegação, configurações, downloads e catálogos de tradução |
| Auxiliar de mídia ([`rust-helper/`](rust-helper/)) | Rust (edição 2024), Cargo, Serde e serde_json | Armazenamento temporário de mídia e comunicação com o Electron por JSON via entrada e saída padrão |
| Ferramentas de desenvolvimento | Node.js 22, npm, svelte-check e Cargo | Instalação de dependências, checagem de tipos e execução dos testes |
| Empacotamento e CI | electron-builder 26 e GitHub Actions | Geração de instaladores DEB para Linux, NSIS para Windows e DMG para macOS |

## Desenvolvimento

Instale o Node.js 22 com npm e a toolchain estável do Rust com Cargo.

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

`npm test` inclui testes de migração e um teste de integração do Electron com perfil temporário. O teste do Electron requer uma sessão gráfica.

## Empacotamento e instalação

- **Linux** · `npm run dist` gera um arquivo `.deb` em `dist/`. Para instalar apenas no usuário atual, execute `npm run pack` e depois `./scripts/install-user.sh`.
- **Windows** · `npm run dist:win` gera um instalador NSIS em `dist/`.

- **macOS** · `npm run dist:mac` gera um DMG em `dist/` para a arquitetura do Mac usado no build. Os builds de CI usam assinatura ad hoc, sem notarização da Apple, e o Gatekeeper pode bloquear a abertura.

O workflow [Build Installers](https://github.com/emilianomsilva/artyplexer/actions/workflows/build.yml) gera pacotes para Linux x64, Windows x64, macOS Intel e Apple Silicon.

No Linux, quando o sistema restringir namespaces de usuário, prefira o pacote de sistema ou configure `ARTYPLEXER_CHROME_SANDBOX` no instalador local com o caminho de um auxiliar Chromium compatível, com proprietário root e bit setuid ativo.

## Dados locais

No Linux, o app grava configuração e dados em `${XDG_DATA_HOME:-~/.local/share}/artyplexer/data` e os perfis Chromium em `${XDG_CONFIG_HOME:-~/.config}/artyplexer/electron`. Use `ARTYPLEXER_DATA_DIR` para executar com um perfil isolado.

O primeiro lançamento pode importar configurações, ícones, mídias temporárias e partições de sessão de uma instalação do Ironplexer. Feche o Ironplexer antes da importação.
