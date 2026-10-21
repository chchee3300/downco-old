import { useCallback, useEffect, useState } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'
import versionInfo from '../version.json'

// GitHub owner/repo this app is published from -- see .github/workflows/release.yml
// (release pipeline migrates here in Phase C of the multi-repo restructure;
// until then this just means "no update found" since no release exists yet).
const REPO = 'chchee3300/sorai-toolkit'
const LATEST_RELEASE_URL = `https://api.github.com/repos/${REPO}/releases/latest`

// True only for builds produced by .github/workflows/release.yml (which
// sets this env var before `npm run build`, baking it into the bundle via
// Vite's import.meta.env) -- a plain `npm run build` run by anyone building
// from source themselves never sets it, so self-built copies fall back to
// the "just open the release page" install path below with zero config.
// This is the only thing that distinguishes "official" from "self-built" --
// there's no signing/identity check, it's purely "did the CI job say so".
const IS_OFFICIAL_BUILD = import.meta.env.VITE_OFFICIAL_BUILD === 'true'

function parseSemver(v) {
  const m = String(v ?? '').replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

// True only if `latest` is strictly greater than `current` -- equal or
// unparseable versions never report an update, so a malformed tag can't
// spuriously nag the user.
function isNewer(latest, current) {
  const a = parseSemver(latest)
  const b = parseSemver(current)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true
    if (a[i] < b[i]) return false
  }
  return false
}

// Checks GitHub Releases for a newer version on mount (both build kinds).
// Installing forks on IS_OFFICIAL_BUILD: official builds hand off to the
// Tauri updater plugin (latest.json endpoint + signature check configured in
// src-tauri/tauri.conf.json `plugins.updater`), then relaunch; self-built
// copies just open the release page -- the official installer would
// overwrite a build that isn't theirs.
export function useUpdateChecker() {
  const [status, setStatus] = useState('idle') // idle | checking | available | none | error | downloading | installing
  const [latestRelease, setLatestRelease] = useState(null)
  const [updateError, setUpdateError] = useState(null)
  // Whether the in-flight/last check was user-initiated (hamburger's
  // "Check for updates") rather than the automatic on-mount check. Manual
  // checks surface "checking…"/"up to date" feedback in UpdateBanner;
  // the silent auto check only ever surfaces when an update exists or the
  // check errors.
  const [manualCheck, setManualCheck] = useState(false)

  const checkForUpdate = useCallback(async (manual = false) => {
    setManualCheck(manual === true)
    setStatus('checking')
    setUpdateError(null)
    try {
      const res = await fetch(LATEST_RELEASE_URL, { headers: { Accept: 'application/vnd.github+json' } })
      if (!res.ok) throw new Error(`GitHub API returned ${res.status}`)
      const data = await res.json()
      if (isNewer(data.tag_name, versionInfo.version)) {
        setLatestRelease(data)
        setStatus('available')
      } else {
        setStatus('none')
      }
    } catch (e) {
      console.error('Update check failed', e)
      setUpdateError(e.message || String(e))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    checkForUpdate()
  }, [checkForUpdate])

  const installUpdate = useCallback(async () => {
    if (!latestRelease) return
    setUpdateError(null)

    if (!IS_OFFICIAL_BUILD) {
      // Status stays 'available' so the AboutModal section is still there
      // if they come back later.
      await openUrl(latestRelease.html_url)
      return
    }

    setStatus('downloading')
    try {
      const update = await check()
      if (!update) throw new Error('No signed update found for this platform in the latest release')
      // On Windows the NSIS installer (installMode "passive") exits the app
      // itself; relaunch covers macOS/Linux.
      await update.downloadAndInstall((e) => e.event === 'Finished' && setStatus('installing'))
      await relaunch()
    } catch (e) {
      console.error('Update install failed', e)
      setUpdateError(e?.message || String(e))
      setStatus('available')
    }
  }, [latestRelease])

  const dismiss = useCallback(() => {
    setStatus('none')
    setManualCheck(false)
  }, [])

  // Wrapped (not checkForUpdate itself) so an onClick's event object can't
  // be mistaken for the `manual` flag.
  const checkForUpdateManually = useCallback(() => checkForUpdate(true), [checkForUpdate])

  return {
    currentVersion: versionInfo.version,
    status,
    latestRelease,
    updateError,
    manualCheck,
    isOfficialBuild: IS_OFFICIAL_BUILD,
    checkForUpdate: checkForUpdateManually,
    installUpdate,
    dismiss,
  }
}
