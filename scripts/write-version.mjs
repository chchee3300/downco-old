// Writes the semantic-release-computed version into src/version.json (Vite
// bundles it: the update checker's baseline and the header version) and into
// src-tauri/tauri.conf.json's "version" (installer/bundle file names, the
// Tauri updater's own version comparison). Run before `tauri build`:
//   node scripts/write-version.mjs <version>
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error('Usage: node scripts/write-version.mjs <X.Y.Z>');
  process.exit(1);
}

const dest = path.resolve('src/version.json');
writeFileSync(dest, JSON.stringify({ version }, null, 2) + '\n');
console.log(`Wrote ${dest}: version ${version}`);

// Line-level replace (not JSON.stringify) so the hand formatting survives.
const conf = path.resolve('src-tauri/tauri.conf.json');
const before = readFileSync(conf, 'utf8');
const after = before.replace(/^(\s*"version":\s*)"[^"]*"/m, `$1"${version}"`);
if (after === before && !before.includes(`"version": "${version}"`)) {
  console.error(`No top-level "version" field found in ${conf}`);
  process.exit(1);
}
writeFileSync(conf, after);
console.log(`Wrote ${conf}: version ${version}`);
