# Spec：Windows 右鍵選單預設與背景轉檔

狀態：`ready-for-agent`　·　範圍：`sorai-toolkit`（hub）、`sorai-toolkit-converter`　·　平台：Windows　·　前置：v2.0.0（Tauri）已發佈，現有右鍵選單由 NSIS installer hook 寫入

## Problem Statement

已經安裝 SORAI Toolkit 的使用者，想在桌面或檔案總管對檔案按右鍵，就直接轉檔或壓縮。現在的右鍵選單做不到這件事：

- 點下去一定會打開完整的 app 視窗，檔案只是進佇列，還要再按一次「開始」，不夠快。
- 選單內容是寫死的格式清單，使用者沒辦法放自己常用的組合，例如「轉 MP4、畫質 70、縮成 720p」。
- 選單文字固定是繁體中文，跟 app 的語言設定無關。
- 多選的檔案類型混在一起時，行為沒有定義。

參考對象是 FileConverter（Tichau/FileConverter）：右鍵選一個預設，就直接在背景轉檔，只跳一個小進度視窗。

## Solution

把右鍵選單改成由使用者自訂的「預設」組成。

- **點一個預設**：同一個 SORAI Toolkit 程式在背景轉檔，只跳出一個小的進度視窗，主視窗不出現，也不會打擾正在用的主視窗。
- **轉完之後**：
  - 全部成功：發一則系統通知，進度視窗 3 秒後自動關閉；如果 app 原本沒開著，就整個結束。
  - 有任何失敗：視窗留著顯示錯誤，讓使用者自己關。
- **「在 SORAI Toolkit 中開啟…」**：給想先調參數、裁切、剪輯的人，打開完整視窗。
- **管理預設的兩個地方**：
  - 在 Converter 調好參數後按「存成右鍵預設」。
  - 在 hub 設定頁改名、刪除、排序、還原預設，按「編輯」用 Converter 的設定面板改參數。
- **選單文字**：跟著 app 的語言。

## User Stories

### 從右鍵直接轉檔
1. As a 已安裝的使用者, I want 在桌面的影片上按右鍵選「轉成 MP4」就直接開始轉, so that 我不用先開 app、加檔、再按開始
2. As a 使用者, I want 右鍵轉檔時只跳出一個小的進度視窗而不是整個 app, so that 畫面不會被大視窗佔滿
3. As a 使用者, I want 進度視窗每個檔案一列、各自有進度條, so that 我知道每個檔案轉到哪裡
4. As a 使用者, I want 在進度視窗單獨取消某個檔案, so that 不想要的那個可以停掉而其他繼續
5. As a 使用者, I want 一鍵取消全部, so that 選錯預設時可以馬上全部停下
6. As a 使用者, I want 一次多選幾個檔案右鍵轉檔時同時處理兩個, so that 整批比一個一個轉快，但電腦不會卡死
7. As a 使用者, I want 轉檔進行中再對別的檔案按右鍵時，新檔案加進同一個進度視窗排隊, so that 不會開出一堆視窗
8. As a 使用者, I want 輸出檔放在原檔旁邊、檔名加 `_converted`、遇到同名再加一次, so that 原檔和既有檔案永遠不會被覆蓋
9. As a 使用者, I want 全部成功時收到一則系統通知，點了打開輸出資料夾, so that 我知道轉好了、也能馬上找到檔案
10. As a 使用者, I want 全部成功時進度視窗 3 秒後自動關閉, so that 不用自己去關
11. As a 使用者, I want 有檔案失敗時進度視窗保持開著並顯示錯誤訊息, so that 我知道哪個檔案、為什麼失敗
12. As a 使用者, I want app 原本沒開時，右鍵轉完、視窗關閉後 app 就完全結束, so that 不會有程式一直留在背景
13. As a 使用者, I want app 原本就開著（主視窗或系統匣）時，右鍵轉完 app 保持原本的狀態, so that 我正在做的事不受影響
14. As a 使用者, I want 主視窗開著、Converter 佇列裡有東西時，右鍵轉檔不會動到那個佇列, so that 兩件事互不干擾
15. As a 使用者, I want 多選的檔案類型混在一起時，不適用這個預設的檔案在進度視窗標成「已略過：不支援此預設」, so that 其他檔案照常轉，我也知道哪些被跳過
16. As a 使用者, I want 檔名有中文或空白的檔案也能右鍵轉檔, so that 不用先改檔名

