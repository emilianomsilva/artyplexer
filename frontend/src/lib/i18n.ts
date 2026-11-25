/* Lightweight, zero-dependency i18n dictionary (en-US default, extensible). */
import { derived } from 'svelte/store';
import type { Readable } from 'svelte/store';
import { settings } from './store';
import type { SupportedLocale } from './electron';

export interface Messages {
  // App & feedback
  backendError: string;
  fileSavedIn: string;
  downloadFailed: string;
  mediaReadyToast: string;
  serviceAutoHibernated: string;

  // Sidebar & Quick Switcher
  sidebarAria: string;
  addNewService: string;
  quickSwitchTitle: string;
  quickSwitchPlaceholder: string;
  quickSwitchEmpty: string;
  quickSwitchHint: string;
  downloadsTitle: string;
  toggleNavBar: string;
  dndEnabledTitle: string;
  dndDisabledTitle: string;
  settingsTitle: string;
  hibernatedBadge: string;
  disabledBadge: string;
  audioPlayingClickMute: string;
  audioMutedClickUnmute: string;

  // Context Menu
  ctxReload: string;
  ctxHibernate: string;
  ctxWake: string;
  ctxDisable: string;
  ctxEnable: string;
  ctxMuteNotif: string;
  ctxUnmuteNotif: string;
  ctxMuteAudio: string;
  ctxUnmuteAudio: string;
  ctxChangeColor: string;
  ctxEdit: string;
  ctxDelete: string;
  notifMutedMsg: string;
  notifUnmutedMsg: string;
  serviceDeletedMsg: string;
  serviceHibernatedMsg: string;

  // Navigation Bar
  navBack: string;
  navForward: string;
  navReload: string;
  navHibernate: string;
  navOpenExternal: string;
  navHide: string;
  noActiveService: string;

  // Empty / Hibernated / Disabled Stage
  emptyStageTitle: string;
  emptyStageSubtitle: string;
  hibernatedStageTitle: string;
  hibernatedStageSubtitle: string;
  wakeServiceBtn: string;
  disabledStageTitle: string;
  disabledStageSubtitle: string;
  enableServiceBtn: string;
  loadingService: string;

  // Settings Dialog
  settingsHeader: string;
  tabGeneral: string;
  tabWorkspace: string;
  tabDownloads: string;
  tabServices: string;
  tabAbout: string;
  minimizeToTray: string;
  minimizeToTrayDesc: string;
  startMinimized: string;
  startMinimizedDesc: string;
  globalDnd: string;
  globalDndDesc: string;
  appearanceLabel: string;
  themeSystem: string;
  themeLight: string;
  themeDark: string;
  languageLabel: string;
  showNavBar: string;
  showNavBarDesc: string;
  autoHibernate: string;
  autoHibernateDesc: string;
  hibernateAfterLabel: string;
  hibernateMinutesUnit: string;
  downloadLocationLabel: string;
  systemDefaultFolder: string;
  browseBtn: string;
  resetBtn: string;
  resetFolderTitle: string;
  alwaysAskDownload: string;
  alwaysAskDownloadDesc: string;
  notifyDownloadComplete: string;
  notifyDownloadCompleteDesc: string;
  configuredServicesLabel: string;
  noServicesConfigured: string;
  clearSessionBtn: string;
  deleteServiceBtn: string;
  clearSessionConfirmTitle: string;
  clearSessionConfirmMsg: string;
  deleteServiceConfirmTitle: string;
  deleteServiceConfirmMsg: string;
  sessionClearedMsg: string;
  settingsSavedMsg: string;
  cancelBtn: string;
  closeBtn: string;
  confirmBtn: string;
  saveSettingsBtn: string;
  aboutSubtitle: string;
  aboutBullet1: string;
  aboutBullet2: string;
  aboutBullet3: string;
  shortcutsTitle: string;
  shortcutSwitch: string;
  shortcutQuick: string;
  shortcutNav: string;
  shortcutDownloads: string;
  shortcutNew: string;
  shortcutReload: string;

