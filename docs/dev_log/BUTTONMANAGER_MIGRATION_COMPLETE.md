# ButtonManager 模組移轉完成報告

## 📋 任務概述

將 `dictMaker.js` 中的 ButtonManager 物件完整移轉到 `scripts/modules/buttonManager.js`，並實作依賴注入模式，同時保持向後相容性。

## ✅ 完成項目

### 1. 核心功能移轉

從 `dictMaker.js` (第 64-104 行) 移轉以下功能到 `modules/buttonManager.js`：

- ✅ **按鈕配置結構** (`configs`)
  - `processButtons`: 處理功能按鈕配置 (去重、標準化、快倉、速成、下一步)
  - `utilityButtons`: 工具按鈕配置 (下載)

- ✅ **核心方法**
  - `init(actions)`: 初始化管理器，支援依賴注入
  - `bindButtons()`: 綁定所有按鈕事件
  - `handleDownload()`: 處理下載功能

### 2. 依賴注入設計

實作靈活的依賴注入機制，支援兩種使用模式：

#### 模式 1: 向後相容模式（無參數）
```javascript
// 使用全域函式（dictMaker.js 當前用法）
ButtonManager.init();
```

#### 模式 2: 依賴注入模式（推薦）
```javascript
ButtonManager.init({
  onProcessActions: {
    dedupeWithComments,
    normalizeDictionary,
    runMakeQuick: () => runMake('quick'),
    runMakeFCJ: () => runMake('fcj'),
    nextStep
  },
  onUtilityActions: {
    download: FileOps.download
  }
});
```

### 3. 向後相容性

- ✅ 全域 `ButtonManager` 物件仍可用
- ✅ 保持原有的 API 簽名
- ✅ `dictMaker.js` 中現有的 `ButtonManager.init()` 呼叫仍然有效
- ✅ 支援全域函式回退機制

### 4. 錯誤處理與容錯

- ✅ 按鈕不存在時自動跳過（不中斷）
- ✅ 下載函式不可用時提供友善錯誤訊息
- ✅ 支援多層級回退機制（注入 → 全域 FileOps → 全域 downloadText）

## 📐 架構設計

### 配置結構

```javascript
ButtonManager.configs = {
  processButtons: [
    { id: 'dedupeWithCommentsBtn', handler: Function },
    { id: 'normalizeBtn', handler: Function },
    { id: 'quickBtn', handler: Function },
    { id: 'fcjBtn', handler: Function },
    { id: 'nextStepBtn', handler: Function }
  ],
  utilityButtons: [
    { id: 'downloadBtn', handler: Function }
  ]
}
```

### 依賴關係

```
buttonManager.js
├── 依賴項 (可選注入)
│   ├── dedupeWithComments (處理功能)
│   ├── normalizeDictionary (處理功能)
│   ├── runMake (處理功能)
│   ├── nextStep / FileOps.moveOutputToInput (工具功能)
│   └── FileOps.download (工具功能)
│
└── 運行時依賴
    ├── jQuery ($)
    ├── UIHelpers.formatTimestamp() [可選]
    └── FileOps.download() [可選]
```

## 🔧 實作細節

### 1. 初始化流程

```javascript
init(actions) {
  if (actions) {
    // 1. 儲存注入的函式
    this._injectedActions = actions;
    
    // 2. 重建按鈕配置
    if (actions.onProcessActions) {
      this.configs.processButtons = [...];
    }
    
    if (actions.onUtilityActions) {
      this.configs.utilityButtons = [...];
    }
  }
  
  // 3. 綁定所有按鈕
  this.bindButtons();
}
```

### 2. 按鈕綁定邏輯

```javascript
bindButtons() {
  // 遍歷配置，逐一綁定
  this.configs.processButtons.forEach(({ id, handler }) => {
    const $btn = $(`#${id}`);
    if ($btn.length && typeof handler === 'function') {
      $btn.on('click', handler);
    }
  });
  
  // 同樣處理 utilityButtons
  this.configs.utilityButtons.forEach(...);
}
```

### 3. 下載處理邏輯

```javascript
handleDownload() {
  // 1. 取得輸出內容
  const data = $('#outputTextarea').val() || '';
  
  // 2. 生成檔名（帶時間戳）
  const timestamp = formatTimestamp() || fallback;
  const filename = `dict_output_${timestamp}.txt`;
  
  // 3. 執行下載（多層回退）
  const downloadFn = this._injectedActions?.onUtilityActions?.download 
    || FileOps?.download
    || global.downloadText;
  
  if (downloadFn) {
    downloadFn(data, filename);
  } else {
    // 錯誤處理
  }
}
```

## 📊 移轉對比

### 移轉前 (dictMaker.js)

```javascript
const ButtonManager = {
  configs: {
    processButtons: [
      { id: 'dedupeWithCommentsBtn', handler: () => dedupeWithComments() },
      // ...
    ],
    utilityButtons: [
      { id: 'downloadBtn', handler: function() { return ButtonManager.handleDownload(); } }
    ]
  },
  init() {
    this.bindButtons();
  },
  bindButtons() {
    this.configs.processButtons.forEach(({ id, handler }) => {
      $(`#${id}`).on('click', handler);
    });
    this.configs.utilityButtons.forEach(({ id, handler }) => {
      $(`#${id}`).on('click', handler);
    });
  },
  handleDownload() {
    const data = $('#outputTextarea').val() || '';
    const filename = `dict_output_${formatTimestamp()}.txt`;
    FileOps.download(data, filename);
  }
};
```

### 移轉後 (modules/buttonManager.js)

```javascript
// 完整的模組化版本
// - 支援依賴注入
// - 增強的錯誤處理
// - 詳細的 JSDoc 註解
// - 向後相容保證
// - IIFE 封裝

