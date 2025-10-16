# 倉頡編碼函數重構報告

## 概述

本次重構解決了 P1 高優先級問題：清理重複的倉頡編碼函式定義。

## 問題描述

### 原始問題
- `loadCangjieDict`、`pickQuick`、`pickFCJ` 在多個檔案中重複定義
- 回傳型別不一致（Map vs Object）
- 解析邏輯有微差異（`split(/\s+/)` vs `split(/\t+/)`）

### 重複定義位置
1. `scripts/cangjieProcessor.js` - 返回 Map，使用 `split(/\s+/)`
2. `scripts/utils.js` - 返回 Object，使用 `split(/\t+/)`
3. `scripts/extracted_features.js` - 返回 Object，使用 `split(/\t+/)`
4. `scripts/cangjieIntegration.js` - 返回 Object，使用 `split(/\t+/)`
5. `scripts/commonCangjie.js` - 返回 Object（未被使用）

## 解決方案

### 1. 主要實作標準化

選擇 `scripts/cangjieProcessor.js` 作為主要實作，並進行以下修正：

#### 修改前（cangjieProcessor.js）
```javascript
// 使用 Map 和 split(/\s+/)
this._cjMap = new Map();
const parts = trimmed.split(/\s+/);
if (parts.length >= 2) {
  const hanzi = parts[0];
  const codes = parts[1];
  this._cjMap.set(hanzi, codes);
}
```

#### 修改後（cangjieProcessor.js）
```javascript
// 使用 Object 和 split(/\t+/)
const map = Object.create(null);
const parts = raw.split(/\t+/);
if (parts.length < 2) continue;

const han = parts[0].trim();
const code = parts[1].trim();
const code2 = (parts[2] || '').trim();

if (!han || !code) continue;
if (!(han in map)) {
  map[han] = code + (code2 ? ' ' + code2 : '');
}
```

**改進點：**
- ✅ 統一返回 Object（向後相容）
- ✅ 使用 `split(/\t+/)` 正確解析 YAML 格式
- ✅ 支援次編碼（code2）
- ✅ 過濾掉 YAML 元數據行（以 `-` 或字母開頭）

### 2. 其他模組改為引用主實現

#### utils.js 修改
```javascript
async function loadCangjieDict() {
  // 檢查是否有 cangjieProcessor 實例
  if (global.cangjieProcessor && typeof global.cangjieProcessor.loadCangjieDict === 'function') {
    return await global.cangjieProcessor.loadCangjieDict();
  }
  
  // 降級方案：使用傳統實現（向後相容）
  console.warn('⚠️ cangjieProcessor 未載入，使用降級實現');
  // ... 降級實現代碼
}

function pickQuick(codeStr) {
  if (global.cangjieProcessor && typeof global.cangjieProcessor.pickQuick === 'function') {
    return global.cangjieProcessor.pickQuick(codeStr);
  }
  // 降級實現
}

function pickFCJ(codeStr) {
  if (global.cangjieProcessor && typeof global.cangjieProcessor.pickFCJ === 'function') {
    return global.cangjieProcessor.pickFCJ(codeStr);
  }
  // 降級實現
}
```

#### extracted_features.js 修改
同樣的模式，優先引用 `cangjieProcessor`，保留降級實現。

#### cangjieIntegration.js 修改
```javascript
// 只在全域函數尚未定義時才定義
if (!global.loadCangjieDict) {
  global.loadCangjieDict = () => {
    if (global.cangjieProcessor && typeof global.cangjieProcessor.loadCangjieDict === 'function') {
      return global.cangjieProcessor.loadCangjieDict();
    }
    return unifiedCangjie.loadDict();
  };
}
```

### 3. 調整 HTML 載入順序

確保 `cangjieProcessor.js` 在其他依賴模組之前載入：

#### words.html 和 dictMaker.html
```html
<script src="scripts/jquery-3.7.1.slim.min.js"></script>
<script src="scripts/configIntegration.js"></script>
<script src="scripts/cangjieProcessor.js"></script>  <!-- 提前載入 -->
<script src="scripts/cangjieIntegration.js"></script>
<script src="scripts/charFilterIntegration.js"></script>
<script src="scripts/utils.js"></script>
<script src="scripts/extracted_features.js"></script>
<!-- ... -->
```

## 技術細節

### 統一的解析邏輯

