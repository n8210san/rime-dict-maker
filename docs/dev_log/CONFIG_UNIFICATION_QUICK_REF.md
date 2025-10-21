# 配置統一方案快速參考

## 🎯 核心概念

**單一真實來源 (SSOT):** 所有配置統一使用 unifiedConfig，不再有雙來源問題

## 📝 實作檔案

| 檔案 | 變更內容 |
|------|---------|
| `scripts/configIntegration.js` | 擴充遷移清單 (+2 鍵) |
| `scripts/modules/config.js` | 擴充遷移清單 (+2 鍵) |
| `scripts/modules/prefs.js` | 委派邏輯 + 遷移 + fallback |

## 🔑 新增的配置鍵

- `rootOrderOpt` (字根順序: before/after)
- `formatOpt` (格式: Rime/Pime)

## 🔄 工作流程

```
prefs API → 檢測 unifiedConfig → 委派/Fallback
                                      ↓
                        unifiedConfig (SSOT) ✅
                                 或
                        localStorage (Legacy) 🔄
```

## ⚡ 快速驗證

### 1 分鐘驗證
```javascript
// Console 執行
console.log('有 unifiedConfig?', typeof unifiedConfig !== 'undefined');
prefs.set('testKey', 'test');
console.log('寫入位置:', unifiedConfig.get('dictMaker.testKey'));
// 應輸出: "test"
```

### 5 分鐘驗證
開啟 `tmp_rovodev_test_config_unification.html`，執行所有測試，確認都是 ✅

## 🐛 問題排查

| 問題 | 原因 | 解決方法 |
|------|------|---------|
| 找不到 unifiedConfig | 載入順序錯誤 | 確認 configIntegration.js 在 prefs.js 之前 |
| 寫入 legacy 位置 | 委派未生效 | 檢查 `prefs._hasUnifiedConfig()` |
| UI 沒有恢復設定 | PrefsManager 未初始化 | 確認有呼叫 `PrefsManager.init()` |

## 📊 儲存位置

| 模式 | 儲存位置 | 範例 |
|------|---------|------|
| Unified ✅ | `rovodev_unified_dictMaker.*` | `rovodev_unified_dictMaker.formatOpt` |
| Legacy 🔄 | `dict_maker.*` | `dict_maker.formatOpt` |

## 🔧 常用指令

### 檢查當前模式
```javascript
console.log('當前模式:', prefs._hasUnifiedConfig() ? 'Unified ✅' : 'Legacy 🔄');
```

### 查看所有配置
```javascript
// Unified 配置
console.log('formatOpt:', unifiedConfig.get('dictMaker.formatOpt'));
console.log('rootOrderOpt:', unifiedConfig.get('dictMaker.rootOrderOpt'));
```

### 清空所有配置
```javascript
for (let i = localStorage.length - 1; i >= 0; i--) {
  const key = localStorage.key(i);
  if (key.startsWith('dict_maker.') || key.startsWith('rovodev_unified_dictMaker.')) {
    localStorage.removeItem(key);
  }
}
```

### 強制重新遷移
```javascript
prefs._migrated = false;
prefs.get('formatOpt'); // 觸發遷移
```

## 📖 完整文檔

| 文檔 | 用途 |
|------|------|
| `CONFIG_UNIFICATION_SUMMARY.md` | 實作總結 |
| `CONFIG_UNIFICATION_IMPLEMENTATION.md` | 詳細實作報告 |
| `CONFIG_UNIFICATION_VERIFICATION.md` | 完整驗證清單 |
| `tmp_rovodev_test_config_unification.html` | 自動化測試 |

## ✅ 檢查清單

快速檢查實作是否正常：

- [ ] 開啟 dictMaker.html，Console 無錯誤
- [ ] 修改設定後刷新，設定有保留
- [ ] 執行 `console.log(unifiedConfig.get('dictMaker.formatOpt'))`，有正確值
- [ ] localStorage 只有 `rovodev_unified_*`，無 `dict_maker.*` 殘留
- [ ] 開啟測試頁面，5 個測試都是 ✅

**全部打勾 = 實作成功！** 🎉

## 💡 最佳實踐

### 使用配置
```javascript
// ✅ 推薦：使用 prefs API
const format = prefs.get('formatOpt', 'Rime');
prefs.set('formatOpt', 'Pime');

// ❌ 避免：直接操作 localStorage
localStorage.setItem('dict_maker.formatOpt', 'Pime'); // 不推薦
```

### 新增配置鍵
1. 在 PrefsManager.configs 中定義
2. 在 migrateDictMakerPrefs 中新增到遷移清單
3. 無需修改 prefs.js（自動委派）

## 🎓 技術要點

- **Feature Detection:** 執行期檢測，不依賴載入順序
- **Graceful Degradation:** 無 unifiedConfig 時自動 fallback
- **One-time Migration:** 首次遷移後設定標記
- **Non-destructive:** 不覆蓋 unified 中已存在的值
- **Error Handling:** 所有操作都有 try-catch 保護

## 🚦 狀態指標

| 指標 | 含義 |
|------|------|
| ✅ | 已完成/正常 |
| 🔄 | Legacy 模式/待遷移 |
| ❌ | 錯誤/失敗 |
| ⚠️ | 警告/需注意 |

---

**快速聯絡:** 有問題請查閱完整文檔或檢查 Console 訊息
