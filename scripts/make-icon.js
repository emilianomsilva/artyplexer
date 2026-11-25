// Use the same artwork for the favicon, app bundle, and tray.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'build', 'icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.copyFileSync(path.join(root, 'frontend', 'public', 'artyplexer.png'), out);
console.log('wrote', out);
