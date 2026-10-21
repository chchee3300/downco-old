# Spec：SORAI Toolkit 從 Neutralino 遷移到 Tauri v2（Phase 1–4）

狀態：`ready-for-agent`　·　範圍：`sorai-toolkit`（hub）、`sorai-toolkit-converter`、`sorai-toolkit-downloader` 三個 repo 的 `tauri` 分支　·　前置：Phase 0 已完成（hub `tauri` 分支 commit `a34d7ce`）

## Problem Statement

使用者沒辦法把檔案從檔案總管拖進 SORAI Toolkit 視窗開始轉檔。拖進去游標會變成禁止符號，什麼事都不會發生，只能改用「點擊瀏覽」選檔。這個問題出在 Neutralino 本身：WebView2 會攔下外部拖曳，`filesDropped` 事件永遠不觸發（neutralinojs#1795）。最新的 v6.10.0 也還沒修，修正 PR #1845 也還沒 merge，應用層沒有辦法繞過。

除了拖曳以外，Neutralino 殼層還帶來一整串維護負擔：
- 單一實例要靠手寫的 lock 檔、PID 檢查和輪詢目錄來實作。
- 預覽和縮圖要靠 `server.mount` 開本機路徑。
- 自動更新要自己用 `curl` 下載安裝檔再靜默安裝。
- 視窗在隱藏建立時會跑到螢幕外或被最小化，需要額外的 workaround。

## Solution

把三個 repo 從 Neutralino 搬到 Tauri v2，維持三 repo 的拆法，並把業務邏輯從 JavaScript 搬到 Rust：

- **hub**：成為 Tauri app 本體，負責殼層功能（視窗、系統匣、單一實例、啟動參數、自動更新、系統整合、打包發佈），並把 ffmpeg/yt-dlp/qpdf/img2pdf 當成 sidecar 打包。
- **Converter、Downloader**：各自變成一個 Tauri plugin，內含兩部分：
  - Rust crate：指令建構、輸出解析、子程序管理
  - React UI 套件：現有元件幾乎原樣保留
- **hub 消費兩個 plugin 的方式**：用 cargo git dependency 加 npm git dependency，跟現在只用 npm git dependency 的形狀對應。

從使用者的角度來看：
- 介面、操作流程、語言、主題都跟現在一樣。
- 檔案可以直接拖進視窗。
- 右鍵選單、背景執行、自動更新照常運作。

## User Stories

### 拖曳與檔案輸入
1. As a 轉檔使用者, I want 把影片從檔案總管拖進視窗任何地方就加入佇列, so that 我不用每次都按「瀏覽」找檔案
2. As a 轉檔使用者, I want 一次拖多個檔案進來全部加入佇列, so that 批次轉檔更快
3. As a 轉檔使用者, I want 拖進來的檔案直接用原本的路徑處理、不先複製一份, so that 大檔案不用等複製也不佔額外空間
4. As a 轉檔使用者, I want 檔名含中文或空白的檔案也能拖進來, so that 我不用先改檔名
5. As a 轉檔使用者, I want 拖曳到視窗上時看到整個視窗的提示遮罩, so that 我知道放開就會加入
6. As a 轉檔使用者, I want 拖進不支援的檔案類型時被略過並看到提示, so that 我知道為什麼沒加進去
7. As a 轉檔使用者, I want 拖進已經在佇列裡的檔案時不重複加入, so that 佇列不會亂
8. As a 轉檔使用者, I want 拖進一個資料夾時被略過而不是當機, so that 誤操作不會出事
9. As a 轉檔使用者, I want 拖進類型混雜的檔案時跳出跟現在一樣的混合類型選擇視窗, so that 行為跟以前一致
10. As a 轉檔使用者, I want 「點擊瀏覽」用系統原生的多選檔案對話框, so that 拖曳以外的方式也照常可用

