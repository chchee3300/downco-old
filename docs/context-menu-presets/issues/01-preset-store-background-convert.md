# 01: 預設儲存與背景轉檔的最短路徑

**What to build:** 已安裝的使用者用 `--sorai-preset=<id> <檔案...>` 啟動 app（也就是之後右鍵選單會送出的指令）時，app 會開出一個獨立的小進度視窗，依序把檔案用該預設轉好，主視窗不出現。全部成功後，進度視窗 3 秒後自動關閉；如果 app 原本沒有在執行，就整個結束。hub 端有預設儲存檔和內建預設清單；2.0.0 的舊旗標 `--sorai-convert-to`、`--sorai-quick-action` 照舊可用。

**Blocked by:** None (can start immediately)

**Status:** done

- [x] hub 擁有預設儲存檔，位置在 app 設定目錄裡的一個 JSON 檔，Rust 指令能讀取；檔案不存在時用內建預設：每種類型的「轉成 X」、影片的快速壓縮 5/25/50MB、壓縮 PDF；每個預設的參數形狀與 Converter 的 settings[fileType] 相同
- [x] `--sorai-preset=<id>` 冷啟動時不顯示主視窗；已經在執行時，由 single-instance 轉發、走既有的 500ms 去抖動，同一個預設合併成一批
- [x] 進度視窗是第二個 Tauri 視窗（約 420×300），透過 Converter plugin 既有的 start_convert 依序轉檔，輸出放在來源檔旁邊，沿用既有的不覆蓋命名規則
- [x] 全部成功後 3 秒關閉進度視窗；如果主視窗從來沒顯示過、也沒縮到系統匣，就結束 app
- [x] 舊旗標的行為不變（打開主視窗、放進佇列、套用格式）
- [x] cargo test：內建預設的內容、預設儲存檔的讀寫
- [x] E2E：直接帶參數啟動 exe，跑一個內建預設、兩個檔案：進度視窗出現、輸出檔正確（用 ffmpeg 檢查）、自動關閉、app 結束、主視窗始終沒出現；舊旗標的 single-instance 測試仍然通過
