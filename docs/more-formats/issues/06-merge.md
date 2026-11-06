# 06: 合併成一個檔案＋佇列排序

**What to build:**
- 佇列每一列多上移、下移按鈕。
- 佇列有 ≥ 2 個影片、音訊或 PDF，而且（影片時）輸出不是 GIF／APNG／PNG／只取音訊時，設定區出現「合併成一個檔案」勾選。勾選狀態不會存進預設；PDF 勾選後，隱藏操作下拉。
- 執行時只跑一個 plugin 指令 `start_merge`（要加進 `build.rs` 的 COMMANDS 和 permissions，`plugin.js` 加上 `startMerge`），輸出 `<第一個檔名>_merged.<ext>`；concat 清單寫到 temp 的 `sorai-toolkit/concat/`，跟縮圖一樣做 24 小時清理。
- 成功時在狀態列和 log 顯示輸出；失敗時把錯誤標在第一列；可以取消，取消後不留半成品。

**Blocked by:** 03, 04, 05

**Status:** ready-for-agent

- [ ] E2E：兩段影片（其中一段沒有聲音、解析度不同）合併成 MP4：長度約等於兩段相加、有聲音、解析度等於第一段
- [ ] E2E：兩段同規格的影片＋保留原編碼：log 有 `-f concat`，輸出長度正確
- [ ] E2E：兩首 mp3 合併：長度約等於兩首相加
- [ ] E2E：兩份 PDF 合併：頁數相加；先下移再合併，順序跟著改（第一頁來自被移上去的那份）
- [ ] E2E：只有 1 個檔案時沒有勾選框；輸出是 GIF 時沒有勾選框
- [ ] E2E：合併中取消，沒有殘留 `_merged` 檔
