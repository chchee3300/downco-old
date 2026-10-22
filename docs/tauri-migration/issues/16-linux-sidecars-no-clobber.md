# 16: Linux：sidecar 不佔用 /usr/bin、不取代系統套件

**What to build:** Linux 使用者安裝 SORAI Toolkit 的 deb/rpm 後，系統原本的 ffmpeg、yt-dlp 套件完全不受影響（不會被移除、取代或覆蓋），SORAI Toolkit 照樣使用自己附帶的 ffmpeg 與 yt-dlp。Windows 與 macOS 的行為不變。

**Blocked by:** 14（Linux、macOS 打包和 CI release workflow）

**Status:** done（Linux 實際安裝待真機驗證）

- [x] Linux 的 deb/rpm 不再把 ffmpeg、yt-dlp 安裝到 `/usr/bin`；移除第 14 張加的 Conflicts/Replaces/Provides（含 `ffmpeg-free`）
- [x] 附帶的 ffmpeg、yt-dlp 裝在 app 自己的目錄（例如以 Tauri resources 安裝到 `/usr/lib/<app>/`），兩個 plugin 的 sidecar 解析順序為：app 資源目錄 → exe 旁 → PATH（原本寫 exe 旁優先，但 Linux 安裝版 exe 在 /usr/bin，會先找到系統的 ffmpeg，故調整；Windows/開發模式資源目錄即 exe 目錄，macOS 在 Contents/MacOS 找到，行為不變）
- [x] Downloader 傳給 yt-dlp 的 `--ffmpeg-location` 指向同一份解析出來的 ffmpeg
- [x] 解析邏輯有 `cargo test`（兩個 plugin 各自）
- [ ] Windows 的 E2E 全部仍通過；Linux 實際安裝待真機驗證