### 選單內容
17. As a 使用者, I want 右鍵選單第一層是「SORAI Toolkit」，下一層直接列出適用這個檔案類型的預設, so that 點兩下就能轉
18. As a 使用者, I want 選單最下面有「在 SORAI Toolkit 中開啟…」, so that 需要先調參數或裁切時可以打開完整視窗
19. As a 使用者, I want 選單最下面有「設定預設…」, so that 我能直接跳到管理預設的地方
20. As a 使用者, I want 選單只在 app 支援的檔案上出現, so that 其他檔案的右鍵選單不會多出用不到的項目
21. As a 使用者, I want 選單文字跟著 app 的語言設定（繁中／英文）, so that 選單跟 app 語言一致
22. As a 使用者, I want 切換 app 語言後右鍵選單也跟著換, so that 不用重新安裝
23. As a 使用者, I want 我自己取名的預設照我取的名字顯示, so that 我認得出自己的預設

### 「在 SORAI Toolkit 中開啟…」
24. As a 使用者, I want 這個項目把檔案放進 Converter 佇列並沿用我上次的參數, so that 我可以繼續調整
25. As a 使用者, I want 類型混在一起時跳出現有的混合類型選擇視窗, so that 行為跟拖檔案進來一致

### 管理預設
26. As a 使用者, I want 在 Converter 調好參數後按「存成右鍵預設」, so that 常用的組合可以直接出現在右鍵選單
27. As a 使用者, I want 存預設時自動產生名稱（例如「MP4・畫質 70・720p」）而且可以改, so that 不用每次自己想名字
28. As a 使用者, I want 在 hub 設定頁看到所有預設的清單, so that 一眼知道右鍵選單裡有什麼
29. As a 使用者, I want 在設定頁改名、刪除、調整順序, so that 選單排成我想要的樣子
30. As a 使用者, I want 在設定頁按「編輯」用 Converter 的設定面板改參數並覆蓋原本的預設, so that 不用刪掉重建
31. As a 使用者, I want 「還原預設」一鍵回到內建的預設清單, so that 改壞了可以重來
32. As a 使用者, I want 儲存、刪除、排序後右鍵選單馬上更新, so that 不用重開 app 或重新安裝
33. As a 使用者, I want 剛安裝好就有內建預設（每種類型的轉成 X、影片快速壓縮到 5/25/50MB、壓縮 PDF）, so that 什麼都沒設定也能用
34. As a 使用者, I want Trim／Crop 這種只對單一檔案有意義的設定不會被存進預設, so that 預設套到任何檔案都合理

### 安裝與維護
35. As a 使用者, I want 安裝完、還沒開過 app 就已經有右鍵選單, so that 第一次也能直接右鍵
36. As a 使用者, I want 解除安裝後右鍵選單完全消失, so that 不會留下壞掉的項目
37. As a 使用者, I want 從 2.0.0 升級後，舊的右鍵項目在第一次啟動時被換成新的預設選單, so that 不會出現新舊兩套
38. As a 使用者, I want 如果右鍵選單被手動刪掉或跟預設不同步，app 啟動時自動修復, so that 選單永遠跟設定一致
39. As a 使用者, I want 知道一次超過 15 個檔案時右鍵選單會被 Windows 隱藏，以及要改用拖曳, so that 不會以為功能壞了

### 開發者
40. As a 開發者, I want 「預設＋語言 → 登錄檔內容」是可以單元測試的純函式, so that 不用真的寫登錄檔就能驗證選單
41. As a 開發者, I want 「預設 × 檔案 → 套用或略過」是純函式, so that 混合類型的規則有測試保護
42. As a 開發者, I want 用命令列參數啟動 exe 就能端到端測試背景轉檔流程, so that 不需要真的在檔案總管按右鍵
43. As a 開發者, I want 每次 commit 同步更新 CLAUDE.md, so that 下一個 session 知道這套機制怎麼運作

## Implementation Decisions

