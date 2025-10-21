# 變更記錄 (CHANGELOG)

本檔案記錄使用者可感知的功能變更與修正。所有時間以 UTC+8 表示。

## [Unreleased]
- 計劃：補充格式聯動與初始化一致性的單元測試。

## [2025-XX-XX] Config Unification + Format Linkage Fix
### 解決技術債（雙來源配置統一）
- 採用方案 A：`prefs.js` 以特徵檢測委派到 `unifiedConfig`（SSOT）。
- 實作：
  - `prefs.js` 實作委派與 fallback，並提供一次性資料遷移（涵蓋 `rootOrderOpt`、`formatOpt`）。
  - 完整遷移清單與相容命名空間：`dictMaker.*`。
- 向後相容：維持 legacy localStorage 讀取作為後備。

### 格式聯動修正（分隔符）
- 根因：HTML 使用字面量 "\t"，JS 委派不一致導致分隔符選取失敗。
- 修正：
  - HTML 使用實際 tab 字元；JavaScript 同步改為實際 tab 字元。
  - 新增初始化時的格式套用：`initFormatSync()` 會在載入時套用目前格式組合。
  - 重構：拆分 `applyFormatSettings()` 以提升可重用性。

## [2024-XX-XX] Format Selector: Separator Auto-Linkage
### 增強
- 格式聯動新增分隔符自動設定：
  - Rime 選擇時 → `rootOrderOpt=after`、`countOpt=true`、`separatorOpt=tab`。
  - Pime 選擇時 → `rootOrderOpt=before`、`countOpt=false`、`separatorOpt=space`。
- 文件更新：README、docs/FEATURE_FORMAT_OPTIONS.md 已補充分隔符聯動說明。

## [2024-XX-XX] Format Selector + Memory
### 新增
- 新增格式下拉選單（`#formatOpt`）：Rime（預設）/ Pime，位於字根選項旁。
- 加入格式聯動機制：
  - Rime 選擇時 → 自動設定 `rootOrderOpt=after`、`countOpt=true`。
  - Pime 選擇時 → 自動設定 `rootOrderOpt=before`、`countOpt=false`。
  - 僅在格式變更時觸發，不覆蓋使用者既有偏好。
- `rootOrderOpt` 記憶功能：加入 `prefs.js` 配置，會記憶上次選擇的字根順序。
- 四按鈕一致支援：`quickBtn`、`fcjBtn`、`normalizeBtn`、`dedupeWithCommentsBtn` 均支援字根順序控制。

### 變更
- README 新增「格式選項與記憶」與使用指南，補充完整流程。

### 已知問題
- 雙來源風險：`prefs.js` 與 `configIntegration.js` 同時存在偏好存取機制；建議收斂到單一配置來源。
