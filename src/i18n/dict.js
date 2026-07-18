// Hub's own UI copy -- flat key -> string (or key -> (params) => string for
// interpolated/pluralized entries) per language. See
// src/hooks/useTranslation.js and resources/js/lib/i18n.js for the
// mechanism this feeds. Keys use a `component.field` naming convention for
// readability only -- they're not actually nested, just flat strings, so
// translate() never needs a path-walker.
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
    'hamburger.about': 'About',
    // A language's own name is always shown in itself, never translated by
    // whichever language is currently active -- how a user finds their
    // language in the first place.
    'hamburger.lang.en': 'English',
    'hamburger.lang.zh-TW': '繁體中文',

    'updateBanner.available': ({ version }) => `Update available — v${version}`,
    'updateBanner.failed': ({ error }) => `Update failed: ${error}`,
    'updateBanner.later': 'Later',
    'updateBanner.tryAgain': 'Try again',
    'updateBanner.updateNow': 'Update now',
    'updateBanner.downloading': ({ version }) => `Downloading v${version}…`,
    'updateBanner.installing': 'Installing update — the app will restart…',
    'updateBanner.downloaded': ({ version }) => `Downloaded v${version}`,
    'updateBanner.downloadedBody': 'Opened your Downloads folder — finish the install from there.',
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
    'about.description': 'SORAI Toolkit is a desktop suite of local file tools — currently a video/image/audio/PDF Converter and a video Downloader — built with Neutralino.js and React. Everything runs on your own machine; no file is ever uploaded anywhere.',
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
    'hamburger.about': '關於',
    'hamburger.lang.en': 'English',
    'hamburger.lang.zh-TW': '繁體中文',

    'updateBanner.available': ({ version }) => `有可用更新－v${version}`,
    'updateBanner.failed': ({ error }) => `更新失敗：${error}`,
    'updateBanner.later': '稍後再說',
    'updateBanner.tryAgain': '重試',
    'updateBanner.updateNow': '立即更新',
    'updateBanner.downloading': ({ version }) => `正在下載 v${version}…`,
    'updateBanner.installing': '正在安裝更新，應用程式即將重新啟動…',
    'updateBanner.downloaded': ({ version }) => `已下載 v${version}`,
    'updateBanner.downloadedBody': '已開啟下載資料夾，請於該處完成安裝。',
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
    'about.description': 'SORAI Toolkit 是一套本機檔案工具箱，目前包含影片/圖片/音訊/PDF 轉檔工具與影片下載工具，使用 Neutralino.js 與 React 打造。所有處理都在你自己的電腦上完成，不會上傳任何檔案。',
    'about.thirdPartyHeading': '第三方軟體',
    'about.viewFullLicenses': '查看完整第三方授權內容',
    'about.close': '關閉',
  },
}
