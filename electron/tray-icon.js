'use strict';
const path = require('node:path');
const { nativeImage } = require('electron');

let baseIcon;

// 3x5 bitmap font for badge digits.
const FONT = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  '+': ['000', '010', '111', '010', '000'],
};

function drawTrayIcon(unread) {
  const size = 64;
  baseIcon ??= nativeImage.createFromPath(path.join(__dirname, '..', 'build', 'icon.png'))
    .resize({ width: size, height: size, quality: 'best' });
  if (unread <= 0 || baseIcon.isEmpty()) return baseIcon;

  const img = baseIcon.toBitmap();
  const set = (x, y, r, g, b) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const offset = (y * size + x) * 4;
    img[offset] = b;
    img[offset + 1] = g;
    img[offset + 2] = r;
    img[offset + 3] = 255;
  };
  const text = unread > 99 ? '99+' : String(unread);
  const scale = 2;
  const tw = text.length * (3 * scale + scale) - scale;
  const th = 5 * scale;
  const bw = Math.max(24, tw + 10);
  const bh = 24;
  const bx = 60 - bw, by = 4;
  // Dark outline then red fill (square corners are fine at 64px).
  for (let y = by - 2; y < by + bh + 2; y++) {
    for (let x = bx - 2; x < bx + bw + 2; x++) set(x, y, 0x18, 0x19, 0x20);
  }
  for (let y = by; y < by + bh; y++) {
    for (let x = bx; x < bx + bw; x++) set(x, y, 0xe5, 0x39, 0x35);
  }
  // White digits, centered.
  const tx = bx + Math.floor((bw - tw) / 2), ty = by + Math.floor((bh - th) / 2);
  [...text].forEach((ch, ci) => {
    const glyph = FONT[ch];
    if (!glyph) return;
    glyph.forEach((row, ry) => {
      [...row].forEach((px, rx) => {
        if (px === '1') {
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              set(tx + ci * (3 * scale + scale) + rx * scale + sx, ty + ry * scale + sy, 255, 255, 255);
            }
          }
        }
      });
    });
  });
  return nativeImage.createFromBitmap(img, { width: size, height: size });
}

module.exports = { drawTrayIcon };
