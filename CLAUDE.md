# Claude 自動化測試指引 (sorai-toolkit hub)

這是 SORAI Toolkit 的**主 repo**（Neutralino 殼層 + hub 選單 + packaging/CI/release）。目前狀態：多 repo 重構的 **Phase C 完成**（Converter 是獨立 repo `sorai-toolkit-converter`，透過 npm git dependency 消費；packaging/CI/release 全部搬到這個 repo，已用真的 `neu build --release --embed-resources` + `packaging/windows/build.ps1` 產生安裝檔並實際安裝/啟動驗證過）——完整分階段計畫在 `~/.claude/plans/mac-linux-reactive-metcalfe.md`，繼續這個重構前務必先讀那份計畫。下一步是 **Phase D**（開發全新的 yt-dlp Downloader 工具）。

## 現況（Phase B）
- `src/App.jsx` 是 hub 殼層：`currentTool` state 切換 `HubMenu`/`ConverterApp`，沒有 router。`ConverterApp` 從 `sorai-toolkit-converter` 套件 import，不再是本地檔案。
- Converter 的所有元件/hooks（`ConverterView`、`DropZone`、`FileList`、`GlassSelect`、`SettingsPanel` 等）已經從這個 repo 刪除——它們現在活在 `sorai-toolkit-converter` repo 裡，透過 `node_modules/sorai-toolkit-converter/dist/index.js`（Vite library build）提供。`package.json` 的 `dependencies` 有 `"sorai-toolkit-converter": "github:chchee3300/sorai-toolkit-converter"`，npm install 時會自動觸發該 repo 的 `prepare` script 建置。
- `resources/js/lib/*.js`（`platform.js`、`ffmpeg-commands.js` 等）**仍然留在這裡**——這些是 `window.EstellaLib.*` 執行期全域變數，`ConverterApp` 元件執行時會呼叫它們，即使程式碼移到套件裡了還是要由 hub 提供這些 runtime globals。
- `src/components/HamburgerMenu.jsx` 取代原本的 `#theme-toggle`：只有「回到主選單」+ 深色/淺色切換兩項，語言/設定之後再做。
- Header 的麵包屑現在顯示**工具名稱**（如「Converter」），不是舊版動態的檔案類型徽章（`#type-badge` 這個元素已經不存在——測試裡對應的斷言已經拿掉/改寫，不是 regression）。版本號顯示也搬到這裡的 `Header.jsx`（`.header-version`，讀 hub 自己的 `src/version.json`）——Converter 套件的 `StatusBar` 已經拿掉版本號顯示，避免組合後顯示錯誤版本。
- `useTheme.js`/`useUpdateChecker.js`/`UpdateBanner.jsx` 都在這裡（hub 層級關注點）。`localStorage` key 是 `sorai-theme`。`useUpdateChecker.js` 的 `REPO` 常數指向 `chchee3300/sorai-toolkit`（這個 repo 還沒有 release，所以目前永遠查不到更新，正常）。
- `platform.js`/`setup.mjs`/`binaries/` 目前還是舊架構（還沒做計畫裡說的「promotion + yt-dlp 支援」——那是 Phase D 真正動手做 Downloader 時才需要，Phase C 只搬了 packaging/CI，沒動這部分）。
- **`sorai-toolkit-converter` repo**（`E:\資料\tools\FileConverterApp` 本機資料夾）是獨立套件：`vite.lib.config.mjs` 產生 `dist/index.js`（純 ESM，不含 CSS，React 當 peer dependency 排除在外）；`src/index.js` 是 barrel export `{ ConverterApp }`；`prepare` script 在 `npm install` 時自動建置。它自己的 `packaging/`/`.github/workflows/release.yml`/`.releaserc.json` 還留著、還沒退休——目前不會被 hub 用到，但也還沒刪，因為那個 repo 自己的 release pipeline 理論上還能跑（只是沒有意義，應該找時間關掉）。

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

## 測試
`node tests/test_conversion.js`、`test_drop.js`、`test_crop_ui.js`、`test_image_crop_commands.js` 都已經搬進來並改好（每個瀏覽器導向的測試在 `page.goto` 後多了一步「先點 `.hub-card` 進入 Converter」）。Phase B 驗證時（`rm -rf node_modules package-lock.json && npm install` 觸發 Converter 套件的 `prepare` build 之後）全部 114 個檢查都過。修改 Converter 相關邏輯後，一樣要跑這 4 個套件確認沒有 regression——注意現在改 Converter 邏輯要在 `sorai-toolkit-converter` repo 那邊改，這裡的 `node_modules` 需要重新 `npm install` 才會抓到新版。
