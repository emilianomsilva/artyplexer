# Artyplexer

> Alternativa leve e moderna ao Ferdium, focada no WhatsApp, Telegram e ferramentas de mensagens.

Construído em Python com **PySide6** e motor **Chromium (Qt6 WebEngine)**.

## Características

- **Múltiplas instâncias do WhatsApp**: Execute contas pessoais, de trabalho e de suporte no mesmo app sem conflito de cookies ou sessões.
- **Isolamento total de perfis**: Cada serviço tem sua própria pasta em `~/.local/share/artyplexer/profiles/` com cookies e LocalStorage persistentes.
- **Aparência inspirada no Ferdium**: Barra lateral escura, moderna e compacta com indicador de serviço ativo e badges de mensagens não lidas.
- **Bandeja do Sistema (System Tray)**:
  - Ícone dinâmico com contador de não lidas.
  - Menu de contexto rápido para alternar entre contas, ativar Não Perturbe ou fechar.
  - Minimizar para a bandeja ao fechar janela.
- **Sistema de Notificações**: Notificações nativas do sistema operacional ao receber novas mensagens.
- **Atalhos Rápidos**:
  - `Ctrl+1` a `Ctrl+9`: Alternar entre contas e serviços.
  - `Ctrl+N`: Adicionar novo serviço.
  - `Ctrl+R`: Recarregar serviço atual.
  - `F11`: Alternar tela cheia.
- **Compilável como Instalador / Binário Único**: Script pronto com PyInstaller para empacotar em um executável nativo.

## Instalação e Desenvolvimento com UV

```bash
# 1. Criar ambiente virtual com Python 3.12 (ou 3.11)
uv venv --python 3.12 .venv

# 2. Instalar dependências em modo editável
uv pip install -e .

# 3. Executar o Artyplexer
.venv/bin/artyplexer
# ou
uv run artyplexer
```

## Como Compilar como Executável / Instalador

Para gerar um binário independente que não precisa do Python instalado:

```bash
.venv/bin/python build_installer.py
```

O executável final estará pronto em `dist/artyplexer/artyplexer`.
