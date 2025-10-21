# Legacy 偏好清理與 formatOpt 記憶修正
日期: 2025-10-19

## 背景
- 問題：formatOpt 選 Pime 後刷新變回 Rime。
- 根因：migrateDictMakerPrefs() 每次載入都將 legacy 值覆蓋 unified 值，導致新選擇在重整後被舊鍵覆蓋。
- 決策：本工具為小程式，決定完全拋棄 legacy 偏好機制，統一使用 unifiedConfig 命名空間。

## 變更摘要
- 刪除覆蓋風險的 legacy 遷移：
  - scripts/configIntegration.js: migrateDictMakerPrefs() 改為僅清空 legacy dict_maker.* 鍵，避免覆蓋 unified。
  - scripts/modules/config.js: migrateDictMakerPrefs() 改為僅清空 legacy dict_maker.* 鍵。
- 保留單一真實來源（SSOT）：
  - 確認 prefs.js 讀寫已委派 unifiedConfig 的 ovodev_unified_dictMaker.*，不再依賴 legacy。

## 驗證
- 手動測試流程：
  1) 開啟 dictMaker.html，切換 formatOpt 為 Pime。
  2) 確認 localStorage 的 ovodev_unified_dictMaker.formatOpt 為 "Pime"。
  3) 重整頁面，formatOpt 應保持 "Pime"。
  4) 切回 Rime，重整後仍為 "Rime"。
- 注意：首次清理後，若存在舊的 legacy dict_maker.formatOpt，將會被刪除，不再影響之後的記憶。

## 後續
- 若有其他頁面仍使用 legacy prefs，建議同樣移除其遷移覆蓋，統一使用 unifiedConfig。

