# 02: 內建 PDF 壓縮器（骨架＋不會變大）

**What to build:** 選「壓縮」時，Converter 不再呼叫 qpdf，而是在 Rust 裡壓縮 PDF：所有串流用最高等級 Flate 重壓（比較小才換）、移除頁面縮圖與 `PieceInfo`、清掉沒用到的物件、內容一樣的串流合併成一份。如果結果沒有比原檔小，就把原檔複製成輸出，並在佇列和進度視窗顯示「已無法再壓縮」，這不算錯誤，右鍵批次仍算成功。「線性化」維持 qpdf。

**Blocked by:** 01

**Status:** done

- [x] 壓縮在 plugin 的 job 執行流程裡執行，取消、進度、刪除半成品的行為與現有 sidecar job 一致
- [x] 有 `/Encrypt` 的 PDF 不走內建壓縮器，改回現在的 qpdf 路線（lopdf 載入時會解掉只有擁有者密碼的加密，存檔就會默默拿掉加密；qpdf 會保留）。需要開啟密碼的 PDF 照樣得到現在的 qpdf 錯誤訊息
- [x] 程式內的 job 也要能取消（sidecar 的 kill 對它無效）：加取消旗標，並保護最後的寫檔，不被取消逾時的清理刪掉；照樣送出 `> Executing:` log 行（E2E 的 `run()` 會數它）
- [x] 既有 E2E 斷言 `qpdf --stream-data=compress` 的地方改成新的行為
- [x] 「已無法再壓縮」透過 job 結果傳給 UI（Converter 佇列與 hub 進度視窗都顯示，狀態仍是成功）
- [x] 文字、字型、連結、書籤、表單欄位不受影響（`qpdf --check` 通過、頁數相同）
- [x] cargo test：重複串流合併、縮圖移除、不會變大時輸出等於原檔
- [x] E2E：壓縮 fixture PDF 成功；已經壓過的 PDF 顯示「已無法再壓縮」
