# dedupeWithComments_v1 函數記錄

## 📋 概述
`dedupeWithComments_v1` 是註解去重功能的原始版本，採用三段式處理流程，能夠完整保留註解和空行的位置。

## 💻 完整程式碼

```javascript
// 註解去重功能 -- v1 : 適用大型檔案
function dedupeWithComments_v1() {
  const raw = $('#inputTextarea').val() || '';
  const lines = raw.split(/\r?\n/);
  let skipId = 0;

  // 第一段：為註解和空行添加 __skip__{id} 標記
  const processedLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 空行和註解添加標記
    if (!trimmed || trimmed.startsWith('#')) {
      processedLines.push(`__skip__${skipId++} ${line}`);
    } else {
      processedLines.push(line);
    }
  }

  // 第二段：處理後內容進行去重
  const seen = new Map();

  for (let i = 0; i < processedLines.length; i++) {
    const line = processedLines[i].trim();

    // 跳過 __skip__ 標記行
    if (line.startsWith('__skip__')) continue;

    // 解析資料
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;

    let root = '', word = '', count = 1;

    // 判斷字根和詞彙位置
    if (/^[a-z]+$/.test(parts[0])) {
      root = parts[0];
      word = parts[1];
      if (parts[2] && /^\d+$/.test(parts[2])) {
        count = parseInt(parts[2], 10);
      }
    } else if (/^[a-z]+$/.test(parts[1])) {
      word = parts[0];
      root = parts[1];
      if (parts[2] && /^\d+$/.test(parts[2])) {
        count = parseInt(parts[2], 10);
      }
    } else {
      continue;
    }

    const key = root + '|' + word;

    if (!seen.has(key)) {
      seen.set(key, { root: root, word: word, count: count, index: i, originalLine: line });
    } else {
      const existing = seen.get(key);
      existing.count += count;
      // 標記該行為已處理
      processedLines[i] = `__processed__${i}`;
    }
  }

  // 第三段：產生去重輸出
  const separator = $('#separatorOpt').val().replace(/\\t/g, '\t') || ' ';
  const dedupeMap = new Map();

  // 建立去重後資料表
  for (const [key, data] of seen.entries()) {
    const newLine = `${data.word}${separator}${data.root}${separator}${data.count}`;
    dedupeMap.set(data.index, newLine);
  }

  // 第四段：組合最終輸出，移除標記
  const result = [];
  for (let i = 0; i < processedLines.length; i++) {
    const line = processedLines[i];

    if (line.startsWith('__skip__')) {
      // 移除 __skip__{id} 標記，恢復原始行
      const originalLine = line.replace(/^__skip__\d+\s*/, '');
      result.push(originalLine);
    } else if (line.startsWith('__processed__')) {
      // 跳過已被合併的重複行
      continue;
    } else if (dedupeMap.has(i)) {
      // 使用去重後資料
      result.push(dedupeMap.get(i));
    } else {
      // 保留其他資料
      result.push(line);
    }
  }

  $('#outputTextarea').val(result.join('\n'));

  // 更新計數
  const $outCount = $('#outputCount');
  if ($outCount.length) {
    $outCount.text(`總計 ${result.length} 行`);
  }

  const $meta = $('#outputMeta');
  if ($meta.length) {
    $meta.text('本次使用：註解去重');
    $('#flowQuick, #flowFCJ').css({ borderColor: '#ccc' });
  }
}
```

## 🔄 v1 vs v2 比較 (詳細 Docstring)

### 💚 v1 優點

#### 1. 功能完整
- **精確位置保留**：使用 `__skip__` 標記系統，能精確保留註解和空行的原始位置
- **四段式處理**：邏輯清晰分離，每段職責明確
- **完整錯誤處理**：對各種格式異常都有適當處理

#### 2. 記憶體友善
- **串流處理**：逐行處理，不需要大量臨時物件
- **地圖索引**：使用 Map 結構高效查找和更新
- **標記復用**：`__skip__` 和 `__processed__` 標記重複使用

#### 3. 可擴展性
- **模組化設計**：各段獨立，容易添加新功能
- **標記系統**：可支援更多類型的特殊處理
- **靈活格式**：支援多種分隔符和格式變化

#### 4. 調試友善
- **流程清晰**：四段式流程容易追蹤和調試
- **中間狀態**：可檢查每段的處理結果
- **錯誤定位**：容易確定問題發生在哪一段

### ❌ v1 缺點

#### 1. 記憶體使用
- **字符串操作**：多次字符串添加和移除 `__skip__` 標記，產生記憶體垃圾
- **臨時陣列**：`processedLines` 陣列佔用額外記憶體
- **標記開銷**：每個註解行都需要添加標記字符串

#### 2. 邏輯複雜性
- **索引依賴**：依賴索引關係，較容易出錯
- **多次遍歷**：需要 3-4 次遍歷才能完成，複雜度為 O(3n~4n)
- **標記管理**：需要額外管理和清理標記系統

#### 3. 性能問題
- **字符串解析**：多次 split 和 replace 操作
- **正則表達式**：重複使用正則表達式匹配
- **記憶體峰值**：處理大檔案時記憶體使用峰值較高

#### 4. 維護複雜
- **狀態管理**：需要維護多種狀態（skip, processed 等）
- **邊界條件**：標記處理的邊界條件較多
- **調試困難**：出錯時較難追蹤哪一行被如何處理

---

### 🚀 v2 改進 (智能註解去重 + 自動格式標準化)

#### 優點
1. **性能提升**
   - **一次遍歷**：核心邏輯只需一次遍歷，O(n) 時間複雜度
   - **減少字符串操作**：不需要添加移除 `__skip__` 標記，減少字符串垃圾
   - **直接索引訪問**：使用 `result[i]` 直接定位，快速查找

2. **記憶體優化**
   - **預分配陣列**：`new Array(lines.length)` 預分配容量
   - **就地修改**：直接在結果陣列中記錄修改，不需要額外儲存
   - **簡單資料結構**：`Object.create(null)` 比 Map 稍微輕量一點

3. **邏輯簡化**
   - **線性邏輯**：一次遍歷完成核心任務
   - **狀態管理簡單**：不需要複雜的標記系統
   - **代碼量減少**：減少約 50% 的代碼量

4. **功能增強**
   - **流程清晰**：處理邏輯更線性，容易理解
   - **變數命名清楚**：p0, p1, p2 簡潔明瞭
   - **自動格式標準化**：整合 `needsNormalization` 和 `normalizeDictionary` 功能

#### 缺點
1. **記憶體使用**
   - **空間浪費**：result 陣列大小等於輸入行數，最終可能很多 null
   - **臨時對象銷毀**：需要在最後用 filter 移除 null，在記憶體中佔位

2. **邏輯複雜性**
   - **索引依賴**：依賴索引關係，較容易出錯
   - **null 處理**：需要額外 filter 步驟移除 null

3. **可擴展性**
   - **緊耦合模式**：若未來需要其他類型標記處理較難擴充
   - **調試困難**：出錯時較難追蹤某行被如何處理

4. **效能考量**
   - **稀疏陣列**：大檔案處理時稀疏陣列 filter 成本較高
   - **記憶體峰值**：陣列從開始到結束都存在

## 🎯 結論

- **v1** 適用於需要精確位置控制和複雜格式處理的場景
- **v2** 適用於一般去重需求，效能和記憶體使用都更優
- **選擇標準**：根據檔案大小、記憶體限制和功能需求來決定使用哪個版本

## 📝 備註

此函數在重構過程中被移除，改用 v2 版本的 `performDeduplication` 函數。記錄保存以供日後參考和比較研究。