### 預設（preset）模型與儲存
- 一個預設的欄位：
  - `id`：穩定，用在登錄檔的指令列。
  - `name`：使用者取的名字；內建預設沒有 `name`，改用 `labelKey` 走 i18n。
  - `fileType`：`video|image|audio|pdf`，一個預設只對應一種類型。
  - `format`：輸出格式。
  - `settings`：該類型的參數，形狀與 Converter 的 `settings[fileType]` 相同，所以轉檔時直接沿用 Converter plugin 既有的 `start_convert`。
- 只能使用 app 已經支援的參數，不新增旋轉。Trim、Crop 不屬於預設。
- **預設由 hub 擁有**：存成 app 設定目錄裡的一個 JSON 檔，Rust 端提供這些指令：列出、新增／覆蓋、刪除、排序、還原內建、產生預設名稱。
- **Converter 存取預設的方式**：透過 hub 提供的執行期全域 `window.SoraiPresets`（跟 `window.SoraiDialogs` 同一套宿主契約），Converter 不直接依賴 hub。
- **內建預設**：就是現在右鍵選單上有的項目，每種類型的「轉成 X」、影片的快速壓縮 5/25/50MB、壓縮 PDF。內建預設的參數取 Converter 該類型的預設設定，目標大小那幾個則開啟 target-size 模式。

### 右鍵選單（登錄檔）
- **純函式**：輸入「預設清單＋語言」，輸出「每個副檔名要寫入的登錄檔項目」。結構是：
  - `SORAI Toolkit` 層疊選單
  - 適用該副檔名類型的預設（依清單順序）
  - 分隔線
  - 「在 SORAI Toolkit 中開啟…」
  - 「設定預設…」
- 副檔名對應的類型沿用 Converter 的輸入判定。
- **寫入位置**：沿用現在的 `HKCU\Software\Classes\.<ext>\shell\SORAIToolkit`，寫成傳統選單的層疊項目，不做 Windows 11 新版選單。每次都先刪掉整個 `SORAIToolkit` 子樹再重寫，不做差異比對。
- **由 app 負責重寫的時機**：儲存、刪除、排序、還原預設之後；切換語言之後；每次 app 啟動時（修復被手動刪除的選單，也把 2.0.0 舊格式的項目換成新的）。
- **安裝程式**：NSIS installer hook 在安裝時寫入內建預設的選單（建置時產生，用繁中標籤），讓使用者還沒開過 app 就有選單；解除安裝時照舊刪除整個子樹，並清掉空的 `shell` 鍵。
- **15 個檔案的限制**：一次選超過 15 個檔案時，Windows 會隱藏靜態右鍵選單的項目。這是 Windows 本身的限制，接受它並寫進說明；不修改系統的 `MultipleInvokePromptMinimum`。

### 啟動參數
- **新增的旗標**：
  - `--sorai-preset=<id> <檔案...>`：背景轉檔。
  - `--sorai-open <檔案...>`：在 Converter 中開啟。
  - `--sorai-presets`：打開預設管理。
- **舊旗標**：`--sorai-convert-to`、`--sorai-quick-action` 是 2.0.0 寫入的格式，繼續支援，行為不變（打開主視窗、放進佇列、套用格式），讓 app 還沒重寫選單前點到舊項目也能用。
- **合併參數**：沿用現有的 single-instance 轉發和 500ms 去抖動。去抖動以「動作」為單位：同一個預設的連續啟動合併成一批；不同的預設各自成批。所有批次最後都進同一個進度視窗的佇列。

### 進度視窗
- **視窗本身**：同一個程式裡的第二個 Tauri 視窗（label `progress`，約 420×300），載入同一份前端，只渲染進度畫面。需要時才建立，已經存在就把新的檔案加進它的佇列。
- **處理規則**：
  - 同時執行 2 個 job，用 Converter plugin 的 `start_convert`（per-job Channel）和 `cancel_job`。
  - 不適用這個預設的檔案標成「已略過」，判斷用「預設 × 檔案」的純函式。
  - 輸出目錄是來源檔所在的資料夾，命名規則沿用 `unique_out_path`。
- **結束行為**：
  - 全部完成且沒有失敗：發通知，點通知會用 opener 打開輸出資料夾；3 秒後關閉進度視窗。
  - 有失敗：不自動關閉。
