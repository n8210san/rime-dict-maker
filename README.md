# Rime 字典製作工具集

## 🚦 會話啟動（AI Agent 必讀）

**所有 AI Agent 任務必須從這裡開始：**

1. **第一步**：閱讀 [00_START_HERE.md](00_START_HERE.md)
2. **第二步**：填寫 START_CONTRACT（任務契約）
3. **第三步**：依照 Gate 流程執行（Gate 0 → Gate 1 → Gate 2 → Gate 3）

> ⚠️ 未貼 START_CONTRACT 者一律 No-Go，請引導 User 回到 [00_START_HERE.md](00_START_HERE.md)

---

## 📚 快速索引
- [模組映射快速索引](docs/modules_map.md)

一個用於製作 Rime 輸入法字典檔案的完整工具集，包含文本斷詞、字典標準化、去重、快倉碼生成等功能。

## 🚀 快速開始

### 本機啟動伺服器（避免 CORS 問題）

部分功能（例如以 fetch 讀取 `data/cangjie5.dict.yaml` 或 `data/dict.txt`）在以 `file://` 直接開啟網頁時會被瀏覽器安全政策阻擋，請透過本機 HTTP 伺服器啟動專案：

- 使用 Node（推薦）
  - 在專案根目錄執行：
    - 安裝一次：`npm i -g http-server`
    - 啟動服務：`http-server -p 8080`
    或用 npx 免安裝
    - 啟動服務：`npx http-server -p 8080`
  - 瀏覽器開啟：
    - http://localhost:8080/words.html
    - http://localhost:8080/dictMaker.html

- 其他可選方式
  - Python 3：`python -m http.server 8080`
  - PHP：`php -S 127.0.0.1:8080`
  - Docker（本專案提供腳本）：`./start-local-server.sh`（預設映射到 http://localhost:8082/）

當以 http(s) 協定開啟頁面時，上述資料讀取將不受 CORS 限制。

---

## 共用元件與行為（scripts/utils.js）
兩頁面共用的按鈕與行為已抽取至 `scripts/utils.js`。引入順序需在 jQuery 之後。

共用功能包含：

- 開啟檔案
  - `#openFileBtn` 觸發 `#openFileInput` 的檔案選擇。
  - 讀檔使用 `readFilesAsText(files, encoding)` 與 `readSelectedFiles(files)`（從 `#encodingSelect` 取得編碼，預設 UTF-8）。
  - 讀取完成後會呼叫 `setIO(text, '')` 將內容放入左側輸入框，並清空輸出框。

- 編碼選擇與保存
  - `#encodingSelect` 的值會同步保存於 `localStorage.rovodev_encoding`。
  - 頁面載入會自動恢復上次選擇的編碼。

- Undo／Swap
  - `#undoBtn`：支援多步復原，按鈕會顯示堆疊數量（例如 `復原(3)`），無堆疊則 disabled。
  - `#swapBtn`：互換輸入與輸出內容（`setIO(output, input, 'swap')`）。
  - 內部以 `undoStack` 管理狀態，對外提供 `setInput`、`setOutput`、`setIO`（會自動處理 undo push 與去抖 `op`）。

- 拖拉（Drag & Drop）
  - 對 `#inputTextarea` 支援拖拉檔案（使用 `readSelectedFiles` 讀檔）與純文字（直接 `setIO(text, '')`）。
  - 拖拉過程會切換 `.drag-over` 樣式。

- Jieba 就緒確認（可選）
  - `ensureJiebaReady()` 會輪詢 `jieba_cut` 是否就緒；就緒時將頁面 `<h2>` 標題變綠，並呼叫 `resume_jieba_cut()`（若存在）。

- 全域輸出（為了相容既有程式）
  - `window.FcjUtils` 暴露主要 API。
  - 也將 `setInput`、`setOutput`、`setIO`、`readSelectedFiles` 掛到全域，供舊程式呼叫。

---

## words.html（斷詞整理器）

用途：將文本進行斷詞、簡單清洗或格式轉換（Rime/Pime/freeCj/純英文/標點斷句）。

主要按鈕與行為：

- 檔案與編碼、互換、復原
  - `#openFileBtn` / `#openFileInput` / `#encodingSelect` / `#swapBtn` / `#undoBtn`：由 `scripts/utils.js` 共用處理。

