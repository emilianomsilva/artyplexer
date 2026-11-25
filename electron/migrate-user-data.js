'use strict';

const fs = require('node:fs');
const path = require('node:path');

function copyDirectoryOnce(source, target, prepare = () => {}) {
  if (!fs.existsSync(source) || fs.existsSync(target)) return;
  const staging = fs.mkdtempSync(path.join(path.dirname(target), '.migration-'));
  try {
    fs.cpSync(source, staging, { recursive: true });
    prepare(staging);
    fs.renameSync(staging, target);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

function migrateUserData({ dataDir, profileDir, oldDataDir, oldProfileDir }) {
  fs.mkdirSync(dataDir, { recursive: true });
  const configPath = path.join(dataDir, 'config.json');
  const oldConfig = path.join(oldDataDir, 'config.json');

  if (!fs.existsSync(configPath) && fs.existsSync(oldConfig)) {
    const config = JSON.parse(fs.readFileSync(oldConfig, 'utf8'));
    for (const dir of ['icons', 'media-downloads']) {
      copyDirectoryOnce(path.join(oldDataDir, dir), path.join(dataDir, dir));
    }
    for (const service of config.services || []) {
      if (!service.custom_icon_path) continue;
      const relative = path.relative(oldDataDir, service.custom_icon_path);
      if (relative.startsWith('icons' + path.sep)) {
        service.custom_icon_path = path.join(dataDir, relative);
      }
    }
    const temporary = path.join(dataDir, '.config-migration-' + process.pid);
    fs.writeFileSync(temporary, JSON.stringify(config, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, configPath);
  }

  fs.mkdirSync(profileDir, { recursive: true });
  copyDirectoryOnce(path.join(oldProfileDir, 'Partitions'), path.join(profileDir, 'Partitions'), (staging) => {
    for (const entry of fs.readdirSync(staging, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith('ironplexer-')) {
        fs.renameSync(path.join(staging, entry.name), path.join(staging, 'artyplexer-' + entry.name.slice('ironplexer-'.length)));
      }
    }
  });

  const localState = path.join(oldProfileDir, 'Local State');
  const newLocalState = path.join(profileDir, 'Local State');
  if (fs.existsSync(localState) && !fs.existsSync(newLocalState)) {
    fs.copyFileSync(localState, newLocalState, fs.constants.COPYFILE_EXCL);
  }
}

module.exports = { migrateUserData };