  // Service Dialog
  addServiceHeader: string;
  editServiceHeader: string;
  presetLabel: string;
  serviceNameLabel: string;
  serviceNamePlaceholder: string;
  serviceUrlLabel: string;
  fetchIconBtn: string;
  fetchIconTitle: string;
  iconCopiedMsg: string;
  enterValidUrlMsg: string;
  nameAndUrlRequiredMsg: string;
  iconTypeAndColorLabel: string;
  iconColorHint: string;
  customColorLabel: string;
  enableServiceNotif: string;
  enableServiceToggle: string;
  saveServiceBtn: string;
  drmWarningTitle: string;
  drmWarningMsg: string;
  addAnywayBtn: string;

  // Downloads Drawer & Video Modal
  downloadsHeader: string;
  downloadsEmpty: string;
  colFile: string;
  colService: string;
  colExpires: string;
  watchBtn: string;
  watchTitle: string;
  openPlayerBtn: string;
  openPlayerTitle: string;
  saveBtn: string;
  saveAsBtn: string;
  downloadsHint: string;
  couldNotOpenMsg: string;
  failedToSaveMsg: string;
}

export const LOCALES: Array<{ code: SupportedLocale; label: string }> = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
];

const EN_US: Messages = {
  backendError: 'Failed to communicate with backend',
  fileSavedIn: 'File saved to',
  downloadFailed: 'Download failed',
  mediaReadyToast: 'Media downloaded to temporary cache',
  serviceAutoHibernated: 'hibernated due to inactivity',

  sidebarAria: 'Services',
  addNewService: 'Add service (Ctrl+N)',
  quickSwitchTitle: 'Quick Switcher (Ctrl+K)',
  quickSwitchPlaceholder: 'Jump to a service by name or URL…',
  quickSwitchEmpty: 'No matching services found.',
  quickSwitchHint: '↑↓ navigate • Enter select • Esc close',
  downloadsTitle: 'Downloads (Ctrl+J)',
  toggleNavBar: 'Toggle navigation bar (Ctrl+Shift+B)',
  dndEnabledTitle: 'Do Not Disturb is ON (click to unmute)',
  dndDisabledTitle: 'Do Not Disturb (mute all notifications)',
  settingsTitle: 'Settings (Ctrl+,)',
  hibernatedBadge: 'Hibernating (click to wake)',
  disabledBadge: 'Disabled',
  audioPlayingClickMute: 'Playing audio (click to mute tab)',
  audioMutedClickUnmute: 'Tab audio muted (click to unmute)',

  ctxReload: 'Reload',
  ctxHibernate: 'Hibernate Service',
  ctxWake: 'Wake Service',
  ctxDisable: 'Disable Service',
  ctxEnable: 'Enable Service',
  ctxMuteNotif: 'Mute Notifications',
  ctxUnmuteNotif: 'Unmute Notifications',
  ctxMuteAudio: 'Mute Tab Audio',
  ctxUnmuteAudio: 'Unmute Tab Audio',
  ctxChangeColor: 'Change Accent Color…',
  ctxEdit: 'Edit Service…',
  ctxDelete: 'Delete Service',
  notifMutedMsg: 'Notifications muted for',
  notifUnmutedMsg: 'Notifications unmuted for',
  serviceDeletedMsg: 'Service deleted:',
  serviceHibernatedMsg: 'Hibernated',

  navBack: 'Back (Alt+Left)',
  navForward: 'Forward (Alt+Right)',
  navReload: 'Reload (Ctrl+R)',
  navHibernate: 'Hibernate service to free RAM',
  navOpenExternal: 'Open current page in browser',
  navHide: 'Hide navigation bar (Ctrl+Shift+B)',
  noActiveService: 'No active service',

  emptyStageTitle: 'Welcome to Artyplexer',
  emptyStageSubtitle: 'Add WhatsApp, Telegram, Discord, YouTube or any web workspace from the sidebar.',
  hibernatedStageTitle: 'Service is hibernating',
  hibernatedStageSubtitle: 'Unloaded from memory to keep Artyplexer fast and lightweight.',
  wakeServiceBtn: 'Wake Service',
  disabledStageTitle: 'Service is disabled',
  disabledStageSubtitle: 'Enable this service to load its isolated workspace.',
  enableServiceBtn: 'Enable Service',
  loadingService: 'Loading workspace…',

  settingsHeader: 'Settings',
  tabGeneral: 'General',
  tabWorkspace: 'Workspace & RAM',
  tabDownloads: 'Downloads',
  tabServices: 'Services',
  tabAbout: 'About',
  minimizeToTray: 'Minimize to system tray on close',
  minimizeToTrayDesc: 'Keep Artyplexer running silently in the background when closing the window.',
  startMinimized: 'Start minimized in system tray',
  startMinimizedDesc: 'Launch hidden in the tray without opening the main window.',
  globalDnd: 'Global Do Not Disturb',
  globalDndDesc: 'Silence all desktop notifications across every service.',
  appearanceLabel: 'Theme',
  themeSystem: 'Follow system',
  themeLight: 'Light',
  themeDark: 'Dark',
  languageLabel: 'Interface language',
  showNavBar: 'Show navigation bar',
  showNavBarDesc: 'Display a compact toolbar with Back, Forward, Reload and URL above workspaces.',
  autoHibernate: 'Auto-hibernate inactive services',
  autoHibernateDesc: 'Automatically unload idle background tabs to free Chromium RAM (never interrupts audio).',
  hibernateAfterLabel: 'Hibernate after inactivity',
  hibernateMinutesUnit: 'minutes',
  downloadLocationLabel: 'Default download folder',
  systemDefaultFolder: '(System Downloads folder)',
  browseBtn: 'Browse…',
  resetBtn: 'Reset',
  resetFolderTitle: 'Reset to system default Downloads folder',
  alwaysAskDownload: 'Always ask where to save files',
  alwaysAskDownloadDesc: 'Prompt for a destination path every time you save a file.',
  notifyDownloadComplete: 'Download completion notifications',
  notifyDownloadCompleteDesc: 'Show a system notification when a download finishes.',
  configuredServicesLabel: 'Configured workspaces',
  noServicesConfigured: 'No services configured yet.',
  clearSessionBtn: 'Clear Session & Cache',
  deleteServiceBtn: 'Delete Service',
  clearSessionConfirmTitle: 'Clear Service Session',
  clearSessionConfirmMsg: 'Clear all cookies, cache and local storage for "{name}"? You will need to sign in again.',
  deleteServiceConfirmTitle: 'Delete Service',
  deleteServiceConfirmMsg: 'Permanently delete "{name}" and wipe its isolated session data?',
  sessionClearedMsg: 'Service session cleared.',
  settingsSavedMsg: 'Settings saved.',
  cancelBtn: 'Cancel',
  closeBtn: 'Close',
  confirmBtn: 'Confirm',
  saveSettingsBtn: 'Save Settings',
  aboutSubtitle: 'Ferdium-inspired, ultra-lightweight desktop workspace multiplexer.',
  aboutBullet1: 'Isolated Chromium partitions per service (multi-account ready)',
  aboutBullet2: 'On-demand & idle tab hibernation for minimal RAM footprint',
  aboutBullet3: 'Rust sidecar media cache with built-in H.264, VP9, AV1 & Opus codecs',
  shortcutsTitle: 'Keyboard Shortcuts',
  shortcutSwitch: 'Switch to service 1–9',
  shortcutQuick: 'Quick Switcher',
  shortcutNav: 'Toggle navigation bar',
  shortcutDownloads: 'Toggle Downloads drawer',
  shortcutNew: 'Add new service',
  shortcutReload: 'Reload active service',

  addServiceHeader: 'Add New Service',
  editServiceHeader: 'Edit Service',
  presetLabel: 'Service Template',
  serviceNameLabel: 'Display Name',
  serviceNamePlaceholder: 'e.g. WhatsApp Work',
  serviceUrlLabel: 'Workspace URL',
  fetchIconBtn: 'Fetch Favicon',
  fetchIconTitle: 'Download the website favicon automatically',
  iconCopiedMsg: 'Favicon downloaded.',
  enterValidUrlMsg: 'Please enter a valid URL first.',
  nameAndUrlRequiredMsg: 'Service name and URL are required.',
  iconTypeAndColorLabel: 'Icon & Accent',
  iconColorHint: 'Accent Color (distinguish multiple accounts)',
  customColorLabel: 'Custom',
  enableServiceNotif: 'Desktop notifications',
  enableServiceToggle: 'Service enabled',
  saveServiceBtn: 'Save Service',
  drmWarningTitle: 'DRM-Protected Streaming Notice',
  drmWarningMsg: 'Services that require Google Widevine DRM (such as Spotify Web, Netflix or Prime Video) cannot play encrypted streams in standard Electron builds without Widevine CDM.\n\nDo you want to add it anyway?',
  addAnywayBtn: 'Add Anyway',

  downloadsHeader: 'Recent Media Downloads',
  downloadsEmpty: 'No photos or videos downloaded recently.',
  colFile: 'File',
  colService: 'Service',
  colExpires: 'Expires',
  watchBtn: 'Preview',
  watchTitle: 'Preview inside Artyplexer',
  openPlayerBtn: 'Open',
  openPlayerTitle: 'Open in system default player',
  saveBtn: 'Save',
  saveAsBtn: 'Save Copy…',
  downloadsHint: 'Preview uses built-in Chromium codecs; Open launches your system player. Temporary cache expires after 7 days.',
  couldNotOpenMsg: 'Could not open',
  failedToSaveMsg: 'Failed to save',
};