### Converter：轉檔功能（行為維持不變）
11. As a 轉檔使用者, I want 影片、圖片、音訊、PDF 的轉檔格式選項跟現在一樣, so that 我熟悉的操作不會變
12. As a 轉檔使用者, I want 加入檔案後看到縮圖、解析度、fps、原始編碼等來源資訊卡, so that 我確認選對檔案
13. As a 轉檔使用者, I want 轉檔時看到每個檔案的即時百分比進度, so that 我知道還要等多久
14. As a 轉檔使用者, I want 按取消後轉檔確實停止、不會卡在「Cancelling...」, so that 我能隨時中止
15. As a 轉檔使用者, I want 一個檔案失敗時其他檔案繼續轉, so that 批次不會整批白做
16. As a 轉檔使用者, I want 輸出檔名跟既有檔案衝突時自動避開覆蓋, so that 不會蓋掉原本的檔案
17. As a 轉檔使用者, I want 剪輯（Trim）視窗能播放預覽並拖拉選取時間範圍, so that 我只輸出需要的片段
18. As a 轉檔使用者, I want 裁切（Crop）視窗能看到預覽畫面並拖拉裁切框, so that 我能精準裁切
19. As a 轉檔使用者, I want 選「快速壓縮到 5/25/50MB 以下」後輸出確實低於目標大小, so that 檔案能直接上傳到有大小限制的平台
20. As a 轉檔使用者, I want 看到輸出大小預估, so that 轉檔前就知道結果大概多大
21. As a 轉檔使用者, I want PDF 壓縮跟圖片轉 PDF 功能照常可用, so that 文件處理不受影響
22. As a 轉檔使用者, I want 沒有內嵌封面的音訊檔顯示空白佔位框而不是錯誤, so that 介面不會出現奇怪的錯誤訊息

### Downloader：下載功能（行為維持不變）
23. As a 下載使用者, I want 貼上 YouTube/Twitch/X 網址後看到標題、縮圖、長度與可選格式, so that 我能挑選畫質
24. As a 下載使用者, I want 只選 video-only 格式時自動合併最佳音訊, so that 下載的影片不會沒有聲音
25. As a 下載使用者, I want 只下載音訊, so that 我能只取得音樂或 podcast
26. As a 下載使用者, I want 影片與音訊分開存成兩個檔案的選項, so that 我能自己後製
27. As a 下載使用者, I want 用剪輯視窗只下載影片的某一段, so that 不用下載整支長片
28. As a 下載使用者, I want 佇列依序下載並顯示速度、剩餘時間, so that 我能掌握進度
29. As a 下載使用者, I want 下載中按取消或移除項目會確實停止下載程序, so that 不會有殘留的背景程序
30. As a 下載使用者, I want 抓取資訊失敗時在該項目上看到 yt-dlp 的錯誤訊息, so that 我知道網址哪裡有問題
31. As a 下載使用者, I want 選擇下載資料夾用原生資料夾對話框, so that 操作跟系統一致

### Hub：殼層功能
32. As a 使用者, I want 開啟 app 看到跟現在一樣的主選單、Header、版本號, so that 搬家後不需要重新學
33. As a 使用者, I want 切換深色/淺色主題時視窗與工作列圖示跟著換, so that 圖示與主題一致
34. As a 使用者, I want 語言切換（英文/繁中）照常運作並記住選擇, so that 介面語言一致
35. As a 使用者, I want 點關閉鈕時依設定詢問、縮到系統匣或直接結束, so that 背景執行的行為跟以前一樣
36. As a 使用者, I want 縮到系統匣後從系統匣選單「開啟」或「結束程式」, so that 我能找回或關掉 app
37. As a 使用者, I want 第一次縮到背景時收到一次系統通知, so that 我知道 app 還在跑
38. As a 使用者, I want 已經開著 app 時再次啟動不會開第二個視窗，而是把既有視窗拉到前景, so that 不會有多個實例互相干擾
39. As a 使用者, I want 視窗每次開啟都在螢幕中央、可見、可點擊, so that 不會再遇到視窗跑到螢幕外的問題
40. As a 使用者, I want 「關於」頁顯示版本、授權、第三方工具授權連結, so that 我能查詢授權資訊
41. As a 使用者, I want 設定頁照常調整關閉行為, so that 我能改變背景執行偏好

### 系統整合（右鍵選單）
42. As a Windows 使用者, I want 右鍵影片/圖片/音訊/PDF 時有「SORAI Toolkit」選單可以直接轉成指定格式, so that 不用先開 app
43. As a Windows 使用者, I want 多選 N 個檔案右鍵轉檔時，所有檔案一次進到同一個視窗的佇列, so that 批次操作不會開出 N 個視窗
44. As a Windows 使用者, I want 右鍵「快速壓縮到 N MB 以下」與「壓縮 PDF」直接套用對應模式, so that 常用操作一步完成
45. As a macOS 使用者, I want Finder 的 Quick Actions 裡有 SORAI Toolkit 的轉檔與壓縮項目, so that 跟 Windows 有對等的整合
46. As a KDE 使用者, I want Dolphin 右鍵有 SORAI Toolkit 子選單, so that Linux 上也能快速轉檔
47. As a GNOME 使用者, I want Nautilus 的 Scripts 選單有 SORAI Toolkit 項目, so that GNOME 上也能快速轉檔

