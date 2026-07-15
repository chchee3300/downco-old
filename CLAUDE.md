# Claude 自動化測試指引 (sorai-toolkit hub)

這是 SORAI Toolkit 的**主 repo**（Neutralino 殼層 + hub 選單 + 之後的 packaging/CI）。目前狀態：多 repo 重構的 **Phase A**（Converter 還是整包直接複製進來，尚未變成 npm git dependency）——完整分階段計畫在 `~/.claude/plans/mac-linux-reactive-metcalfe.md`，繼續這個重構前務必先讀那份計畫。

## 現況（Phase A）
- `src/App.jsx` 是 hub 殼層：`currentTool` state 切換 `HubMenu`/`ConverterView`，沒有 router。
- `src/components/ConverterView.jsx` 是從舊 FileConverterApp repo 的 `App.jsx` 抽出來的 Converter 內容，整包複製、尚未變成獨立套件（Phase B 才會抽成 `sorai-toolkit-converter` 的 git dependency）。
- `src/components/HamburgerMenu.jsx` 取代原本的 `#theme-toggle`：只有「回到主選單」+ 深色/淺色切換兩項，語言/設定之後再做。
- Header 的麵包屑現在顯示**工具名稱**（如「Converter」），不是舊版動態的檔案類型徽章（`#type-badge` 這個元素已經不存在——測試裡對應的斷言已經拿掉/改寫，不是 regression）。
- `useTheme.js`/`useUpdateChecker.js`/`UpdateBanner.jsx` 都搬到這裡了（hub 層級關注點）。`localStorage` key 已從 `estella-theme` 改成 `sorai-theme`。`useUpdateChecker.js` 的 `REPO` 常數已指向 `chchee3300/sorai-toolkit`（這個 repo 還沒有 release，所以目前永遠查不到更新，正常）。
- `platform.js`/`setup.mjs`/`binaries/` 目前是從舊 repo **整包複製**過來的（還沒做計畫裡說的「promotion + yt-dlp 支援」），先求能動。

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
`node tests/test_conversion.js`、`test_drop.js`、`test_crop_ui.js`、`test_image_crop_commands.js` 都已經搬進來並改好（每個瀏覽器導向的測試在 `page.goto` 後多了一步「先點 `.hub-card` 進入 Converter」）。Phase A 驗證時全部 114 個檢查都過。修改 Converter 相關邏輯後，一樣要跑這 4 個套件確認沒有 regression。