const PT_BR: Messages = {
  backendError: 'Falha ao comunicar com o backend',
  fileSavedIn: 'Arquivo salvo em',
  downloadFailed: 'Falha no download',
  mediaReadyToast: 'Mídia salva no cache temporário',
  serviceAutoHibernated: 'hibernado por inatividade',

  sidebarAria: 'Serviços',
  addNewService: 'Adicionar serviço (Ctrl+N)',
  quickSwitchTitle: 'Troca Rápida (Ctrl+K)',
  quickSwitchPlaceholder: 'Ir para um serviço por nome ou URL…',
  quickSwitchEmpty: 'Nenhum serviço correspondente.',
  quickSwitchHint: '↑↓ navegar • Enter abrir • Esc fechar',
  downloadsTitle: 'Downloads (Ctrl+J)',
  toggleNavBar: 'Alternar barra de navegação (Ctrl+Shift+B)',
  dndEnabledTitle: 'Não Perturbe ATIVO (clique para reativar som)',
  dndDisabledTitle: 'Não Perturbe (silenciar notificações)',
  settingsTitle: 'Configurações (Ctrl+,)',
  hibernatedBadge: 'Hibernando (clique para acordar)',
  disabledBadge: 'Desativado',
  audioPlayingClickMute: 'Reproduzindo áudio (clique para silenciar aba)',
  audioMutedClickUnmute: 'Áudio da aba silenciado (clique para reativar)',

  ctxReload: 'Recarregar',
  ctxHibernate: 'Hibernar Serviço',
  ctxWake: 'Acordar Serviço',
  ctxDisable: 'Desativar Serviço',
  ctxEnable: 'Ativar Serviço',
  ctxMuteNotif: 'Silenciar Notificações',
  ctxUnmuteNotif: 'Reativar Notificações',
  ctxMuteAudio: 'Silenciar Áudio da Aba',
  ctxUnmuteAudio: 'Reativar Áudio da Aba',
  ctxChangeColor: 'Alterar Cor do Ícone…',
  ctxEdit: 'Editar Serviço…',
  ctxDelete: 'Excluir Serviço',
  notifMutedMsg: 'Notificações silenciadas para',
  notifUnmutedMsg: 'Notificações reativadas para',
  serviceDeletedMsg: 'Serviço excluído:',
  serviceHibernatedMsg: 'Hibernado:',

  navBack: 'Voltar (Alt+Esquerda)',
  navForward: 'Avançar (Alt+Direita)',
  navReload: 'Recarregar (Ctrl+R)',
  navHibernate: 'Hibernar serviço para liberar RAM',
  navOpenExternal: 'Abrir página atual no navegador',
  navHide: 'Ocultar barra de navegação (Ctrl+Shift+B)',
  noActiveService: 'Nenhum serviço ativo',

  emptyStageTitle: 'Bem-vindo ao Artyplexer',
  emptyStageSubtitle: 'Adicione WhatsApp, Telegram, Discord, YouTube ou qualquer app web pela barra lateral.',
  hibernatedStageTitle: 'Serviço em hibernação',
  hibernatedStageSubtitle: 'Descarregado da memória para manter o Artyplexer leve e rápido.',
  wakeServiceBtn: 'Acordar Serviço',
  disabledStageTitle: 'Serviço desativado',
  disabledStageSubtitle: 'Ative este serviço para carregar sua sessão isolada.',
  enableServiceBtn: 'Ativar Serviço',
  loadingService: 'Carregando serviço…',

  settingsHeader: 'Configurações',
  tabGeneral: 'Geral',
  tabWorkspace: 'Workspace e RAM',
  tabDownloads: 'Downloads',
  tabServices: 'Serviços',
  tabAbout: 'Sobre',
  minimizeToTray: 'Minimizar para a bandeja ao fechar',
  minimizeToTrayDesc: 'Mantém o Artyplexer em segundo plano ao fechar a janela.',
  startMinimized: 'Iniciar minimizado na bandeja',
  startMinimizedDesc: 'Inicia oculto na bandeja do sistema sem abrir a janela.',
  globalDnd: 'Modo Não Perturbe Global',
  globalDndDesc: 'Silencia todas as notificações da área de trabalho.',
  appearanceLabel: 'Tema',
  themeSystem: 'Seguir o sistema',
  themeLight: 'Claro',
  themeDark: 'Escuro',
  languageLabel: 'Idioma da interface',
  showNavBar: 'Mostrar barra de navegação',
  showNavBarDesc: 'Exibe barra compacta com Voltar, Avançar, Recarregar e URL acima do serviço.',
  autoHibernate: 'Hibernar serviços inativos automaticamente',
  autoHibernateDesc: 'Descarrega abas ociosas em segundo plano para liberar RAM (nunca interrompe áudio).',
  hibernateAfterLabel: 'Hibernar após inatividade',
  hibernateMinutesUnit: 'minutos',
  downloadLocationLabel: 'Pasta padrão de downloads',
  systemDefaultFolder: '(Pasta Downloads do sistema)',
  browseBtn: 'Procurar…',
  resetBtn: 'Padrão',
  resetFolderTitle: 'Restaurar pasta padrão de Downloads do sistema',
  alwaysAskDownload: 'Sempre perguntar onde salvar cada arquivo',
  alwaysAskDownloadDesc: 'Solicita o local de destino toda vez que um arquivo for salvo.',
  notifyDownloadComplete: 'Notificar conclusão de downloads',
  notifyDownloadCompleteDesc: 'Exibe uma notificação do sistema quando um download terminar.',
  configuredServicesLabel: 'Serviços configurados',
  noServicesConfigured: 'Nenhum serviço configurado.',
  clearSessionBtn: 'Limpar Sessão e Cache',
  deleteServiceBtn: 'Excluir Serviço',
  clearSessionConfirmTitle: 'Limpar Sessão do Serviço',
  clearSessionConfirmMsg: 'Limpar todos os cookies e dados salvos de "{name}"? Você precisará fazer login novamente.',
  deleteServiceConfirmTitle: 'Excluir Serviço',
  deleteServiceConfirmMsg: 'Tem certeza que deseja excluir "{name}" e apagar sua sessão isolada?',
  sessionClearedMsg: 'Dados do serviço limpos com sucesso.',
  settingsSavedMsg: 'Configurações salvas.',
  cancelBtn: 'Cancelar',
  closeBtn: 'Fechar',
  confirmBtn: 'Confirmar',
  saveSettingsBtn: 'Salvar Configurações',
  aboutSubtitle: 'Multiplexador desktop ultra-leve inspirado no Ferdium.',
  aboutBullet1: 'Partições Chromium isoladas por serviço (múltiplas contas)',
  aboutBullet2: 'Hibernação sob demanda e automática para consumo mínimo de RAM',
  aboutBullet3: 'Cache de mídia em Rust com codecs H.264, VP9, AV1 e Opus nativos',
  shortcutsTitle: 'Atalhos de Teclado',
  shortcutSwitch: 'Alternar entre serviços 1–9',
  shortcutQuick: 'Troca Rápida',
  shortcutNav: 'Alternar barra de navegação',
  shortcutDownloads: 'Abrir/fechar painel de Downloads',
  shortcutNew: 'Adicionar novo serviço',
  shortcutReload: 'Recarregar serviço ativo',

  addServiceHeader: 'Adicionar Serviço',
  editServiceHeader: 'Editar Serviço',
  presetLabel: 'Modelo de Serviço',
  serviceNameLabel: 'Nome de Exibição',
  serviceNamePlaceholder: 'ex: WhatsApp Trabalho',
  serviceUrlLabel: 'URL do Serviço',
  fetchIconBtn: 'Copiar Ícone',
  fetchIconTitle: 'Baixar automaticamente o favicon do site',
  iconCopiedMsg: 'Ícone copiado do site.',
  enterValidUrlMsg: 'Informe uma URL válida primeiro.',
  nameAndUrlRequiredMsg: 'Nome e URL são obrigatórios.',
  iconTypeAndColorLabel: 'Ícone e Destaque',
  iconColorHint: 'Cor de Destaque (diferenciar múltiplas contas)',
  customColorLabel: 'Personalizar',
  enableServiceNotif: 'Notificações na área de trabalho',
  enableServiceToggle: 'Serviço ativado',
  saveServiceBtn: 'Salvar Serviço',
  drmWarningTitle: 'Aviso sobre Streaming com DRM',
  drmWarningMsg: 'Serviços que exigem DRM Google Widevine (como Spotify Web, Netflix ou Prime Video) não reproduzem mídia criptografada no Electron padrão sem Widevine CDM.\n\nDeseja adicionar mesmo assim?',
  addAnywayBtn: 'Adicionar mesmo assim',

  downloadsHeader: 'Downloads Recentes de Mídia',
  downloadsEmpty: 'Nenhuma foto ou vídeo baixado recentemente.',
  colFile: 'Arquivo',
  colService: 'Serviço',
  colExpires: 'Disponível até',
  watchBtn: 'Assistir',
  watchTitle: 'Pré-visualizar dentro do Artyplexer',
  openPlayerBtn: 'Abrir',
  openPlayerTitle: 'Abrir no player padrão do sistema',
  saveBtn: 'Salvar',
  saveAsBtn: 'Salvar cópia…',
  downloadsHint: 'Assistir usa os codecs nativos do Chromium; Abrir usa o player do sistema. O cache temporário expira em 7 dias.',
  couldNotOpenMsg: 'Não foi possível abrir',
  failedToSaveMsg: 'Falha ao salvar',
};

const DICTIONARIES: Record<SupportedLocale, Messages> = {
  'en-US': EN_US,
  'pt-BR': PT_BR,
};

export function resolveLocale(raw: string | undefined): SupportedLocale {
  if (raw === 'pt-BR') return 'pt-BR';
  return 'en-US';
}

export function getMessages(locale: string | undefined): Messages {
  return DICTIONARIES[resolveLocale(locale)];
}

export const t: Readable<Messages> = derived(settings, ($s) => getMessages($s.language));
