// Writes release-assets/latest.json, the manifest tauri-plugin-updater reads
// from releases/latest/download/latest.json (plugins.updater.endpoints).
// Run in the release job after every build job's release-assets/ (packages
// plus their .sig files from `tauri build` with createUpdaterArtifacts) are
// merged:  node scripts/updater-manifest.mjs <version>
//
// Platform keys: the updater tries "<os>-<arch>-<installer>" then
// "<os>-<arch>"; deb and rpm installs each need their own key (it runs
// dpkg -i / rpm -U on whatever it downloads).
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/updater-manifest.mjs <version>');
  process.exit(1);
}
const REPO = 'chchee3300/sorai-toolkit';
const dir = 'release-assets';

// Asset names are set by the "Collect" step in .github/workflows/release.yml.
const ASSETS = {
  [`sorai-toolkit_${version}_x64-setup.exe`]: ['windows-x86_64-nsis', 'windows-x86_64'],
  [`sorai-toolkit_${version}_amd64.deb`]: ['linux-x86_64-deb'],
  [`sorai-toolkit-${version}.x86_64.rpm`]: ['linux-x86_64-rpm'],
  [`sorai-toolkit_${version}_mac_x64.app.tar.gz`]: ['darwin-x86_64'],
  [`sorai-toolkit_${version}_mac_arm64.app.tar.gz`]: ['darwin-aarch64'],
};

const platforms = {};
for (const [name, keys] of Object.entries(ASSETS)) {
  let signature;
  try {
    signature = readFileSync(`${dir}/${name}.sig`, 'utf8').trim();
  } catch {
    console.error(`Missing ${dir}/${name}.sig -- was that build signed (tauri.release.conf.json + TAURI_SIGNING_PRIVATE_KEY)?`);
    process.exit(1);
  }
  const url = `https://github.com/${REPO}/releases/download/v${version}/${name}`;
  for (const key of keys) platforms[key] = { signature, url };
}

const manifest = {
  version,
  notes: `See https://github.com/${REPO}/releases/tag/v${version}`,
  pub_date: new Date().toISOString(),
  platforms,
};
writeFileSync(`${dir}/latest.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Wrote ${dir}/latest.json (${Object.keys(platforms).join(', ')})`);
