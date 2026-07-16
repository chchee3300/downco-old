import { useTranslation } from '../hooks/useTranslation.js'

// Non-blocking update notification (fixed toast, bottom-right) -- unlike
// TrimModal/CropModal/MixedTypeModal this deliberately isn't a focus-trapped
// modal, since a new version is never urgent enough to interrupt an
// in-progress conversion or settings edit. See useUpdateChecker.js for the
// status machine (idle/checking/available/downloading/installing/
// downloaded/error/none) and the Windows-vs-macOS/Linux install split.
// updateError/latestRelease.name are raw strings sourced from GitHub/the OS
// (network errors, release notes) -- left untranslated, same "alerts and
// external error text stay English for now" scope decision as the other
// two repos' alert()/OS-dialog strings.
export default function UpdateBanner({ status, latestRelease, updateError, onInstall, onDismiss }) {
  const { t } = useTranslation()
  if (status === 'idle' || status === 'checking' || status === 'none') return null

  const version = latestRelease?.tag_name?.replace(/^v/, '')

  return (
    <div className="update-toast" role="status" aria-live="polite">
      {status === 'available' && (
        <>
          <div className="update-toast-title">{t('updateBanner.available', { version })}</div>
          {updateError ? (
            <div className="update-toast-body">{t('updateBanner.failed', { error: updateError })}</div>
          ) : (
            latestRelease?.name && <div className="update-toast-body">{latestRelease.name}</div>
          )}
          <div className="update-toast-actions">
            <button className="btn btn-ghost btn-xs" onClick={onDismiss}>{t('updateBanner.later')}</button>
            <button className="btn btn-primary btn-xs" onClick={onInstall}>{updateError ? t('updateBanner.tryAgain') : t('updateBanner.updateNow')}</button>
          </div>
        </>
      )}

      {status === 'downloading' && (
        <>
          <div className="update-toast-title">{t('updateBanner.downloading', { version })}</div>
          <div className="progress-track">
            <div className="progress-bar progress-bar--indeterminate" />
          </div>
        </>
      )}

      {status === 'installing' && (
        <div className="update-toast-title">{t('updateBanner.installing')}</div>
      )}

      {status === 'downloaded' && (
        <>
          <div className="update-toast-title">{t('updateBanner.downloaded', { version })}</div>
          <div className="update-toast-body">{t('updateBanner.downloadedBody')}</div>
          <div className="update-toast-actions">
            <button className="btn btn-ghost btn-xs" onClick={onDismiss}>{t('updateBanner.dismiss')}</button>
          </div>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="update-toast-title">{t('updateBanner.checkFailed')}</div>
          {updateError && <div className="update-toast-body">{updateError}</div>}
          <div className="update-toast-actions">
            <button className="btn btn-ghost btn-xs" onClick={onDismiss}>{t('updateBanner.dismiss')}</button>
          </div>
        </>
      )}
    </div>
  )
}
