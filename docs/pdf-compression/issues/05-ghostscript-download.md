# 05: Ghostscript 下載、安裝與移除（Windows）

**What to build:** 在「轉換引擎」設定裡按「安裝」，app 會下載 Ghostscript 並裝在使用者的 app 資料夾，顯示進度，可以取消；裝好之後狀態變成「已安裝」，壓縮自動使用。按「移除」就刪掉。解除安裝 SORAI Toolkit 時一併刪除；app 更新時保留。

**Blocked by:** 04

**Status:** done

- [x] 套件固定為 SPEC 裡的 conda-forge 網址、SHA-256、大小（寫在程式碼裡）；SHA 不符就拒絕並刪除下載檔
- [x] 解開 `.conda`（zip → `pkg-*.tar.zst`），只取 `Library/bin`，放到 `%LOCALAPPDATA%\<identifier>\engines\ghostscript\`；下載到暫存位置、驗證、解壓後再 rename，中途失敗或取消不會留下半套
- [x] 先實際下載一次真的套件確認：只有 `Library/bin` 的 `gswin64c.exe` 能不能獨立執行 pdfwrite（Init／Font 資源是否編進 `gsdll64.dll`）；不行的話就把需要的資源資料夾一起解出來，並在 SPEC 記下
- [x] app 指令：`engine_install`（Channel 回報進度）、`engine_cancel`、`engine_remove`
- [x] NSIS 解除安裝 hook 刪除 engines 資料夾
- [x] dev build 可以用環境變數覆寫網址與 SHA（正式版不讀）
- [x] cargo test：SHA 不符時拒絕、用小的假 `.conda` 測只取 `Library/bin`
- [x] E2E：本機 HTTP server 提供假套件，安裝 → 狀態「已安裝」→ 移除；中途取消不留下資料夾
- [x] macOS／Linux 不顯示「安裝」按鈕
