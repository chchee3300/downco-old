# 13: Windows NSIS 安裝檔和右鍵選單

**What to build:** Windows 使用者能用 NSIS 安裝檔，在使用者層級安裝 SORAI Toolkit，不需要管理員權限。安裝後，在影片、圖片、音訊、PDF 上按右鍵，會有 SORAI Toolkit 的層疊選單，點擊後檔案進到 app 的佇列並套用對應的動作。解除安裝時會清掉右鍵選單。

**Blocked by:** 10（Hub：單一實例、啟動參數、pendingLaunch）

**Status:** ready-for-agent

- [ ] Tauri bundler 產出 per-user 的 NSIS 安裝檔，sidecar 和 resource 都正確打包
- [ ] 右鍵選單的產生腳本改成輸出 NSIS installer hook（安裝時寫入、解除安裝時清除），格式清單的同步規則不變
- [ ] 本機跑 `tauri build` 之後，用 /S 靜默安裝、啟動、解除安裝都成功，機器狀態還原乾淨
- [ ] 使用者真機驗證：右鍵多選 3 個檔案轉檔，只開一個視窗，而且 3 個檔案都進到佇列
