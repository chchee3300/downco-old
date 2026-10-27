# 01: PDF 壓縮等級設定

**What to build:** Converter 的 PDF 設定選「壓縮」時，多一個等級下拉：最小／平衡／高品質，預設是「平衡」。等級會存進 Converter 設定、右鍵預設與「存成右鍵預設」，也會出現在自動產生的預設名稱裡（不是預設等級時）。舊設定和舊的 `presets.json` 不需要遷移，讀進來就是「平衡」。這張票的壓縮本身仍然走 qpdf，等級先只是傳到 plugin。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Converter `PdfSettings` 加 `level`（`screen`／`ebook`／`printer`），serde 預設 `ebook`；JS `DEFAULT_PDF` 也帶 `level: 'ebook'`
- [ ] 選「壓縮」才顯示等級下拉，選「線性化」時隱藏；文案繁中＋英文
- [ ] hub 內建 `pdf-compress` 的 settings 明確寫 `level: "ebook"`；`suggest_name` 對非預設等級加上等級名稱
- [ ] cargo test：沒有 `level` 的舊 JSON 反序列化成 `ebook`；`suggest_name` 的新案例
- [ ] E2E：選壓縮＋最小並轉檔成功；存成右鍵預設後 `list_presets` 裡有 `level`
