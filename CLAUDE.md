# Claude 自動化測試指引 (sorai-toolkit hub)

這是 SORAI Toolkit 的**主 repo**（Neutralino 殼層 + hub 選單 + packaging/CI/release）。目前狀態：多 repo 重構的 **Phase D 完成**（三個 repo 都到位：hub 本身、`sorai-toolkit-converter`、`sorai-toolkit-downloader`，兩個工具都透過 npm git dependency 消費；packaging/CI/release 全部搬到這個 repo）——完整分階段計畫在 `~/.claude/plans/mac-linux-reactive-metcalfe.md`。四個 Phase（A/B/C/D）都已完成；後續是計畫之外的新工作（語言選單/設定頁等 hamburger menu 剩下的項目、更多工具等）。

## 現況（Phase D）
- `src/App.jsx` 是 hub 殼層：`currentTool` state 切換 `HubMenu`/`ConverterApp`/`DownloaderApp`，沒有 router。兩個工具都從各自的 npm 套件 import（`sorai-toolkit-converter`、`sorai-toolkit-downloader`），不是本地檔案。
- Converter/Downloader 的所有元件/hooks 都不在這個 repo 裡——分別活在各自的 repo，透過 `node_modules/<pkg>/dist/index.js`（Vite library build）提供。`package.json` 的 `dependencies` 有兩個 `github:chchee3300/...` 條目，npm install 時會自動觸發各自的 `prepare` script 建置。
- `resources/js/lib/*.js`（`platform.js`、`ffmpeg-commands.js` 等）**仍然留在這裡**——這些是 `window.EstellaLib.*` 執行期全域變數，兩個工具的元件執行時都會呼叫它們，由 hub 統一提供這些 runtime globals。`platform.js` 已經有 `ytdlpPath()`（Phase D prep 加的），跟 `ffmpegPath()`/`qpdfCommand()`/`img2pdfCommand()` 同一套模式。
- `src/components/HamburgerMenu.jsx` 取代原本的 `#theme-toggle`：語言切換 + 深色/淺色切換 +「回到主選單」三項，設定頁之後再做。下拉面板用 `liquid-glass-react`，是玻璃面板的參考實作——做任何玻璃 UI 前先讀下面的「Liquid glass 製作指南」。
- Header 的麵包屑現在顯示**工具名稱**（如「Converter」/「Downloader」），不是舊版動態的檔案類型徽章。版本號顯示也搬到這裡的 `Header.jsx`（`.header-version`，讀 hub 自己的 `src/version.json`）——兩個工具套件都沒有自己的版本號顯示，避免組合後顯示錯誤版本。
- `useTheme.js`/`useUpdateChecker.js`/`UpdateBanner.jsx` 都在這裡（hub 層級關注點）。`localStorage` key 是 `sorai-theme`。`useUpdateChecker.js` 的 `REPO` 常數指向 `chchee3300/sorai-toolkit`。
- **`binaries/<platform>/`** 現在同時有 ffmpeg（Converter 用）跟 yt-dlp（Downloader 用，透過 `--ffmpeg-location` 共用同一份 ffmpeg，合併分離的 video/audio 串流）。`setup.mjs` 的 `setupYtDlp()` 從 yt-dlp 自己的 GitHub releases API 動態抓最新版（不是釘死版本），macOS 兩個 arch 資料夾共用一份 universal build（跟 ffmpeg 的 evermeet.cx build 同一套邏輯，CI 的 macOS job 也有對應的「populate other arch」複製步驟）。
- **`sorai-toolkit-converter` repo**（`E:\資料\tools\FileConverterApp` 本機資料夾）：`vite.lib.config.mjs` 產生 `dist/index.js`；`src/index.js` barrel export `{ ConverterApp }`。它自己的 `packaging/`/`.github/workflows/release.yml`/`.releaserc.json` 已經在 Phase C 完成後**退休移除**了——不會跟 hub 的版本衝突。
- **`sorai-toolkit-downloader` repo**（`E:\資料\tools\sorai-toolkit-downloader` 本機資料夾）：跟 Converter 同一套 dual-purpose 形狀（standalone dev harness + library build），`src/index.js` barrel export `{ DownloaderApp }`。核心邏輯在 `src/lib/ytdlp.js`（yt-dlp 指令建構 + `--progress-template` 輸出解析）+ `src/hooks/useDownloader.js`（`execCommand` 抓 metadata、`spawnProcess` + `spawnedProcess` 事件跑下載，跟 Converter 的 `useExecute.js` 同一套模式）。**選到 video-only 格式時，實際丟給 yt-dlp 的 `-f` 值會自動變成 `<format_id>+bestaudio`**（`resolveFormatSelector`）——單獨選 video-only 格式不會自動觸發合併，這是已經修過、有測試覆蓋的一個坑，不要漏掉。

