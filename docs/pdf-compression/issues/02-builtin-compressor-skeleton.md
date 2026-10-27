# 02: 內建 PDF 壓縮器（骨架＋不會變大）

**What to build:** 選「壓縮」時，Converter 不再呼叫 qpdf，而是在 Rust 裡壓縮 PDF：所有串流用最高等級 Flate 重壓（比較小才換）、移除頁面縮圖與 `PieceInfo`、清掉沒用到的物件、內容一樣的串流合併成一份。如果結果沒有比原檔小，就把原檔複製成輸出，並在佇列和進度視窗顯示「已無法再壓縮」，這不算錯誤，右鍵批次仍算成功。「線性化」維持 qpdf。

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] 壓縮在 plugin 的 job 執行流程裡執行，取消、進度、刪除半成品的行為與現有 sidecar job 一致
- [ ] 加密的 PDF 給出與目前 PDF 轉檔一樣的錯誤訊息
- [ ] 「已無法再壓縮」透過 job 結果傳給 UI（Converter 佇列與 hub 進度視窗都顯示，狀態仍是成功）
- [ ] 文字、字型、連結、書籤、表單欄位不受影響（`qpdf --check` 通過、頁數相同）
- [ ] cargo test：重複串流合併、縮圖移除、不會變大時輸出等於原檔
- [ ] E2E：壓縮 fixture PDF 成功；已經壓過的 PDF 顯示「已無法再壓縮」