### 更新與發佈
48. As a 官方版使用者, I want app 偵測到新版時右下角跳出提示並可一鍵更新、自動重開, so that 我總是用最新版
49. As a 自架版使用者, I want 偵測到新版時只在漢堡選單和「關於」顯示徽章，點擊後開啟 GitHub release 頁面, so that 自己 build 的版本不會被官方安裝檔覆蓋
50. As a Windows 使用者, I want 安裝在使用者層級、不需要管理員權限, so that 一般帳號也能安裝
51. As a Linux 使用者, I want 下載 .deb/.rpm 安裝並自動帶入需要的系統依賴, so that 安裝後就能開啟
52. As a macOS 使用者, I want 下載 .dmg 安裝, so that 照 macOS 的慣例安裝
53. As a 維護者, I want push 到 master 時 CI 自動決定版本號、三平台打包、發佈 GitHub Release, so that 發版不需要手動操作
54. As a 維護者, I want release 裡附上自動更新需要的更新清單與簽章, so that 官方版的自動更新能驗證安裝檔來源

### 開發者體驗
55. As a 開發者, I want 在 hub 一個指令啟動開發模式，改 hub 或兩個 sibling 工具 repo 的原始碼都會自動重新載入, so that 跨 repo 開發跟現在的 `dev:watch` 一樣順
56. As a 開發者, I want 每個 plugin 的純邏輯（指令建構、輸出解析）能用 `cargo test` 單獨測, so that 不用開視窗就能驗證邏輯
57. As a 開發者, I want 端到端測試能連進真實 Tauri 視窗跑真的下載與轉檔, so that 驗證的是使用者實際會用到的路徑
58. As a 開發者, I want 原生對話框在測試中可以被替換掉, so that 自動化測試不會卡在對話框
59. As a 開發者, I want Neutralino 的設定檔、client、binary 與相關 workaround 全部移除, so that 程式碼裡不殘留死路徑
60. As a 開發者, I want CLAUDE.md 隨每次 commit 反映 Tauri 版的真實狀態, so that 下一個 session 不用重新踩坑

## Implementation Decisions

### 整體架構
- **維持三 repo**：每個 repo 都在 `tauri` 分支上開發，用 git worktree 放在 sibling 資料夾，原本的 Neutralino checkout 留著當參照。三個 repo 全部完成後，各自把 `tauri` merge 回 master。
- **Converter、Downloader 各自做成 Tauri v2 plugin**，各 repo 的內容：
  - Rust crate，以 plugin 形式提供
  - JS 套件：同時 export React 元件和這個 plugin 的 `invoke` 包裝
- **hub 透過 cargo git dependency 和 npm git dependency 消費兩個 plugin**，並在 Rust 端註冊。
- **sidecar 由 hub 宣告與打包**：plugin 用 sidecar 名稱呼叫（`ffmpeg`、`yt-dlp`、`qpdf`、`img2pdf`），不自己打包 binary。plugin 的文件要寫明「宿主 app 必須提供這些 sidecar」的契約。
  - qpdf 的 DLL 走 Tauri `resources`，跟 qpdf 主程式放在同一個目錄。
  - 要確認 qpdf 以 sidecar 執行時找得到這些 DLL；找不到的話，就改成 qpdf 整包當 resource、用完整路徑執行。

### Rust 端模組（每個 plugin 一份，plugin 之間不共用 crate）
- **Downloader plugin 的核心**：
  - metadata 指令與 JSON 解析：分類 video-only、audio-only、combined 格式，排除 storyboard、webm、portrait 變體，挑選預覽 URL
  - 格式選擇器建構：video-only 自動補 `+bestaudio`；分開存檔用逗號選擇器加含 format id 的輸出檔名
  - 下載指令建構：clip 區段、強制在切點補關鍵影格、合併輸出 mp4
  - progress-template 輸出解析
  - 最佳格式預設值的挑選
- **Converter plugin 的核心**：
  - ffmpeg、qpdf、img2pdf 的指令建構
  - 縮圖指令
  - 目標大小的位元率計算
  - ffmpeg 進度解析
  - 輸出大小預估
  - 檔名衝突避開
  - 來源資訊解析：解析度、fps、原始編碼、長度
- **子程序執行器**：兩個 plugin 各自持有一份。職責包括：
  - 啟動 sidecar
  - 逐行把 stdout/stderr 轉成進度事件推給前端
  - 依 job id 取消：在 Windows 上要殺整棵程序樹，並且有逾時保險，取消後一定會回報結束
  - **ponytail**：兩份程式碼重複，大約百行。等到出現第三個工具時，再抽成獨立 crate。