## Packaging/CI/Release（Phase C 搬進來的，全部以這個 repo 為準）
- `packaging/{linux,windows,macos}/`、`.github/workflows/release.yml`、`.releaserc.json`、`scripts/{get-next-version,write-version}.mjs` 都是從舊 FileConverterApp repo 搬過來的，搬的時候做了**耦合修正**（這幾個一定要一起改，改一半會讓打包 job 靜默失敗）：所有 packaging 腳本裡 `dist/FileConverterApp/FileConverterApp-<platform>` → `dist/sorai-toolkit/sorai-toolkit-<platform>`（因為這裡的 `neutralino.config.json` 的 `cli.binaryName` 已經是 `"sorai-toolkit"`，`neu build` 的輸出路徑跟著變了）；`packaging/macos/Info.plist` 的 `CFBundleIdentifier` → `com.soraitoolkit.hub`；`packaging/linux/build.sh`/`installer.iss` 的 repo URL → 這個 hub repo 網址。
- **已經用真的指令驗證過，不是只看過程式碼**：`npm run build` → `neu build --release --embed-resources`（確認輸出真的在 `dist/sorai-toolkit/sorai-toolkit-win_x64.exe`）→ `pwsh packaging/windows/build.ps1 -Version <ver>`（真的呼叫本機已裝好的 Inno Setup 7 編譯出 `release-assets/sorai-toolkit-setup-<ver>-win_x64.exe`）→ 用 `/VERYSILENT` 實際安裝到 `%LocalAppData%\Programs\SORAI Toolkit\`（`PrivilegesRequired=lowest` 決定裝在使用者層級而非系統層級）→ 確認 `[Run]` postinstall 真的自動重開 app（沒有 `skipifsilent`）→ 截圖確認原生視窗標題是「SORAI Toolkit」、hub 選單正確顯示、版本號 `v0.1.0`、Converter 卡片存在、log 檔沒有 404 類錯誤（只有預期內、無害的 `favicon.ico` 404）→ 測完用 `/VERYSILENT` 跑 `unins000.exe` 解除安裝、清掉殘留資料夾，機器狀態還原乾淨。
- hub 的 `package.json` 新增了 `@semantic-release/*` 系列 devDependencies + `"release": "semantic-release"` script（跟舊 Converter repo 當初的版本號對齊）。

## 繼承自舊 FileConverterApp repo 的關鍵注意事項（都還適用）
- **`neutralino.config.json` 的 `cli.resourcesPath` 必須等於 `documentRoot`**（現在都是 `/web-dist/`）——不一致會讓打包版本開啟後變 404，`neu run` 測不出來，必須真的 `neu build --release` 測。
- **`defaultMode` 必須是 `"window"`**，不是 `"browser"`。
- **`modes.window.enableInspector` 必須是 `false`**。
- **`src/main.jsx` 必須監聽 `windowClose` 並呼叫 `Neutralino.app.exit()`**（`exitProcessOnClose: false` 需要這個才能讓關閉鈕生效）。
- **`useUpdateChecker.js` 下載 release asset 不能用瀏覽器 `fetch()`**（CORS 會擋掉），要用 `Neutralino.os.execCommand` 呼叫 `curl`。
- **`@neutralinojs/neu` 鎖在 `11.7.1`**（`latest` 的 `uuid` 依賴是 ESM-only，會讓 `npm install -g` 直接崩潰）。
- **解壓縮 zip 不能假設裸指令 `tar` 支援**（Windows 用 `System32\tar.exe` 全路徑，macOS/Linux 用 `unzip`）。
- **Linux `.deb`/`.rpm` 宣告 `gtk3`/`webkit2gtk` 依賴**（deb: `libgtk-3-0`/`libwebkit2gtk-4.1-0`；rpm: `gtk3`/`webkit2gtk4.1`）——Neutralino 開視窗需要，別拿掉。
- **`playwright` 必須是 `devDependencies`**，且 CI 全域設 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1'`——沒有的話每個 job 的 `npm ci` 都會下載瀏覽器，曾在 macOS runner 上因此炸硬碟。
- **`installer.iss` 的 `[Run]` 項目不能有 `skipifsilent`**——應用內更新用 `/VERYSILENT` 跑安裝檔，`skipifsilent` 會讓「安裝完自動開啟」完全不執行。

## Liquid glass 製作指南（app 內所有玻璃面板都必須 follow）
目前的參考實作是 hamburger 下拉選單（`src/components/HamburgerMenu.jsx` + `resources/styles.css` 的 `.hamburger-dropdown` 區塊）。之後任何新的玻璃面板（設定頁、新 dropdown、popover 等）都照這套規則做：

1. **玻璃語言（使用者實機 A/B 過好幾輪才定案的，不要自作主張改）**：`backdrop-filter: blur(1px) saturate(1.6)` + 淡 tint（深色 `rgba(13,16,22,0.3)`、淺色 `rgba(242,243,247,0.6)`，淺色必須跟 `--bg` 同色系）。重點是「近乎透明、後面內容看得到」——重霧面（如 blur 24px）不管 tint 調多少都像一塊實心板，一律不用。
2. **backdrop-filter 一律放在面板最上層的殼層元素**。這個 WebView2 引擎裡，backdrop-filter 放在任何後代元素上都是「computed 正確但完全不繪製」（實機 bisect 驗證過，`.glass-lens--flat` 跟 `.glass__warp` 都中過同一族 bug）。玻璃的 tint/blur 全部自己在殼層做，永遠不要依賴 library 內部的層。
3. **用 liquid-glass-react 時必須加的三個 CSS 修正**（照抄 `.hamburger-dropdown` 的做法）：
   - `.glass__warp` → `display:none`：它畫不出霧面，但它的 `filter: url(#...)` SVG 濾鏡鏈會合成一層均勻暗紗（bisect 實測：藏掉它面板從 (229,231,236) 回到跟背景一致的 (242,243,247)）。
   - `> .bg-black` → `display:none`：Tailwind v4 自動內容偵測不掃 node_modules，library 的 `opacity-0/20/100`、`mix-blend-overlay` gating class 都不存在、`.bg-black` 卻碰巧存在——兩個黑色 wash div 永遠全不透明（`overLight` prop 形同虛設；深色模式黑疊黑看不出來，淺色模式直接一塊黑）。`overLight` 固定傳 `false`。
   - library 行內的 `transition: all 0.2s` 全部 `transition: none !important` 關掉——不關的話，開啟動畫播放中途的重新量測會疊一段慢速尺寸過渡，變成黏糊感。
4. **開關動畫必須跟 `.lg-dropdown` 完全同參數**：同 keyframes（`lg-pop-down`/`lg-pop-up-out`）、0.14s/0.1s、置中 transform-origin。進出都用 ease-out，永遠不用 ease-in。動畫要 gate 在尺寸量測完成之後才開始（不然會在 `visibility:hidden` 期間播完、看起來像直接閃現）；動畫結束後要把 class 拆掉——forwards-fill 會讓殼層永久 GPU-promoted，而 promoted 元素的後代 backdrop-filter 在這個引擎不繪製。
5. **面板顏色不對（變灰/變暗）時，先實機逐層 bisect 找元兇，不要反射性調 tint alpha**——歷史上的灰就是 `.glass__warp` 暗紗造成的，跟 alpha 無關。
6. **驗證一律在真實 WebView2 視窗做**：`neu run` + `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9229` + Playwright `connectOverCDP`，截圖後用 System.Drawing 取樣像素比對（模板參考 git history 裡的 `tests/_verify_*.js`，用完即刪）。瀏覽器裡測不出這個引擎的 backdrop-filter 行為。

## 測試
- **Converter**：`node tests/test_conversion.js`、`test_drop.js`、`test_crop_ui.js`、`test_image_crop_commands.js`（每個瀏覽器導向的測試在 `page.goto` 後多了一步「先點 `.hub-card` 進入 Converter」，因為現在 hub-grid 有兩張卡片，Converter 卡片的點擊選擇器要小心不要跟 Downloader 的搞混）。改 Converter 邏輯要在 `sorai-toolkit-converter` repo 那邊改，這裡的 `node_modules` 需要重新 `npm install` 才會抓到新版。
- **Downloader**：`node tests/test_download.js`——用 `.hub-card:has-text("Downloader")` 選到正確的卡片，實際貼一個真實短片網址（"Me at the zoo"，YouTube 上第一支影片，~19 秒）測試 metadata fetch + 真的下載，並且**特意選一個 video-only 格式**（不是預設值）確認 `--ffmpeg-location` 合併真的有效——用 `ffmpeg -i` 檢查輸出檔案同時有 Video 跟 Audio 串流，不是只確認檔案存在。原生資料夾選擇對話框沒辦法用 Playwright 驅動，測試裡用 `window.Neutralino.os.showFolderDialog = async () => dir` 直接 mock 掉。改 Downloader 邏輯要在 `sorai-toolkit-downloader` repo 那邊改，一樣要重新 `npm install` 才會抓到新版。
- 全部一起驗證過（Phase D 完成時）：`rm -rf node_modules package-lock.json && npm install` 觸發兩個套件的 `prepare` build，`npm run build` 成功，5 個測試套件全部通過（60+22+13+19+11 = 125 個檢查）。