- 斷詞（結巴）
  - `#jiebaBtn`：呼叫 `call_jieba_cut(text, callback)`，輸出以空白連接的 tokens（`setOutput(tokens.join(' '), 'jieba')`）。
  - 斷詞前會 `checkJieba()`；未就緒會顯示提示文字於輸出框。

- 自訂斷詞詞典（Modal）
  - `#jiebaCustomBtn`：開啟自訂詞典對話框。
  - `#applyCustomDictBtn`：解析對話框內容後，呼叫 `call_jieba_cut(text, customDict, callback)` 進行斷詞。
    - `parseCustomDict(input)`：
      - 優先嘗試解析為 JSON 陣列（如 `[["這個", 99999999, "n"], ...]`）。
      - 否則以逗號或空白分隔字串解析為字詞清單，並轉為 `[[word, 99999999, 'n'], ...]`。
    - 成功後將 `customDict` 存入 `localStorage.rovodev_custom_dict`。

- Pime 轉 Rime（欄位對調）
  - `#PimeBtn`：將每行 `code word` 轉為 `word code`，以正則交替行首與換行後的片段。

- Rime 格式輸出
  - `#RimeBtn`：
    - 先以 `processText(/[^\u4e00-\u9fa5a-zA-Z]/g)` 清洗文本（保留中/英文字）。
    - 若 jieba 可用：斷詞後以換行連接，再轉為 Rime 格式（`字\t字\t3`）。
    - 若 jieba 不可用：直接將清洗後結果轉 Rime 格式。

- freeCj 格式（目前為清洗後原樣輸出）
  - `#freeCjBtn`：`processText(/[^\u4e00-\u9fa5]/g)`（只保留中文），再輸出。

- 純英文
  - `#pureEn`：`processText(/[^a-z]/g)`（只保留英文字母）。

- 標點斷句（簡易）
  - `#simpleBtn`：`processText(/[^\u4e00-\u9fa5a-zA-Z]/g)`（中英以外皆視為分隔）。

輔助函式：
- `prepare(regex)`：將輸入文字轉小寫並以 regex 取代為空白，並保存原始文字於閉包變數。
- `wraplines(text)`：拆分、去空行、去重複（保留先出現）。
- `processText(regex, works?)`：`prepare` 後若提供 works 進一步處理，最後走 `wraplines`。
- `toRime(text)`：將每行轉為 `字\t字\t3` 格式。

依賴：
- `require-jieba-js.js`（注入 `call_jieba_cut`、`resume_jieba_cut` 等），以及內部載入的 jieba 實作。
- jQuery（slim 版即可）。

---

## dictMaker.html（字典製作器）

### ✨ 主要功能
- **智能格式處理**: 自動識別並標準化各種字典格式
- **補完整字典**: 將 `詞組\t計數` 格式自動補齊為 `詞組\t字根\t計數`
- **智能註解去重**: 自動格式標準化 + 去重處理，完整保留註解和空行結構
- **精確字數控制**: 支援 1字、2字、3字、4字、5字以上的精確過濾
- **多種輸入法支援**: 快倉碼、速成碼生成
- **分隔符自定義**: 支援空格和 tab 分隔符
- **設定記憶**: 所有選項自動保存和恢復
- **輸出轉輸入**: 一鍵將處理結果轉為下階段輸入

### 🔧 核心功能詳解

用途：
- 以條件篩選 `data/dict.txt`（如次數範圍），串流處理顯示於輸入框。
- 基於倉頡碼轉換產出新碼（速成／快倉）至輸出框。

主要按鈕與元件：

- 檔案與編碼、互換、復原
  - `#openFileBtn` / `#openFileInput` / `#encodingSelect` / `#swapBtn` / `#undoBtn`：由 `scripts/utils.js` 共用處理。

- 範圍輸入與字典篩選
  - `#rangeInput`：輸入條件，如 `>300`、`300-20`、`50-250`、`<=100`、`300`。
  - `#sortDictBtn`：觸發 `streamFilterDict(rangeStr, onProgress)`：
    - 優先以 `fetch('data/dict.txt')` 的串流 reader 邊讀邊過濾，回報進度（bytes 轉換為百分比、已處理行數、符合行數）。
    - 不支援串流時退化為一次讀取（同樣支援進度數字顯示）。
    - 條件解析由 `buildRangeFilter(rangeStr)` 提供，支援：`>N`、`>=N`、`<N`、`<=N`、`A-B`（{A,B} 無序，含邊界）、`N`（等於）。
    - 讀取行格式預期為 `詞 次數 類別`（至少三段，以空白分隔），以次數欄位做數值篩選。
    - 結果依次數由大到小排序，行格式輸出為 `詞 次數 類別`（以換行串接）。
    - 成功後會將文本寫入輸入框（`setInput(text, 'rangeFilter')`）。

