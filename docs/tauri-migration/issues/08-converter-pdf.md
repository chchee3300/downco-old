# 08: Converter：PDF 壓縮和圖片轉 PDF

**What to build:** 使用者能壓縮 PDF，也能把圖片轉成 PDF（跟現行版本一樣，每張圖片各產生一份 PDF），行為跟現行版本一致。

**Blocked by:** 06（Converter：影片、音訊、圖片轉檔 job）

**Status:** done（NSIS 安裝版的 qpdf DLL 待第 13 張驗證）

- [x] qpdf（含 DLL）和 img2pdf 能在 Tauri 版執行：先試 sidecar 的方式，找不到 DLL 的話，就改成整包當 resource、用完整路徑執行；hub 的 sidecar 複製腳本和打包設定要同步更新
- [x] qpdf 和 img2pdf 的指令建構在 Rust 端，用 `cargo test` 覆蓋
- [x] E2E：壓縮 fixture PDF，產出有效而且比較小的檔案；兩張圖片各產生一份有效的單頁 PDF（ticket 原本寫成「合成一份兩頁」，與現行行為不符，已更正）
