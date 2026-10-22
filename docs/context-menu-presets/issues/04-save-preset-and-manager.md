# 04: 存成右鍵預設與 hub 預設管理

**What to build:** 使用者在 Converter 調好參數後，按「存成右鍵預設」就會建立一個新預設，名稱自動產生、可以改。在 hub 設定頁的「右鍵選單預設」區塊可以看到所有預設，能改名、刪除、上移／下移、還原預設。任何變更都會馬上重寫右鍵選單。

**Blocked by:** 02（由 app 寫入右鍵選單（含語言））

**Status:** ready-for-agent

- [ ] hub 透過執行期全域 `window.SoraiPresets` 把預設功能提供給 Converter（跟 SoraiDialogs 同一套宿主契約，在呼叫當下才讀取）；Rust 指令包括新增／覆蓋、刪除、排序、還原、產生名稱
- [ ] Converter 設定面板加「存成右鍵預設」：存目前的類型、輸出格式和 settings[fileType]，不包括 Trim 與 Crop
- [ ] 名稱自動產生（例如「MP4・畫質 70・720p」），有 cargo test
- [ ] hub 設定頁新增 `.settings-section` 區塊（不套玻璃語言），有清單、改名、刪除、上移／下移、還原預設；`--sorai-presets` 會打開這裡
- [ ] 每次變更後重寫右鍵選單
- [ ] E2E：從 Converter 存一個預設 → hub 清單裡出現 → 改名、排序、刪除、還原都反映在清單上，也反映在寫入的選單內容上 → 用 `--sorai-preset=<新 id>` 啟動能用它轉檔