- 速成／快倉轉碼
  - `#quickBtn`：執行 `runMake('quick')`
    - 節錄出行首連續中文字為詞（若任一字找不到碼則整行忽略）。
    - 對每個字取主碼（倉頡首碼段）後：
      - 主碼長度=1：用 1 碼；主碼長度>1：取左 1 + 右 1。
    - 同一輪執行中去重複（保留先出現）。

  - `#fcjBtn`：執行 `runMake('fcj')`
    - 單字：三碼規則（1/2/3 碼；主碼≥3 時用左 2 + 右 1）。
    - 多字詞：每字取左右碼（1 碼或左 1 + 右 1）後串接為整體詞碼。
    - `#fcjOpt_freq1000_code3_to_code2` 勾選時：對「次數 > 1000 且主碼長度為 3」的單字，會「立即輸出左右碼、三碼延後追加至最後」。去重後按延後順序追加。
    - 頁面下方顯示流程清單，會以綠色邊框點亮本次使用的流程。

- 下載結果
  - `#downloadBtn`：將輸出框文字以 `text/plain;charset=utf-8` Blob 下載檔案，檔名 `dict_output_yyyy-mm-ddThh-mm-ss-sss.txt`。

- 計數與提示
  - `#inputCount`：範圍篩選時顯示進度／結果行數。
  - `#outputCount`：輸出行數統計。
  - `#outputMeta`：顯示這次使用的流程（速成或快倉）。

資料來源與轉碼函式：
- `data/cangjie5.dict.yaml`：以 `loadCangjieDict()` 解析，建立 `{漢字: 編碼字串}` 映射。
- 取碼：
  - `pickQuick(codeStr)`：左 1 + 右 1。
  - `pickFCJ(codeStr)`：主碼≥3 用左 2 + 右 1；長度 1、2 分別取 1 碼與 2 碼。
- `runMake(mode)`：讀入輸入框文本、依模式（quick/fcj）與字典進行轉碼，處理延後三碼追加、去重複、更新輸出統計與流程提示。

---

## 檔案與依賴

- HTML 頁面：
  - `words.html`：引入 `scripts/jquery-3.7.1.slim.min.js`、`scripts/utils.js`、`require-jieba-js.js`、`words.js`。
  - `dictMaker.html`：引入 `scripts/jquery-3.7.1.slim.min.js`、`scripts/utils.js`（不再引入 `words.js`）。

- 共用工具：
  - `scripts/utils.js`：共用按鈕（開檔、編碼、互換、復原）、拖拉、jieba 就緒、undo 管理、setInput/Output/IO。

- 頁面專屬腳本：
  - `words.js`：斷詞整理器頁面專屬邏輯（jieba、Rime/Pime/freeCj/pureEn/simple、Modal 與 parseCustomDict 解析）。
  - `dictMaker.html` 內嵌腳本：範圍解析、串流篩選 `data/dict.txt`、Cangjie 字典載入與轉碼流程。

- 資料來源：
  - `data/dict.txt`：篩選用的字典檔（詞 次數 類別）。
  - `data/cangjie5.dict.yaml`：倉頡碼字典，用於轉碼。

---

## 開發指引

- 新增共用行為
  - 優先放入 `scripts/utils.js`，並以選擇器檢查（例如某頁不存在的按鈕則不綁定）。
  - 對外盡量提供單純的 API（例如 `setInput/Output/IO`）。

- 新增頁面專屬功能
  - 放在該頁專屬的腳本檔（例如 `words.js`），僅依賴共用 API。

- 狀態保存
  - 編碼選擇保存在 `localStorage.rovodev_encoding`。
  - `dictMaker.html` 的勾選偏好保存於 `localStorage` 的 `dict_maker.*` 命名空間（JSON 格式）。

---

## 已知注意事項

