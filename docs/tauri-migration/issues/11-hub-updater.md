# 11: Hub：自動更新

**What to build:** 官方版偵測到新版時，在右下角顯示提示，可以一鍵更新並自動重開，過程中用 updater plugin 驗證簽章。自架版只在漢堡選單和關於頁顯示徽章，點擊後開啟 GitHub release 頁面。

**Blocked by:** 01（Plugin 骨架、跨 repo 開發模式、E2E 測試框架）

**Status:** ready-for-agent

- [ ] 保留檢查 GitHub Releases 的邏輯和 IS_OFFICIAL_BUILD 的分流
- [ ] 官方版走 updater plugin，端點指向 GitHub release 裡的 latest.json；公鑰欄位先留佔位，真正的金鑰在第 14 張填入
- [ ] 非官方版用 opener 開啟 release 頁面；移除 curl 下載和 /VERYSILENT 的流程
- [ ] E2E：攔截 GitHub API、偽造一個新版本，確認非官方 build 不顯示 toast、徽章有出現、點擊後會呼叫開啟網址
