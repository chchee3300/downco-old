# 05: PDF 擷取頁面、分割、旋轉、加密碼

**What to build:**
- PDF 設定的下拉改名「操作」，列出：壓縮、線性化、擷取頁面、分割、旋轉、加密碼。
  - 擷取頁面：頁碼範圍輸入框。
  - 旋轉：角度下拉（90／180／270），加上可留空的範圍。
  - 加密碼：密碼輸入框（`type=password`）。
- 分割的輸出是新資料夾 `<檔名>_pages/`，佇列那一列顯示總大小。
- 範圍不合法、沒有密碼時，只讓那一個檔案失敗（顯示 → failed），不中斷批次。
- log 不出現密碼。
- 每個操作都可以存成右鍵預設，`suggest_name` 給出操作名稱，加上範圍或角度。

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] E2E：
  - 擷取 `1` → 1 頁
  - 旋轉 90 → 每頁 `/Rotate` 是 90（`qpdf --json` 或 `--show-pages`）
  - 加密 → `qpdf --show-encryption` 有 AES-256，terminal log 裡找不到密碼
  - 分割 → 資料夾裡的檔案數等於頁數
  - 範圍填 `abc` → 該列 failed
- [ ] 壓縮與線性化的既有 E2E 照常通過；等級下拉照舊只在壓縮時出現
- [ ] hub cargo test：`suggest_name` 的 PDF 操作案例