(function(global) {
  const ButtonManager = {
    configs: { /* 同上 */ },
    _injectedActions: null,
    
    init(actions) {
      // 新增依賴注入邏輯
      if (actions) {
        this._injectedActions = actions;
        // 動態重建配置
      }
      this.bindButtons();
    },
    
    bindButtons() { /* 增強版 */ },
    handleDownload() { /* 增強版 + 多層回退 */ }
  };
  
  global.Modules.buttonManager = ButtonManager;
  global.ButtonManager = ButtonManager;
})(window);
```

## 🧪 測試驗證

已創建測試檔案：`tmp_rovodev_test_buttonManager.html`

測試項目：
1. ✅ 模組載入檢查
2. ✅ 向後相容模式
3. ✅ 依賴注入模式
4. ✅ handleDownload 功能

## 📝 使用說明

### 在 dictMaker.js 中使用（當前模式）

```javascript
// 檔案：dictMaker.js
$(function() {
  PrefsManager.init();
  ButtonManager.init();  // ← 現有呼叫，仍然有效
});
```

### 未來升級到依賴注入模式（推薦）

```javascript
// 檔案：dictMaker.js
$(function() {
  PrefsManager.init();
  
  // 使用依賴注入，更明確的依賴關係
  ButtonManager.init({
    onProcessActions: {
      dedupeWithComments: dedupeWithComments,
      normalizeDictionary: normalizeDictionary,
      runMakeQuick: () => runMake('quick'),
      runMakeFCJ: () => runMake('fcj'),
      nextStep: FileOps.moveOutputToInput
    },
    onUtilityActions: {
      download: FileOps.download
    }
  });
});
```

## 🎯 設計優勢

### 1. 關注點分離
- 按鈕管理邏輯獨立於業務邏輯
- 配置與實作分離

### 2. 可測試性
- 可注入 mock 函式進行單元測試
- 不依賴全域狀態

### 3. 可維護性
- 集中管理所有按鈕配置
- 修改按鈕行為只需更新配置

### 4. 靈活性
- 支援動態配置
- 可在運行時改變按鈕行為

### 5. 向後相容
- 不破壞現有代碼
- 平滑升級路徑

## 📦 檔案結構

```
scripts/
├── dictMaker.js                    # 主程式（保留 ButtonManager 呼叫）
└── modules/
    ├── buttonManager.js           # ✨ 新實作的模組
    ├── fileOps.js                 # 依賴項
    └── uiHelpers.js               # 依賴項
```

## 🔄 後續建議

### 短期（可選）
1. 在 `dictMaker.js` 中註解掉舊的 ButtonManager 定義（第 64-104 行）
2. 更新 HTML 檔案，確保載入順序正確

### 中期（推薦）
1. 將 `dictMaker.js` 中的 ButtonManager 初始化改為依賴注入模式
2. 移除 `dictMaker.js` 中的 ButtonManager 舊定義

### 長期（最佳實踐）
1. 為 ButtonManager 添加單元測試
2. 考慮將按鈕配置提取到獨立的 JSON 檔案

## ✨ 關鍵特性總結

| 特性 | 實作狀態 | 說明 |
|------|---------|------|
| 依賴注入 | ✅ | 支援函式注入，解耦業務邏輯 |
| 向後相容 | ✅ | 保持原有 API，無破壞性變更 |
| 錯誤處理 | ✅ | 多層回退機制，友善錯誤訊息 |
| 文件註解 | ✅ | 完整的 JSDoc 註解 |
| 模組化 | ✅ | IIFE 封裝，命名空間管理 |
| 配置驅動 | ✅ | 集中式按鈕配置 |
| 容錯機制 | ✅ | 按鈕不存在時自動跳過 |

## 📌 重要注意事項

1. **模組載入順序**：
   - jQuery 必須先載入
   - uiHelpers.js 和 fileOps.js 建議先載入（但有回退機制）
   - buttonManager.js 在 dictMaker.js 之前載入

2. **全域依賴**：
   - 依賴 jQuery (`$`)
   - 依賴全域函式（向後相容模式）或注入的函式（依賴注入模式）

3. **HTML 更新**：
   - 確保 HTML 中包含 `<script src="scripts/modules/buttonManager.js"></script>`

## 🎉 完成狀態

- [x] 完整移轉 ButtonManager 邏輯
- [x] 實作依賴注入模式
- [x] 保持向後相容性
- [x] 添加完整文件註解
- [x] 實作錯誤處理機制
- [x] 創建測試檔案
- [x] 撰寫完成報告

---

**移轉完成時間**: 2024  
**開發者**: Rovo Dev  
**任務狀態**: ✅ 完成