YAML 格式：
```
中文字 [tab] 主編碼 [tab] 次編碼(可選)
```

解析特點：
1. 使用 `split(/\t+/)` 而非 `split(/\s+/)`
2. 過濾掉註釋行（以 `#` 開頭）
3. 過濾掉 YAML 元數據（以 `-` 或字母開頭）
4. 支援次編碼（自動用空格連接）
5. 避免重複定義（同字取第一筆）

### 統一的編碼邏輯

#### pickQuick（速成）
- 1 碼：返回原碼
- 2+ 碼：左 1 + 右 1

```javascript
pickQuick(codeStr) {
  const main = (codeStr.split(/\s+/)[0] || '').trim();
  const n = main.length;
  if (!n) return '';
  if (n === 1) return main;
  return main[0] + main[n - 1];
}
```

#### pickFCJ（快倉）
- 1 碼：返回原碼
- 2 碼：返回原碼
- 3+ 碼：左 2 + 右 1

```javascript
pickFCJ(codeStr) {
  const main = (codeStr.split(/\s+/)[0] || '').trim();
  const n = main.length;
  if (!n) return '';
  if (n === 1) return main;
  if (n === 2) return main;
  return main.slice(0, 2) + main[n - 1];
}
```

## 向後相容性保證

1. **降級機制**：所有模組都保留降級實現，確保獨立使用時不會崩潰
2. **檢測機制**：在引用前檢查 `cangjieProcessor` 是否存在
3. **相同 API**：所有函數保持相同的函數簽名和返回值
4. **快取共享**：所有模組共用同一份字典快取，避免記憶體浪費

## 驗證方法

### 手動測試
開啟瀏覽器訪問：
- `tmp_rovodev_test_cangjie.html` - 完整的功能測試頁面

### Node.js 驗證
```bash
node tmp_rovodev_verify.js
```

驗證項目：
- ✅ cangjieProcessor.js 使用正確的 tab 分隔符
- ✅ cangjieProcessor.js 返回 Object
- ✅ utils.js 引用主實現
- ✅ extracted_features.js 引用主實現
- ✅ HTML 載入順序正確

## 效益

### 1. 代碼品質
- 消除重複代碼，遵循 DRY 原則
- 統一實現邏輯，降低維護成本
- 減少潛在 bug（由於實現差異造成的）

### 2. 性能優化
- 共享快取，避免重複載入字典
- 減少記憶體使用（一份字典 vs 多份）

### 3. 可維護性
- 單一真實來源（Single Source of Truth）
- 修改主實現即可影響所有調用者
- 保留降級機制確保向後相容

## 後續建議

1. **移除未使用的檔案**
   - `scripts/commonCangjie.js` 未被任何 HTML 引用，可考慮移除

2. **進一步整合**
   - 考慮將 `cangjieIntegration.js` 和 `cangjieProcessor.js` 合併
   - 統一所有倉頡相關功能到單一模組

3. **測試覆蓋**
   - 建立自動化測試套件
   - 覆蓋所有邊界情況（空字串、特殊字符等）

4. **文檔完善**
   - 為每個公開 API 添加 JSDoc
   - 提供使用範例和最佳實踐

## 相關檔案

### 已修改
- `scripts/cangjieProcessor.js` - 主要實現
- `scripts/utils.js` - 引用主實現
- `scripts/extracted_features.js` - 引用主實現
- `scripts/cangjieIntegration.js` - 條件引用
- `words.html` - 調整載入順序
- `dictMaker.html` - 調整載入順序

### 新增
- `docs/CANGJIE_REFACTOR_REPORT.md` - 本文檔
- `tmp_rovodev_test_cangjie.html` - 測試頁面
- `tmp_rovodev_verify.js` - 驗證腳本

### 未修改但相關
- `scripts/commonCangjie.js` - 未被使用，建議移除
- `scripts/modules/cangjie.js` - 現代模組系統版本（獨立系統）

## 結論

本次重構成功解決了倉頡編碼函數的重複定義問題，統一了實現邏輯，並確保了向後相容性。所有修改都遵循以下原則：

1. ✅ 單一真實來源
2. ✅ 向後相容
3. ✅ 漸進式改進
4. ✅ 保持可測試性

重構完成後，代碼更加清晰、可維護，並為未來的擴展奠定了良好的基礎。
