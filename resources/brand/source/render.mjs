// node render.mjs jobs.json: each {src, out, w} -> transparent PNG `w` px wide (height from the viewBox).
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
const require = createRequire(new URL('../../../package.json', import.meta.url))
const { chromium } = require('playwright')
const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})
const p = await b.newPage()
for (const j of jobs) {
  const svg = readFileSync(j.src, 'utf8')
  const [, , vw, vh] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number)
  const w = j.w, h = Math.round((w * vh) / vw)
  await p.setViewportSize({ width: w, height: h })
  const inner = svg.replace(/ width="[^"]*"/, ` width="${w}"`).replace(/ height="[^"]*"/, ` height="${h}"`)
  await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${inner}`)
  mkdirSync(dirname(resolve(j.out)), { recursive: true })
  await p.screenshot({ path: j.out, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } })
}
await b.close()
console.log(`${jobs.length} png`)
