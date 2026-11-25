/* Brand icons + crisp Ferdium-style stroke UI glyphs. */
import whatsappSvg from '../icons/whatsapp.svg?raw';
import telegramSvg from '../icons/telegram.svg?raw';
import discordSvg from '../icons/discord.svg?raw';
import slackSvg from '../icons/slack.svg?raw';
import spotifySvg from '../icons/spotify.svg?raw';
import appflowySvg from '../icons/appflowy.svg?raw';
import genericSvg from '../icons/generic.svg?raw';
import youtubeSvg from '../icons/youtube.svg?raw';
import bellSvg from '../icons/bell.svg?raw';
import bellSlashSvg from '../icons/bell-slash.svg?raw';
import plusSvg from '../icons/plus.svg?raw';
import settingsSvg from '../icons/settings.svg?raw';
import type { ServiceConfig } from './electron';

const stroke = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const ICONS: Record<string, string> = {
  whatsapp: whatsappSvg,
  telegram: telegramSvg,
  discord: discordSvg,
  slack: slackSvg,
  spotify: spotifySvg,
  appflowy: appflowySvg,
  generic: genericSvg,
  youtube: youtubeSvg,
  bell: bellSvg,
  'bell-slash': bellSlashSvg,
  plus: plusSvg,
  settings: settingsSvg,
  search: stroke('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
  download: stroke('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
  navbar: stroke('<rect x="3" y="3" width="18" height="18" rx="2.5"/><line x1="3" y1="9" x2="21" y2="9"/>'),
  'arrow-left': stroke('<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>'),
  'arrow-right': stroke('<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>'),
  refresh: stroke('<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>'),
  moon: stroke('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'),
  'volume-2': stroke('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>'),
  'volume-x': stroke('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>'),
  external: stroke('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>'),
  close: stroke('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
  zap: stroke('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
};

const BRAND_COLORS = ['#25D366', '#229ED9', '#5865F2', '#4A154B', '#FF0000', '#1DB954', '#334155'];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function lookupIcon(name: string): string {
  const key = name.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ICONS, key)) {
    return ICONS[key] as string;
  }
  return ICONS['generic'] as string;
}

/** Load a brand/type icon, recoloring its brand fill. */
export function brandIcon(iconType: string | undefined, customColor: string | undefined): string {
  let svg: string = lookupIcon(iconType || 'generic');
  if (customColor) {
    for (const c of BRAND_COLORS) {
      if (svg.toLowerCase().includes(c.toLowerCase())) {
        svg = svg.split(new RegExp(escapeRegExp(c), 'gi')).join(customColor);
        break;
      }
    }
  }
  return svg;
}

/** Recolor single-color UI glyphs to the desired tone. */
export function uiIcon(name: string, tone = '#94a3b8'): string {
  const svg: string = lookupIcon(name);
  return svg.replace(/#94a3b8/gi, tone);
}

export function iconFor(service: ServiceConfig): { letter: string; color: string } {
  const map: Record<string, string> = { whatsapp: 'W', telegram: 'T', discord: 'D', slack: 'S', appflowy: 'A', youtube: 'Y' };
  const fromType = map[(service.icon_type || '').toLowerCase()];
  const letter = (fromType ?? service.name.trim().charAt(0) ?? '?').toUpperCase() || '?';
  return { letter, color: service.custom_color || '#3b82f6' };
}

export function formatExpiry(isoOrEpoch: string | number, locale = 'en-US'): string {
  try {
    const ms = typeof isoOrEpoch === 'number' ? isoOrEpoch * 1000 : /^\d+$/.test(isoOrEpoch) ? Number(isoOrEpoch) * 1000 : Date.parse(isoOrEpoch);
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return String(isoOrEpoch);
    return d.toLocaleString(locale, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(isoOrEpoch);
  }
}
