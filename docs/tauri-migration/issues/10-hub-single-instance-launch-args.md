# 10: Hub：單一實例、啟動參數、pendingLaunch

**What to build:** app 已經開著時再次啟動，不會開第二個視窗，而是把既有的視窗拉到前景。帶 --sorai-convert-to 或 --sorai-quick-action 參數啟動時，不管是冷啟動還是轉發給已開啟的實例，檔案都會進到 Converter 佇列，並套用對應的格式或快速壓縮模式。連續 N 次、每次帶一個檔案的啟動（模擬右鍵多選）會合併成一次 pendingLaunch。

**Blocked by:** 06（Converter：影片、音訊、圖片轉檔 job）, 09（Hub：視窗生命週期、關閉行為、系統匣、通知、主題圖示）

**Status:** ready-for-agent

- [ ] 用 single-instance plugin 取代 lock 檔、PID 檢查、pending-launch 目錄輪詢；argv 轉發後用 500ms 去抖動合併
- [ ] 啟動參數解析改讀 Tauri 的 argv，--sorai-* 的語意不變，pendingLaunch 的形狀維持 {seq, files, format, quickAction}
- [ ] Tauri 路徑上不再使用 instanceLock 和 Neutralino 版的 useSingleInstance
- [ ] E2E：從命令列連續啟動 3 次、每次帶一個檔案，結果只有一個視窗，佇列裡有 3 個檔案而且格式套用正確；compress-under:50 會切換到目標大小模式
