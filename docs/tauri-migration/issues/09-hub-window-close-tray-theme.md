# 09: Hub：視窗生命週期、關閉行為、系統匣、通知、主題圖示

**What to build:** 使用者開啟 app 時，視窗置中、可見、可以點擊。按關閉鈕時，依設定處理：詢問、縮到系統匣、或直接結束。縮到系統匣後，可以從系統匣選單開啟或結束。第一次縮到背景時會收到一次通知。切換深淺主題時，視窗和工作列的圖示跟著換。設定頁和關於頁的外部連結能開啟瀏覽器。

**Blocked by:** 01（Plugin 骨架、跨 repo 開發模式、E2E 測試框架）

**Status:** ready-for-agent

- [ ] 視窗以隱藏狀態建立，確認後再顯示、置中、取得焦點；Neutralino 專屬的位置和 iconic workaround 不出現在 Tauri 路徑上
- [ ] 攔截 close-requested，依 sorai-close-behavior 分流；CloseConfirmModal 和 SettingsModal 照常運作
- [ ] 用到的 Tauri 功能：tray（開啟、結束程式）、notification plugin、window setIcon、opener plugin
- [ ] E2E：三種關閉行為設定下按關閉的結果（ask 顯示 modal；tray 隱藏視窗但程序還在；quit 結束程序）；切換主題不會報錯
- [ ] 系統匣互動和工作列圖示需要使用者在真機上確認
