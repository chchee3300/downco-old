# 04: Ghostscript 路線與「轉換引擎」設定（不含下載）

**What to build:** 電腦上已經有 Ghostscript 時，壓縮會同時用內建壓縮器和 Ghostscript（`pdfwrite`，`-dPDFSETTINGS` 對應等級、`-dCompatibilityLevel=1.6`）跑，取比較小的結果；Ghostscript 失敗時沿用內建結果。hub 設定新增「轉換引擎」區塊，顯示 Ghostscript 的狀態（使用電腦上已有的程式／未安裝），可以用「使用我的程式…」指定 `gswin64c.exe`（或 `gs`），也可以按「重新檢查」。Converter 的 PDF 設定在選「壓縮」時多一行狀態：已啟用 Ghostscript，或「安裝 Ghostscript 可以壓得更小」（連到設定）。macOS／Linux 偵測 PATH 與 Homebrew 位置的 `gs`，沒有的話顯示 brew／apt 安裝指令。

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] 引擎路徑解析順序：使用者指定 → app 自己的副本（這張票先保留位置，05 才會放東西）→ PATH；使用者指定的路徑存在 app config 的 `engines.json`
- [ ] app 指令：`engine_status`、`engine_set_path`（清除也用它）
- [ ] 兩條路各寫暫存檔，取最小，兩者都不比原檔小時走 02 的「已無法再壓縮」；取消時兩邊都停，暫存檔清掉
- [ ] 設定頁區塊用 `.settings-section`（不用玻璃面板），文案繁中＋英文，每個引擎標示授權（AGPL-3.0）與官網連結
- [ ] cargo test：路徑解析順序、GS 參數、取最小
- [ ] E2E：用一個假的 gs（會寫出固定大小輸出的小程式／腳本）驗證「使用我的程式…」、狀態顯示、取最小
