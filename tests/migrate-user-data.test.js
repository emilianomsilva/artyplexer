'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { migrateUserData } = require('../electron/migrate-user-data');

function migrationPaths(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'artyplexer-migration-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return {
    dataDir: path.join(root, 'current-data'),
    profileDir: path.join(root, 'current-profile'),
    oldDataDir: path.join(root, 'previous-data'),
    oldProfileDir: path.join(root, 'previous-profile'),
  };
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

test('migrates Electron settings, managed icons, downloads and Chromium storage once', (t) => {
  const dirs = migrationPaths(t);
  const icon = path.join(dirs.oldDataDir, 'icons', 'message.png');
  const storage = path.join(dirs.oldProfileDir, 'Partitions', 'ironplexer-messages', 'Local Storage', 'data');
  write(icon, 'favicon');
  write(storage, 'session storage');
  write(path.join(dirs.oldProfileDir, 'Local State'), 'encryption metadata');
  write(path.join(dirs.oldDataDir, 'media-downloads', 'entry', 'sample'), 'media');
  write(path.join(dirs.oldDataDir, 'config.json'), JSON.stringify({
    services: [{ id: 'messages', custom_icon_path: icon }],
    settings: { language: 'pt-BR' },
  }));

  migrateUserData(dirs);

  const newIcon = path.join(dirs.dataDir, 'icons', 'message.png');
  const newStorage = path.join(dirs.profileDir, 'Partitions', 'artyplexer-messages', 'Local Storage', 'data');
  const config = JSON.parse(fs.readFileSync(path.join(dirs.dataDir, 'config.json')));
  assert.equal(config.services[0].custom_icon_path, newIcon);
  assert.equal(config.settings.language, 'pt-BR');
  assert.equal(fs.readFileSync(newIcon, 'utf8'), 'favicon');
  assert.equal(fs.readFileSync(newStorage, 'utf8'), 'session storage');
  assert.equal(fs.readFileSync(path.join(dirs.profileDir, 'Local State'), 'utf8'), 'encryption metadata');
  assert.equal(fs.readFileSync(path.join(dirs.dataDir, 'media-downloads', 'entry', 'sample'), 'utf8'), 'media');

  write(newStorage, 'new session storage');
  migrateUserData(dirs);
  assert.equal(fs.readFileSync(newStorage, 'utf8'), 'new session storage');
  assert.equal(fs.readFileSync(storage, 'utf8'), 'session storage');
});