- **前端契約**：`invoke` 指令依工具分成這幾類：
  - 抓 metadata 或探測來源資訊
  - 開始一個 job：回傳 job id
  - 取消 job
  - 事件：`progress`（job id、百分比、速度、ETA）、`log`（原始輸出行）、`finished`（成功／失敗訊息／已取消）
  - 前端的 hooks（`useDownloader`、`useExecute`、`useFileManager`）保留佇列狀態機，只把原本的 Neutralino 呼叫換成這套契約。
- 原本的 `window.EstellaLib.*` 執行期全域變數，依性質分三種去向：
  - **純 UI 的留在 JS**：i18n、range-fill、liquid-glass。
  - **指令和解析類搬進對應 plugin 的 Rust**：ffmpeg-commands、qpdf-commands、img2pdf-commands、progress-parser、size-estimate、filename-collision。
  - **路徑和平台相關的整個移除**：platform 的路徑解析、`killProcessTree`。這些改由 sidecar 和 Rust 執行器負責。

### 檔案與預覽
- **拖曳**：用 Tauri webview 的原生 drag-drop 事件拿到完整路徑，直接送進既有的 `handleFiles`。下面這些全部移除：
  - Neutralino 的 `filesDropped` handler
  - 瀏覽器模式的 `dataTransfer` 讀檔、分塊複製到暫存資料夾的流程
  - Phase 0 的探測器
- **拖曳提示遮罩**：改由 Tauri 的 enter/leave/drop 事件驅動，不再靠 DOM 的 dragenter 計數。
- **本機檔案預覽**（Trim/Crop 預覽、縮圖）改用 Tauri 的 asset protocol，把路徑轉成 webview 可讀的 URL，取代 `server.mount`。asset scope 的權限依情況開：
  - 縮圖：只開放 app 自己的暫存資料夾
  - 使用者選取的檔案：在加入佇列時才動態允許
- **原生對話框**：用 dialog plugin。
- **開啟網址和資料夾**：用 opener plugin。
- **所有原生對話框的呼叫都集中在 hub 提供的一個小型 JS 模組**，讓端到端測試可以在視窗裡把它換掉。這取代現在直接覆寫 `Neutralino.os.showFolderDialog` 的做法。

### Hub 殼層
- **單一實例**：用 single-instance plugin，取代 lock 檔、PID 檢查和 pending-launch 目錄輪詢。
  - 第二個實例的 argv 會轉發給主實例，主實例用現有的 500ms 去抖動把 N 次右鍵呼叫合併成一次 `pendingLaunch`。
  - 合併後的 `pendingLaunch` 形狀維持 `{seq, files, format, quickAction}`。
  - 啟動參數解析從 `NL_ARGS` 改成讀 Tauri 的 argv，`--sorai-*` 這些 flag 的語意不變。
- **視窗**：一開始用隱藏狀態建立，主實例確認後再顯示並置中、取得焦點。原本那些 Neutralino 專屬的位置和 iconic workaround 都移除。
- **關閉行為**：攔截視窗的 close-requested 事件，照 `ask`、`tray`、`quit` 三種模式分流，localStorage 的 key `sorai-close-behavior` 不變。
  - 系統匣用 Tauri 的 tray API，選單維持「開啟」和「結束程式」兩項。
  - 第一次縮到背景時用 notification plugin 發一次通知。
- **主題圖示**：用 Tauri 的 window `setIcon` 動態切換 dark/light 圖示。
- **自動更新**：
  - 檢查 GitHub Releases 的邏輯保留，`IS_OFFICIAL_BUILD` 的分流也保留。
  - 官方版改用 updater plugin，需要簽章金鑰和 release 裡的更新清單，取代自己用 curl 下載加靜默安裝。
  - 非官方版維持「開啟 GitHub release 頁面」。
- **macOS Finder Services、GNOME Nautilus scripts**：維持由 app 啟動時冪等寫入的模型，寫檔改走 Rust 端或 fs plugin。內容和產生規則不變。

### 打包與 CI
- **Tauri bundler 取代 Inno Setup、fpm 和手刻的 .app 打包**：
  - Windows 用 NSIS 安裝檔，per-user 安裝。
  - Linux 出 `.deb` 和 `.rpm`，依賴由 Tauri bundler 宣告。
  - macOS 出 `.dmg`。
