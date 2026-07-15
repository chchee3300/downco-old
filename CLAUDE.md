# Claude 自動化測試指引 (sorai-toolkit hub)

這是 SORAI Toolkit 的**主 repo**（Neutralino 殼層 + hub 選單 + 之後的 packaging/CI）。目前狀態：多 repo 重構的 **Phase B 完成**（Converter 已經抽成獨立 repo `sorai-toolkit-converter`，hub 透過 npm git dependency 消費它，不再整包複製）——完整分階段計畫在 `~/.claude/plans/mac-linux-reactive-metcalfe.md`，繼續這個重構前務必先讀那份計畫。下一步是 **Phase C**（搬 packaging/CI/release 到這個 repo）。

## 現況（Phase B）
- `src/App.jsx` 是 hub 殼層：`currentTool` state 切換 `HubMenu`/`ConverterApp`，沒有 router。`ConverterApp` 從 `sorai-toolkit-converter` 套件 import，不再是本地檔案。
- Converter 的所有元件/hooks（`ConverterView`、`DropZone`、`FileList`、`GlassSelect`、`SettingsPanel` 等）已經從這個 repo 刪除——它們現在活在 `sorai-toolkit-converter` repo 裡，透過 `node_modules/sorai-toolkit-converter/dist/index.js`（Vite library build）提供。`package.json` 的 `dependencies` 有 `"sorai-toolkit-converter": "github:chchee3300/sorai-toolkit-converter"`，npm install 時會自動觸發該 repo 的 `prepare` script 建置。
- `resources/js/lib/*.js`（`platform.js`、`ffmpeg-commands.js` 等）**仍然留在這裡**——這些是 `window.EstellaLib.*` 執行期全域變數，`ConverterApp` 元件執行時會呼叫它們，即使程式碼移到套件裡了還是要由 hub 提供這些 runtime globals。
- `src/components/HamburgerMenu.jsx` 取代原本的 `#theme-toggle`：只有「回到主選單」+ 深色/淺色切換兩項，語言/設定之後再做。
- Header 的麵包屑現在顯示**工具名稱**（如「Converter」），不是舊版動態的檔案類型徽章（`#type-badge` 這個元素已經不存在——測試裡對應的斷言已經拿掉/改寫，不是 regression）。版本號顯示也搬到這裡的 `Header.jsx`（`.header-version`，讀 hub 自己的 `src/version.json`）——Converter 套件的 `StatusBar` 已經拿掉版本號顯示，避免組合後顯示錯誤版本。
- `useTheme.js`/`useUpdateChecker.js`/`UpdateBanner.jsx` 都在這裡（hub 層級關注點）。`localStorage` key 是 `sorai-theme`。`useUpdateChecker.js` 的 `REPO` 常數指向 `chchee3300/sorai-toolkit`（這個 repo 還沒有 release，所以目前永遠查不到更新，正常）。
- `platform.js`/`setup.mjs`/`binaries/` 目前還是舊架構（還沒做計畫裡說的「promotion + yt-dlp 支援」，那是 Phase C 的一部分），先求能動。
- **`sorai-toolkit-converter` repo**（`E:\資料\tools\FileConverterApp` 本機資料夾）現在是獨立套件：`vite.lib.config.mjs` 產生 `dist/index.js`（純 ESM，不含 CSS，React 當 peer dependency 排除在外）；`src/index.js` 是 barrel export `{ ConverterApp }`；`prepare` script 在 `npm install` 時自動建置。它自己的 `packaging/`/`.github/workflows/release.yml`/`.releaserc.json` 還留著（還沒退休，Phase C 才會處理），但不會被 hub 用到。

## 繼承自舊 FileConverterApp repo 的關鍵注意事項（都還適用）
- **`neutralino.config.json` 的 `cli.resourcesPath` 必須等於 `documentRoot`**（現在都是 `/web-dist/`）——不一致會讓打包版本開啟後變 404，`neu run` 測不出來，必須真的 `neu build --release` 測。
- **`defaultMode` 必須是 `"window"`**，不是 `"browser"`。
- **`modes.window.enableInspector` 必須是 `false`**。
- **`src/main.jsx` 必須監聽 `windowClose` 並呼叫 `Neutralino.app.exit()`**（`exitProcessOnClose: false` 需要這個才能讓關閉鈕生效）。
- **`useUpdateChecker.js` 下載 release asset 不能用瀏覽器 `fetch()`**（CORS 會擋掉），要用 `Neutralino.os.execCommand` 呼叫 `curl`。
- **`@neutralinojs/neu` 鎖在 `11.7.1`**（`latest` 的 `uuid` 依賴是 ESM-only，會讓 `npm install -g` 直接崩潰）。
- **解壓縮 zip 不能假設裸指令 `tar` 支援**（Windows 用 `System32\tar.exe` 全路徑，macOS/Linux 用 `unzip`）。

完整版（含 Linux gtk3/webkit2gtk 套件依賴、playwright devDependency 位置、update-toast z-index、installer.iss `skipifsilent` 等 packaging/CI 專屬細節）留到 Phase C 把 `packaging/`/`.github/workflows/release.yml` 搬過來時再一併補齊——那些目前這個 repo 還用不到。

## 測試
`node tests/test_conversion.js`、`test_drop.js`、`test_crop_ui.js`、`test_image_crop_commands.js` 都已經搬進來並改好（每個瀏覽器導向的測試在 `page.goto` 後多了一步「先點 `.hub-card` 進入 Converter」）。Phase B 驗證時（`rm -rf node_modules package-lock.json && npm install` 觸發 Converter 套件的 `prepare` build 之後）全部 114 個檢查都過。修改 Converter 相關邏輯後，一樣要跑這 4 個套件確認沒有 regression——注意現在改 Converter 邏輯要在 `sorai-toolkit-converter` repo 那邊改，這裡的 `node_modules` 需要重新 `npm install` 才會抓到新版。
