# tools/ 目錄說明

本目錄收納從臨時測試檔抽取的可重用工具（最小可行）。均採 UMD 格式，既可於瀏覽器以 <script> 載入，也可在 Node 透過 require 使用。

## 一覽
- browserTestHarness.js：輕量測試支架（收集測試結果、渲染列表、輸出摘要）
- mockCjProvider.js：可配置的倉頡/拼音 mock 提供者（async function）
- nodeEvalLoader.js：以 eval 方式將瀏覽器腳本載入至 Node 全域（僅限本地測試）

## 使用示例

### 1) 瀏覽器測試頁
```html
<script src="tools/browserTestHarness.js"></script>
<script>
  const t = TestHarness.createHarness();
  t.add('模組可用', typeof window.Modules !== 'undefined');
  t.render('test-results');
  console.log(t.summary());
</script>
```

### 2) 模擬 cjProvider（瀏覽器/Node 皆可）
```js
// UMD：瀏覽器 window.MockCjProvider 或 Node require('tools/mockCjProvider')
const provider = MockCjProvider.create({ '自定義': 'custom' });
const root = await provider('單字'); // 'danzi'
```

### 3) Node 端載入瀏覽器腳本
```js
const { loadToGlobal } = require('./tools/nodeEvalLoader');
const ctx = loadToGlobal('scripts/modules/dictCore.js');
// 之後可直接使用 ctx.window.normalizeDictionaryCore([...], opts)
```

## 注意事項
- nodeEvalLoader.js 透過 eval 執行，不適合生產環境；僅用於本地快速驗證。
- 如需更嚴謹的 Node 測試，建議導入 jsdom 或調整模組輸出為可被 Node 直接匯入。