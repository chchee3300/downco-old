# 07: 全套回歸與真機驗收

**What to build:** 確認整個分支可以發版，並列出要使用者自己在真機上確認的項目。

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] converter `cargo test`、hub `cargo test`、hub 完整 `npm run test:e2e` 全部通過
- [ ] 兩個 repo 的 CLAUDE.md 反映所有新行為（格式清單手動複本的位置、`.ts` 不進右鍵選單、`start_merge`、分割輸出是資料夾）
- [ ] 給使用者一份真機清單：
  - Explorer 右鍵 `.mov`、`.m2ts`、`.wma` 出現選單，`.ts` 沒有
  - `video-to-mp3` 右鍵可用
  - 用滑鼠拖曳排序的手感
  - 加密的 PDF 在 Acrobat 或瀏覽器裡要輸入密碼才能開
