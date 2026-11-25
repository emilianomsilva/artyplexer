'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const electron = require('electron');

const project = path.resolve(__dirname, '..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'artyplexer-smoke-'));
try {
  const downloads = path.join(root, 'downloads');
  fs.mkdirSync(downloads);
  const run = spawnSync(electron, ['.', '--smoke', '--no-sandbox'], {
    cwd: project,
    env: { ...process.env, ARTYPLEXER_DATA_DIR: root, ARTYPLEXER_DOWNLOAD_DIR: downloads },
    stdio: 'inherit',
    timeout: 45_000,
  });
  const report = path.join(root, 'smoke.json');
  if (fs.existsSync(report)) {
    const result = JSON.parse(fs.readFileSync(report, 'utf8'));
    for (const step of result.steps) console.log(step.ok ? 'PASS' : 'FAIL', step.name);
    process.exitCode = result.ok && run.status === 0 ? 0 : 1;
  } else {
    console.error(run.error || 'The Electron smoke test did not write a report.');
    process.exitCode = 1;
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