- **Windows 右鍵選單的登錄檔**：由現有的產生腳本改成輸出 NSIS installer hook，安裝時寫入、解除安裝時清除。格式清單同步規則不變。
- **KDE ServiceMenu `.desktop` 檔**：透過 deb/rpm 的額外檔案設定，裝到系統的 servicemenus 目錄。
- **CI**：
  - semantic-release 和版本號流程保留。
  - 三平台 build job 改用 Tauri 的建置流程。
  - CI 下載 sidecar binaries 的步驟保留（沿用 `setup.mjs`），但把 Neutralino 相關步驟拿掉。
  - 官方 build 照舊設 `VITE_OFFICIAL_BUILD=true`。
- **跨 repo 開發模式**：hub 偵測到 sibling repo 存在時，做兩件事讓存檔就能熱重載：
  - 用 cargo 的本機 patch 覆寫指向 sibling 的 Rust crate
  - 用 Vite alias 指向 sibling 的 JS 原始碼
  - 這取代現在「建置後複製 `dist/`」的 `dev:watch`。

## Testing Decisions

- **好的測試只驗證外部行為**：
  - 端到端測試看的是使用者看得到的結果：佇列狀態、進度文字、輸出檔案真的存在，並且用 ffmpeg 檢查串流。
  - Rust 單元測試看的是公開函式的輸入和輸出，例如給定設定產生的指令參數、給定輸出行解析出的進度。
  - 都不測內部結構。
- **切點一（主要）：真實 Tauri 視窗的端到端測試**。啟動 `tauri dev` 時開 WebView2 的遠端除錯埠，Playwright 用 `connectOverCDP` 連進去。
  - 參考現有的 hub 測試：`test_conversion.js`、`test_drop.js`、`test_crop_ui.js`、`test_image_crop_commands.js`、`test_download.js`。
  - Downloader 要沿用現有的檢查：用真實短片（"Me at the zoo"）測 metadata 加真的下載，刻意選 video-only 格式，確認輸出同時有 Video 和 Audio 串流。
  - 對話框透過上面那個集中的 JS 模組替換掉。
- **切點二：每個 plugin crate 的 `cargo test`**。
  - 涵蓋指令建構和輸出解析，承接現有純指令測試的案例（例如 `test_image_crop_commands.js`、ytdlp 格式分類與選擇器）。
  - 要用 fixture 覆蓋這些已知的坑：Twitch 的格式沒有 vcodec/acodec 欄位；Twitter 有混合格式；clip 時進度百分比會變成 N/A。
- **拖曳、右鍵選單、系統匣、安裝檔不放進自動化測試**，每個 Phase 結束時由使用者在真機上用真實滑鼠驗證。Playwright 模擬的 DOM drag 不會走 Tauri 的原生 drop 路徑，所以測不出來。
- **每個 Phase 結束都要**：跑完兩個切點的全部測試，跑一次 code review 並修完找到的問題，再 commit，同步更新 CLAUDE.md。

## Out of Scope

- 把 UI 改寫成純 Rust（egui、Slint 這類），或者重新設計 UI。React 元件、CSS 和玻璃語言都維持不變。
- 合併成單一 repo，或者為兩個 plugin 的共用程式碼另外開第四個 repo 或 crate。
- 新功能：hamburger 選單剩下還沒做的項目、新工具、播放清單下載，都不在這次範圍。
- macOS 和 Linux 系統整合的真機驗證。開發機只有 Windows，這個限制跟現在一樣，只做到程式碼完成。
- macOS 公證和程式碼簽章、Windows 程式碼簽章憑證。現況本來就沒有，這次也不加。
- 行動平台（Android、iOS）。

## Further Notes

- **舊 Neutralino 安裝版要怎麼升級到 Tauri 版，還沒決定**。舊版的 updater 會用 Inno 的 `/VERYSILENT` 去跑 release 裡的安裝檔，但 NSIS 的參數不一樣，安裝路徑也可能不同。在 Phase 4 開始前要先決定下面兩種做法中的哪一種。預設是第二種，代價最低：
  1. 第一個 Tauri release 額外附一個相容的過渡安裝檔
  2. release notes 說明需要手動重新安裝一次
- **updater 的簽章金鑰要由維護者產生，放進 GitHub Secrets**，agent 不能代替維護者產生或保管。
- **Tauri 版的 WebView2 對 backdrop-filter 的行為要重新確認**。現有「Liquid glass 製作指南」裡的結論都是在 Neutralino 的 WebView2 殼層上實測出來的。
- **格式清單現在有四份手動複本**：Converter、Windows 產生腳本、Linux 產生腳本、Nautilus scripts。這次遷移不改變這個慣例，但產生腳本的輸出目標從 Inno 改成 NSIS hook，要一起改。