- `require-jieba-js.js` 會在頁面載入時自動插入 `scripts/require.js` 與其 main 模組，需網路可取用其資源或有對應檔案。
- `streamFilterDict` 若環境不支援串流 reader，會改為一次讀檔。
- `freeCj` 按鈕目前僅做中文過濾與原樣輸出（尚未進行實際編碼轉換）。

---

## 🎯 典型使用流程

### 字典製作完整流程 (dictMaker.html)
1. **原始資料準備** → 將各種格式的詞典資料貼到輸入區
2. **格式標準化** → 點擊「補完整字典」自動補齊字根
3. **資料傳遞** → 點擊「←輸出轉輸入」將結果移到輸入區
4. **去重處理** → 點擊「註解去重」進行智能去重
5. **輸入法生成** → 點擊「快倉」或「速成」生成最終字典

### 文本分析流程 (words.html)
1. **文本輸入** → 拖拉檔案或點擊「開啟檔案」
2. **語言過濾** → 選擇「純中文」、「中日韓」等過濾選項
3. **斷詞處理** → 點擊「斷詞」或「自訂斷詞」進行斷詞
4. **格式轉換** → 選擇「Rime 格式」、「freeCj 格式」等

### 傳統字典篩選流程 (dictMaker.html)
1. **設定範圍條件** → 在範圍欄位輸入條件（如 `>999`）
2. **載入字典** → 點擊「排序字典檔」篩選並載入 `data/dict.txt`
3. **選擇字數** → 勾選需要的字數選項（1字-5字以上）
4. **生成編碼** → 點擊「速成」或「快倉」生成輸入碼

---

## 🛠️ 支援的字典格式

### 輸入格式（自動識別）
```
# 註解行（完整保留）
詞組	計數               → 自動補齊字根  
詞組	字根	計數          → 標準格式
字根	詞組	計數          → 自動調整順序
DEBUG	25495             → DEBUG	debug	25495
測試	1                  → 測試	[快倉碼]	1
```

### 輸出格式（統一標準）
```
詞組	字根	計數
```

## 📂 專案結構

```
rime-dict-maker/
├── README.md                   # 專案說明文件
├── dictMaker.html              # 字典製作器主頁面  
├── words.html                  # 文本處理器主頁面
├── words.js                    # 文本處理邏輯
├── words.css                   # 樣式檔案
├── require-jieba-js.js         # jieba 中文斷詞引擎（離線版）
├── scripts/                    # 核心腳本
│   ├── utils.js               # 快倉工具函數
│   ├── jquery-3.7.1.slim.min.js
│   ├── main.js                # jieba 核心
│   └── finalseg/              # 斷詞相關
├── data/                       # 字典資料
│   ├── dict.txt               # 快倉字典
│   └── cangjie5.dict.yaml     # 倉頡五代字典
└── html-lib/
    └── components/
        └── CharLengthOptions/ # 字數選項組件
```

## 🔧 技術特點

- **前端技術**: HTML5 + JavaScript + jQuery
- **斷詞引擎**: jieba-js (本地離線版本)
- **字典資源**: 快倉字典檔案
- **部署方式**: 靜態檔案，支援任何 HTTP 伺服器
- **離線支援**: 完全本地運行，無需網路連線

## 📝 開發紀錄

### v3.0 (當前版本)
- ✅ 獨立專案，從 jieba-js 分離
- ✅ 完整離線支援
- ✅ 智能格式處理和自動標準化
- ✅ 精確字數選項控制（1字-5字以上）
- ✅ 統一的設定記憶系統
- ✅ 智能註解去重功能
- ✅ 輸出轉輸入工作流

### v2.x
- 字數選項組件開發
- 格式自動檢測和標準化
- 記憶功能整合

### v1.x  
- 基礎字典製作功能
- 快倉/速成碼生成

## 🚧 開發規劃

### 短期目標
- [ ] langFilterSelect 整合到設定記憶系統
- [ ] 優化錯誤處理和用戶提示
- [ ] 加強批量處理能力

### 中期目標
- [ ] 重組檔案結構（html-lib 標準化）
- [ ] 支援更多輸入法字典格式
- [ ] 加入字典品質檢查功能

### 長期目標
- [ ] 整合到 PIME 輸入法框架
- [ ] 開發桌面應用版本
- [ ] AI 輔助字典生成

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request 來改善這個工具！

## 📄 授權

MIT License
