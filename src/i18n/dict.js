// Hub's own UI copy -- flat key -> string (or key -> (params) => string for
// interpolated/pluralized entries) per language. See
// src/hooks/useTranslation.js and resources/js/lib/i18n.js for the
// mechanism this feeds. Keys use a `component.field` naming convention for
// readability only -- they're not actually nested, just flat strings, so
// translate() never needs a path-walker.
import menuStrings from './menu-strings.json'

// Context-menu and built-in preset labels live in menu-strings.json, the one
// copy shared with the Rust registry writer (src-tauri/src/context_menu.rs).
// `{name}` placeholders -> params.
const fromMenuStrings = (lang) =>
  Object.fromEntries(Object.entries(menuStrings[lang]).map(([k, s]) => [k, (p) => s.replace(/\{(\w+)\}/g, (_, n) => p[n] ?? '')]))

export const dict = {
  en: {
    'hub.tool.converter.label': 'Converter',
    'hub.tool.converter.desc': 'Convert video, image, audio, and PDF files locally.',
    'hub.tool.downloader.label': 'Downloader',
    'hub.tool.downloader.desc': 'Download videos from a URL, pick a format, and save them locally.',

    'header.backToHub': 'Back to hub',

    'hamburger.menu': 'Menu',
    'hamburger.appearance': 'Appearance',
    'hamburger.checkUpdate': 'Check for updates',
    'hamburger.settings': 'Settings',
    'hamburger.about': 'About',
    // A language's own name is always shown in itself, never translated by
    // whichever language is currently active -- how a user finds their
    // language in the first place.
    'hamburger.lang.en': 'English',
    'hamburger.lang.zh-TW': '繁體中文',

    'progress.status.queued': 'Waiting',
    'progress.status.running': 'Converting',
    'progress.status.success': 'Done',
    'progress.status.error': 'Failed',
    'progress.status.cancelled': 'Cancelled',
    'progress.status.skipped': 'Skipped: not supported by this preset',
    'progress.cancel': 'Cancel',
    'progress.cancelAll': 'Cancel all',
    'progress.unknownPreset': 'This preset no longer exists',
    'progress.notifyTitle': 'Conversion finished',
    'progress.notifyBody': 'Click to open the output folder.',
    ...fromMenuStrings('en'),

    'settings.title': 'Settings',
    'settings.closeBehavior.heading': 'When closing the window',
    'settings.closeBehavior.ask': 'Ask me every time',
    'settings.closeBehavior.tray': 'Minimize to the system tray',
    'settings.closeBehavior.quit': 'Quit the app',
    'settings.presets.heading': 'Right-click presets',
    'settings.presets.type.video': 'Video',
    'settings.presets.type.image': 'Image',
    'settings.presets.type.audio': 'Audio',
    'settings.presets.type.pdf': 'PDF',
    'settings.presets.rename': 'Preset name',
    'settings.presets.moveUp': 'Move up',
    'settings.presets.moveDown': 'Move down',
    'settings.presets.delete': 'Delete',
    'settings.presets.empty': 'No presets: the right-click menu only offers Open and Manage.',
    'settings.presets.restore': 'Restore defaults',
    'settings.presets.restoreConfirm': 'Replace all presets with the defaults?',
    'settings.close': 'Close',

    'closeConfirm.title': 'Close SORAI Toolkit?',
    'closeConfirm.body': 'You can keep it running in the background, or quit completely.',
    'closeConfirm.rememberChoice': 'Remember my choice (change anytime in Settings)',
    'closeConfirm.minimizeToTray': 'Minimize to tray',
    'closeConfirm.quit': 'Quit',

    'tray.open': 'Open SORAI Toolkit',
    'tray.quit': 'Quit',
    'tray.notifyTitle': 'SORAI Toolkit is still running',
    'tray.notifyBody': "It's now in the background — click the tray icon to bring it back.",

    'updateBanner.available': ({ version }) => `Update available — v${version}`,
    'updateBanner.failed': ({ error }) => `Update failed: ${error}`,
    'updateBanner.later': 'Later',
    'updateBanner.tryAgain': 'Try again',
    'updateBanner.updateNow': 'Update now',
    'updateBanner.downloading': ({ version }) => `Downloading v${version}…`,
    'updateBanner.installing': 'Installing update — the app will restart…',
    'updateBanner.dismiss': 'Dismiss',
    'updateBanner.checkFailed': 'Update check failed',
    'updateBanner.checking': 'Checking for updates…',
    'updateBanner.upToDate': ({ version }) => `You're up to date — v${version}`,

    'about.title': 'About',
    'about.tagline': 'A local, no-upload file toolkit',
    'about.updateAvailable': ({ version }) => `New version available — v${version}`,
    'about.updateNow': 'Update now',
    'about.viewOnGithub': 'View on GitHub',
    'about.version': 'Version',
    'about.developer': 'Developer',
    'about.license': 'License',
    'about.homepage': 'Homepage',
    'about.description': 'SORAI Toolkit is a desktop suite of local file tools — currently a video/image/audio/PDF Converter and a video Downloader — built with Tauri and React. Everything runs on your own machine; no file is ever uploaded anywhere.',
    'about.thirdPartyHeading': 'Third-party software',
    'about.viewFullLicenses': 'View full third-party license details',
    'about.close': 'Close',
  },
  'zh-TW': {
    'hub.tool.converter.label': '轉檔工具',
    'hub.tool.converter.desc': '在本機轉換影片、圖片、音訊與 PDF 檔案。',
    'hub.tool.downloader.label': '下載工具',
    'hub.tool.downloader.desc': '貼上網址下載影片，選擇格式後儲存到本機。',

    'header.backToHub': '回到主選單',

    'hamburger.menu': '選單',
    'hamburger.appearance': '外觀',
    'hamburger.checkUpdate': '檢查更新',
    'hamburger.settings': '設定',
    'hamburger.about': '關於',
    'hamburger.lang.en': 'English',
    'hamburger.lang.zh-TW': '繁體中文',

    'progress.status.queued': '等待中',
    'progress.status.running': '轉檔中',
    'progress.status.success': '完成',
    'progress.status.error': '失敗',
    'progress.status.cancelled': '已取消',
    'progress.status.skipped': '已略過：不支援此預設',
    'progress.cancel': '取消',
    'progress.cancelAll': '全部取消',
    'progress.unknownPreset': '這個預設已經不存在',
    'progress.notifyTitle': '轉檔完成',
    'progress.notifyBody': '點一下打開輸出資料夾。',
    ...fromMenuStrings('zh-TW'),

    'settings.title': '設定',
    'settings.closeBehavior.heading': '關閉視窗時',
    'settings.closeBehavior.ask': '每次都詢問',
    'settings.closeBehavior.tray': '自動縮到背景執行',
    'settings.closeBehavior.quit': '直接結束程式',
    'settings.presets.heading': '右鍵選單預設',
    'settings.presets.type.video': '影片',
    'settings.presets.type.image': '圖片',
    'settings.presets.type.audio': '音訊',
    'settings.presets.type.pdf': 'PDF',
    'settings.presets.rename': '預設名稱',
    'settings.presets.moveUp': '上移',
    'settings.presets.moveDown': '下移',
    'settings.presets.delete': '刪除',
    'settings.presets.empty': '沒有預設：右鍵選單只剩「開啟」與「設定預設」。',
    'settings.presets.restore': '還原預設',
    'settings.presets.restoreConfirm': '要把所有預設換回內建的嗎？',
    'settings.close': '關閉',

    'closeConfirm.title': '要關閉 SORAI Toolkit 嗎？',
    'closeConfirm.body': '你可以讓它繼續在背景執行，或是直接結束程式。',
    'closeConfirm.rememberChoice': '記住我的選擇（之後可以在設定裡改）',
    'closeConfirm.minimizeToTray': '縮到背景執行',
    'closeConfirm.quit': '結束程式',

    'tray.open': '開啟 SORAI Toolkit',
    'tray.quit': '結束程式',
    'tray.notifyTitle': 'SORAI Toolkit 仍在執行中',
    'tray.notifyBody': '已縮到背景執行，點擊系統匣圖示即可開啟。',

    'updateBanner.available': ({ version }) => `有可用更新－v${version}`,
    'updateBanner.failed': ({ error }) => `更新失敗：${error}`,
    'updateBanner.later': '稍後再說',
    'updateBanner.tryAgain': '重試',
    'updateBanner.updateNow': '立即更新',
    'updateBanner.downloading': ({ version }) => `正在下載 v${version}…`,
    'updateBanner.installing': '正在安裝更新，應用程式即將重新啟動…',
    'updateBanner.dismiss': '關閉',
    'updateBanner.checkFailed': '檢查更新失敗',
    'updateBanner.checking': '正在檢查更新…',
    'updateBanner.upToDate': ({ version }) => `目前已是最新版本－v${version}`,

    'about.title': '關於',
    'about.tagline': '本機、免上傳的檔案工具箱',
    'about.updateAvailable': ({ version }) => `有新版本可用－v${version}`,
    'about.updateNow': '立即更新',
    'about.viewOnGithub': '在 GitHub 上查看',
    'about.version': '版本',
    'about.developer': '軟體開發者',
    'about.license': '授權方式',
    'about.homepage': '專案首頁',
    'about.description': 'SORAI Toolkit 是一套本機檔案工具箱，目前包含影片/圖片/音訊/PDF 轉檔工具與影片下載工具，使用 Tauri 與 React 打造。所有處理都在你自己的電腦上完成，不會上傳任何檔案。',
    'about.thirdPartyHeading': '第三方軟體',
    'about.viewFullLicenses': '查看完整第三方授權內容',
    'about.close': '關閉',
  },
}

// Non-hook, point-in-time translation for text used in imperative
// Tauri calls (tray menu item labels, sendNotification) rather than
// rendered live from a key by a React component -- same tNow pattern
// sorai-toolkit-converter/src/i18n/dict.js already uses for its progress
// text, reads the current language at call time.
export function tNow(key, params) {
  const i18n = window.EstellaLib.i18n
  return i18n.translate(dict, i18n.getLang(), key, params)
}