- **app 要不要跟著結束**：
  - 冷啟動時如果只帶了背景轉檔參數，主視窗維持隱藏，不呼叫 reveal。
  - 進度視窗關閉時，如果主視窗從頭到尾沒顯示過、也沒有縮到系統匣，就結束 app；否則保持原狀。
  - 現有「主實例一啟動就 reveal 主視窗」的流程要改成：啟動參數只有背景轉檔時，不 reveal。

### Converter 端
- 設定面板加一個「存成右鍵預設」按鈕，存的是目前的類型、輸出格式和 `settings[fileType]`，名稱自動產生、可以改。
- 「編輯預設」模式：由 hub 設定頁觸發，Converter 載入該預設的參數，按鈕變成「儲存預設」，存檔時覆蓋原本的預設。這個模式不需要佇列裡有檔案。

### hub 設定頁
- 新增「右鍵選單預設」區塊：清單、改名、刪除、上移／下移、編輯（打開 Converter 的編輯預設模式）、還原預設。區塊外觀照現有 `SettingsModal` 的 `.settings-section` 形狀，不套玻璃語言。

## Testing Decisions

- 好的測試只驗證外部行為：給定預設與語言，輸出的登錄檔項目是什麼；用某組參數啟動之後，使用者看得到什麼、產出了哪些檔案。不測內部狀態。
- **切點一（主要）：真實 Tauri 視窗的 E2E**，沿用 `npm run test:e2e`。
  - 參考既有的 `single-instance.test.mjs`：直接帶參數啟動 exe，再用 CDP 連進進度視窗與主視窗。
  - 要涵蓋的行為：
    - 進度視窗出現、輸出檔正確（用 ffmpeg 檢查）。
    - 不適用的檔案被略過。
    - 同時 2 個 job。
    - 轉檔中再啟動一次會併進同一個視窗。
    - 全部成功時 3 秒自動關閉，且 app 原本沒開時會結束。
    - 有失敗時視窗留著。
    - 主視窗開著時不受影響。
    - Converter「存成右鍵預設」，以及 hub 設定頁的改名、刪除、排序、編輯、還原。
    - `--sorai-open` 的行為。
    - 舊旗標仍可使用。
- **切點二：cargo test**。
  - 「預設＋語言 → 登錄檔項目」：內容、順序、指令列、跳脫字元、中文標籤。
  - 「預設 × 檔案 → 套用或略過」。
  - 預設名稱的自動產生。
  - 預設儲存檔的讀寫與還原（用暫存目錄）。
  - 真正寫入登錄檔的那一層很薄，不寫測試，由真機驗收涵蓋。
- **真機驗收**：由 agent 用 computer-use 在真的檔案總管操作，事先徵得使用者同意，這段時間使用者不要動電腦。
  - 確認選單真的出現、多選有效、中文和空白檔名正常。
  - 切換語言後選單文字跟著換。
  - 改了預設之後選單馬上更新。
  - 解除安裝後選單消失。
  - 從 2.0.0 升級後舊項目被取代。

## Out of Scope

- Windows 11 新版第一層右鍵選單：需要 `IExplorerCommand` 加上帶程式碼簽章的 sparse package。
- COM shell extension：用來讓不適用的選項變灰，以及突破 15 個檔案的限制。
- 修改系統的 `MultipleInvokePromptMinimum`。
- 預設裡加入旋轉或其他 app 目前不支援的參數；預設裡指定輸出資料夾。
- macOS Finder 與 Linux Dolphin／Nautilus 的同等功能，維持現有基本版。
- 資料夾或桌面空白處的右鍵選單。

## Further Notes

- 發佈時跟已經 commit、還沒 push 的系統匣圖示修改、Trim／Clip 把手修正一起，發成 v2.1.0。在完成真機驗收、使用者同意之前不 push。
- 內建預設的標籤要有繁中與英文兩種。安裝時寫入的那份選單固定用繁中，第一次啟動後才依 app 語言重寫。
- 2.0.0 的使用者升級後，舊格式的項目會在第一次啟動時被換掉；在那之前點到舊項目，會走仍然支援的舊旗標。
