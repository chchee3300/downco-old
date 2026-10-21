// Where the hub gets each tool plugin from.
//
// Each tool repo ships BOTH halves of its plugin in one npm git dependency:
// the JS package (dist/) and the Rust crate (plugin/). src-tauri/Cargo.toml
// depends on the crate by path through a generated, gitignored link:
//   .plugins/<tool>  ->  sibling checkout, if present (cross-repo dev mode)
//                    ->  node_modules/sorai-toolkit-<tool> otherwise (CI/release)
// so JS and Rust always come from the same commit, and local dev never needs
// anything pushed. (A cargo git dependency + [patch] doesn't work here: cargo
// still fetches and resolves the original git source before patching.)
//
// vite.config.mjs uses siblings() to alias the npm package to the sibling's
// src/ for HMR. Default sibling = the `-tauri` integration worktree next to
// the hub's; override with CONVERTER_REPO / DOWNLOADER_REPO.
//
// CLI (`node scripts/siblings.mjs`) refreshes the links; it runs in
// beforeDevCommand/beforeBuildCommand and from scripts/tauri-dev.mjs.
import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const toolkit = join(root, '..')

export const TOOLS = [
  { name: 'converter', env: 'CONVERTER_REPO' },
  { name: 'downloader', env: 'DOWNLOADER_REPO' },
]

const hasCrate = (dir) => existsSync(join(dir, 'plugin', 'Cargo.toml'))

// -> [{ name, pkg, dir }] for every sibling checkout that is actually there.
export function siblings() {
  return TOOLS.flatMap(({ name, env }) => {
    const pkg = `sorai-toolkit-${name}`
    const dir = resolve(process.env[env] || join(toolkit, `${pkg}-tauri`))
    if (hasCrate(dir)) return [{ name, pkg, dir }]
    if (process.env[env]) throw new Error(`${env}=${dir} has no plugin/Cargo.toml`)
    return []
  })
}

export function linkPlugins() {
  const local = new Map(siblings().map((s) => [s.name, s.dir]))
  return TOOLS.map(({ name }) => {
    const dir = local.get(name) ?? join(root, 'node_modules', `sorai-toolkit-${name}`)
    if (!hasCrate(dir)) {
      throw new Error(`${dir} has no plugin/Cargo.toml -- check out the sibling repo or run npm install`)
    }
    const link = join(root, '.plugins', name)
    mkdirSync(dirname(link), { recursive: true })
    // lstat, not exists: a dangling link must be replaced too. Never recursive --
    // that could delete through the link into the sibling repo.
    try { if (lstatSync(link)) rmSync(link) } catch {}
    symlinkSync(dir, link, 'junction')
    return `${name}: ${dir}`
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(linkPlugins().map((l) => `plugin ${l}`).join('\n'))
}
