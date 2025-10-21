

$(function(){
  const $btn = $('#sortDictBtn');
  const $range = $('#rangeInput');
  const $input = $('#inputTextarea');
  const $inputCount = $('#inputCount');
  $btn.on('click', async function(){
    const rangeStr = ($range.val() || '').trim();
    if ($inputCount.length) $inputCount.text('處理中...');
    $btn.prop('disabled', true);
    try {
      const text = await streamFilterDict(rangeStr, (p)=>{
        if ($inputCount.length) {
          const tip = p.total ? `${p.percent}%` : `${p.processed} 行`; // 若無總長，只顯示處理行數
          $inputCount.text(`處理中... ${p.percent || 0}%，已處理 ${p.processed} 行，符合 ${p.matched} 行`);
        }
      });
      if (typeof setInput === 'function') {
        setInput(text, 'rangeFilter');
      } else {
        $input.val(text);
      }
      if ($inputCount.length) {
        const n = text ? text.split(/\n/).filter(Boolean).length : 0;
        $inputCount.text(`載入 ${n} 行`);
      }
    } catch (e) {
      if ($inputCount.length) $inputCount.text('讀取或處理失敗');
      alert(e && e.message ? e.message : '篩選失敗');
    } finally {
      $btn.prop('disabled', false);
    }
  });
});



let dictMakerFreeCjLimitCtrl = null;
window.WORDS_TO_DICTMAKER_KEY = window.WORDS_TO_DICTMAKER_KEY || 'words_to_dictMaker_payload';
const WORDS_TO_DICTMAKER_KEY = window.WORDS_TO_DICTMAKER_KEY;
let isSyncingDictCountOpt = false;

$(function() {
  if (!window.IS_DICTMAKER_PAGE) return;
  try {
    const stored = localStorage.getItem(WORDS_TO_DICTMAKER_KEY);
    console.log('[dictMaker] check transfer payload', stored);
    if (!stored) return;

    const parsed = JSON.parse(stored);
    const text = parsed && typeof parsed.text === 'string' ? parsed.text : '';
    if (!text.trim()) {
      console.log('[dictMaker] payload empty after trim');
      localStorage.removeItem(WORDS_TO_DICTMAKER_KEY);
      return;
    }

    const applyPayload = () => {
      if (typeof setInput === 'function') {
        setInput(text, 'wordsTransfer');
      } else {
        const $input = $('#inputTextarea');
        $input.val(text);
        $input.trigger('input');
      }
    };

    applyPayload();
    setTimeout(applyPayload, 0);

    console.log('[dictMaker] payload applied');
    localStorage.removeItem(WORDS_TO_DICTMAKER_KEY);

    const $meta = $('#outputMeta');
    if ($meta.length) {
      $meta.text('已從切詞工具導入資料');
    }
  } catch (e) {
    console.warn('讀取跨頁傳入資料失敗:', e);
  }
});

function getDictMakerFreeCjLimit(defaultValue = 0) {
  if (dictMakerFreeCjLimitCtrl && typeof dictMakerFreeCjLimitCtrl.getValue === 'function') {
    return dictMakerFreeCjLimitCtrl.getValue();
  }
  const $select = $('#freeCjLimitSelect');
  if ($select.length) {
    const val = parseInt($select.val(), 10);
    if (Number.isFinite(val) && val >= 0) {
      return val;
    }
  }
  return defaultValue;
}

function setDictMakerFreeCjLimit(value) {
  if (dictMakerFreeCjLimitCtrl && typeof dictMakerFreeCjLimitCtrl.setValue === 'function') {
    dictMakerFreeCjLimitCtrl.setValue(value);
  } else {
    const $select = $('#freeCjLimitSelect');
    if ($select.length) {
      const fallback = parseInt($select.data('default-limit'), 10);
      const val = Number.isFinite(value) ? String(value) : String(Number.isFinite(fallback) ? fallback : 0);
      $select.val(val);
    }
  }
}

// 共用的字數過濾邏輯（使用組件提供的過濾器）
function syncDictMakerCountOpt(baseValue) {
  const $countOpt = $('#countOpt');
  if (!$countOpt.length) return;
  const baseEnabled = baseValue > 0;
  const current = $countOpt.is(':checked');
  if (current !== baseEnabled) {
    isSyncingDictCountOpt = true;
    $countOpt.prop('checked', baseEnabled);
    isSyncingDictCountOpt = false;
  }
  if (typeof prefs !== 'undefined' && prefs.set) {
    try { prefs.set('countOpt', baseEnabled); } catch (_) {}
  }
}


// ===== 格式選項聯動（Rime/Pime 預設）=====
function applyFormatPreset(preset) {
  const p = String(preset || '').toLowerCase();
  if (!p) return;

  let rootOrder = 'after';
  let separator = '\t';
  let freeLimit = 0;
  let base = 3; // Rime

  if (p === 'pime') {
    rootOrder = 'before';
    separator = ' ';
    freeLimit = 5;
    base = 0; // Pime
  }

  // 1) 寫入 rime base（共用記憶）
  if (typeof RimeBaseManager !== 'undefined') {
    RimeBaseManager.setBase(base);
  } else {
    $('#rimeBaseInput').val(String(base)).trigger('input');
  }

  // 2) 寫入 rootOrder, separator
  $('#rootOrderOpt').val(rootOrder).trigger('change');
  $('#separatorOpt').val(separator).trigger('change');

  // 3) 寫入 freeCjLimit
  try { setDictMakerFreeCjLimit(freeLimit); } catch (_) {}
  try { if (typeof prefs !== 'undefined') prefs.set('freeCjLimitSelect', String(freeLimit)); } catch (_) {}
  $('#freeCjLimitSelect').trigger('change');
}

function initFormatSync() {
  const $format = $('#formatOpt');
  if (!$format.length) return;
  $format.on('change', function() {
    const v = $(this).val();
    if (v === 'Rime' || v === 'Pime') {
      applyFormatPreset(v);
    }
  });
  // 初始化時不聯動，只有用戶主動選擇格式時才套用預設組合
  // 其他選項（rootOrder、separator、freeCjLimit）各自恢復記憶值
}function transformTextForRimeBase(text, baseValue) {
  if (typeof RimeBaseManager !== 'undefined') {
    return RimeBaseManager.applyBaseToText(text, baseValue, 1);
  }
  const lines = String(text || '').split(/\r?\n/);
  const processed = [];
  let total = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      processed.push(line);
      continue;
    }
    const match = line.match(/^(.+?)(?:\s+(\d+))?$/);
    if (!match) {
      processed.push(line);
      continue;
    }
    const word = match[1].trim();
    if (!word) continue;
    total += 1;
    const count = match[2] ? parseInt(match[2], 10) : NaN;
    if (baseValue > 0) {
      const normalized = Number.isFinite(count) && count > 0 ? count : 1;
      processed.push(`${word} ${normalized + baseValue}`);
    } else {
      processed.push(word);
    }
  }
  return { text: processed.join('\n'), total };
}



function getCharLengthFilter() {
  // 檢查組件是否可用
  if (typeof CharLengthOptions !== 'undefined' && CharLengthOptions.getFilter) {
    try {
      return CharLengthOptions.getFilter();
    } catch (e) {
      console.warn('字數選項組件不可用，使用預設邏輯:', e);
    }
  }
  
  // 回退邏輯：沒有UI時預設為不受限
  const checkBox = (id) => {
    const $el = $(id);
    return $el.length ? $el.is(':checked') : true;
  };
  
  return function(charLength) {
    if (charLength === 1) return checkBox('#fcjOpt_singleChar');
    if (charLength === 2) return checkBox('#fcjOpt_2char');
    if (charLength === 3) return checkBox('#fcjOpt_3char');
    if (charLength === 4) return checkBox('#fcjOpt_4char');
    if (charLength >= 5) return checkBox('#fcjOpt_5pluschar');
    return true;
  };
}

// 偏好設定（localStorage）
const prefs = {
  _prefKey(key) { return 'dict_maker.' + key; },
  get(key, defVal=null) {
    try { const v = localStorage.getItem(this._prefKey(key)); return v === null ? defVal : JSON.parse(v); } catch { return defVal; }
  },
  set(key, val) {
    try { localStorage.setItem(this._prefKey(key), JSON.stringify(val)); } catch {}
  },
  remove(key) { try { localStorage.removeItem(this._prefKey(key)); } catch {} }
};

// 偏好存取
// 移除舊版簡化 prefs，統一使用上方 dict_maker.* 帶前綴 JSON 版本


// 偏好設定管理器
const PrefsManager = {
  // 定義所有偏好項目的配置
  configs: {
    // checkbox 項目（包括字數選項）
    checkboxes: [
      { id: 'fcjOpt_freq1000_code3_to_code2', defaultValue: false },
      { id: 'fcjOpt_singleChar', defaultValue: true },
      { id: 'fcjOpt_2char', defaultValue: true },
      { id: 'fcjOpt_3char', defaultValue: true },
      { id: 'fcjOpt_4char', defaultValue: true },
      { id: 'fcjOpt_5pluschar', defaultValue: true },
      { id: 'countOpt', defaultValue: false }
    ],
    // select 項目
    selects: [
      { id: 'separatorOpt', defaultValue: ' ' },
      { id: 'rootOrderOpt', defaultValue: 'after' },
      { id: 'formatOpt', defaultValue: '' }
    ],
    // input 項目
    inputs: [
      { id: 'rangeInput', defaultValue: '>2999' }
    ]
  },

  // 初始化所有偏好設定
  init() {
    try {
      this.restorePreferences();
      this.bindEvents();
    } catch (e) {
      console.warn('偏好設定初始化失敗:', e);
    }
  },

  // 恢復偏好設定
  restorePreferences() {
    // 恢復 checkbox 狀態
    this.configs.checkboxes.forEach(({ id, defaultValue }) => {
      const value = prefs.get(id);
      const checked = value !== null ? (value === true || value === '1') : defaultValue;
      $(`#${id}`).prop('checked', checked);
    });

    // 恢復 select 狀態
    this.configs.selects.forEach(({ id, defaultValue }) => {
      const value = prefs.get(id);
      $(`#${id}`).val(value !== null ? value : defaultValue);
    });

    // 恢復 input 狀態
    this.configs.inputs.forEach(({ id, defaultValue }) => {
      const value = prefs.get(id);
      $(`#${id}`).val(value !== null ? value : defaultValue);
    });
  },

  // 綁定偏好設定事件
  bindEvents() {
    // 綁定 checkbox 事件
    this.configs.checkboxes.forEach(({ id }) => {
      $(`#${id}`).on('change', function() {
        prefs.set(id, this.checked === true);
      });
    });

    // 綁定 select 事件
    this.configs.selects.forEach(({ id }) => {
      $(`#${id}`).on('change', function() {
        prefs.set(id, this.value);
      });
    });

    // 綁定 input 事件
    this.configs.inputs.forEach(({ id }) => {
      $(`#${id}`).on('input change', function() {
        prefs.set(id, this.value);
      });
    });
  }
};

// 按鈕事件管理器
const ButtonManager = {
  // 按鈕配置
  configs: {
    // 處理按鈕
    processButtons: [
      { id: 'dedupeWithCommentsBtn', handler: () => dedupeWithComments() },
      { id: 'normalizeBtn', handler: () => normalizeDictionary() },
      { id: 'quickBtn', handler: () => runMake('quick') },
      { id: 'fcjBtn', handler: () => runMake('fcj') },
      { id: 'nextStepBtn', handler: () => nextStep() }
    ],
    // 工具按鈕 - 使用字符串引用避免初始化順序問題
    utilityButtons: [
      { id: 'downloadBtn', handler: function() { return ButtonManager.handleDownload(); } }
    ]
  },

  init() {
    this.bindButtons();
  },

  // 綁定所有按鈕
  bindButtons() {
    // 綁定處理按鈕
    this.configs.processButtons.forEach(({ id, handler }) => {
      $(`#${id}`).on('click', handler);
    });

    // 綁定工具按鈕
    this.configs.utilityButtons.forEach(({ id, handler }) => {
      $(`#${id}`).on('click', handler);
    });
  },

  // 下載處理
  handleDownload() {
    const data = $('#outputTextarea').val() || '';
    const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `dict_output_${ts}.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }
};

// 輸出轉輸入功能
function nextStep() {
  const outputData = $('#outputTextarea').val() || '';
  $('#inputTextarea').val(outputData);
  
  // 更新狀態
  const $meta = $('#outputMeta');
  if ($meta.length) {
    $meta.text('輸出已轉移到輸入區域');
  }
}

// 初始化所有管理器
$(function() {
  // 1. 最前面初始化 PrefsManager
  if (window.PrefsManager && typeof PrefsManager.init === 'function') {
    PrefsManager.init();
  }
  
  // 初始化字數選項組件
  CharLengthOptions.inject('#dictMakerCharOptions', {
    options: [
      { id: 'fcjOpt_singleChar', label: '單字', length: 1, default: true },
      { id: 'fcjOpt_2char', label: '2字', length: 2, default: true },
      { id: 'fcjOpt_3char', label: '3字', length: 3, default: true },
      { id: 'fcjOpt_4char', label: '4字', length: 4, default: true },
      { id: 'fcjOpt_5pluschar', label: '5字以上', length: '5+', default: true }
    ]
  });
  
  if (typeof FreeCjLimitSelector !== 'undefined') {
    const defaultLimit = parseInt($('#freeCjLimitSelect').data('default-limit'), 10);
    dictMakerFreeCjLimitCtrl = FreeCjLimitSelector.bind('#freeCjLimitSelect', {
      defaultValue: Number.isFinite(defaultLimit) ? defaultLimit : 0
    });
  } else {
    dictMakerFreeCjLimitCtrl = null;
  }
  
  if (typeof RimeBaseManager !== 'undefined') {
    let storedCountPref = null;
    if (typeof prefs !== 'undefined' && typeof prefs.get === 'function') {
      try { storedCountPref = prefs.get('countOpt'); } catch (_) { storedCountPref = null; }
    }
    if (storedCountPref === false || storedCountPref === '0') {
      RimeBaseManager.setBase(0, { silent: true });
    }
    RimeBaseManager.bindInput('#rimeBaseInput', {
      onChange: (base) => {
        syncDictMakerCountOpt(base);
      }
    });
    syncDictMakerCountOpt(RimeBaseManager.getBase());
  } else {
    $('#rimeBaseInput').on('input change', function() {
      const val = parseInt($(this).val(), 10);
      const baseValue = Number.isFinite(val) && val >= 0 ? val : 0;
      syncDictMakerCountOpt(baseValue);
    });
  }
  
  $('#countOpt').on('change', function() {
    if (isSyncingDictCountOpt) return;
    if (typeof RimeBaseManager === 'undefined') return;
    const checked = $(this).is(':checked');
    if (checked) {
      const currentBase = RimeBaseManager.getBase();
      if (currentBase <= 0) {
        const fallback = RimeBaseManager.getLastPositiveBase() || RimeBaseManager.getDefault();
        RimeBaseManager.setBase(fallback);
      }
    } else {
      const currentBase = RimeBaseManager.getBase();
      if (currentBase > 0) {
        RimeBaseManager.setBase(0);
      }
    }
  });
  
  
  initFormatSync();
});

// 補完整字典功能
async function normalizeDictionary() {
  const raw = $('#inputTextarea').val() || '';
  if (!raw.trim()) {
    $('#outputTextarea').val('');
    return;
  }

  const separator = ($('#separatorOpt').val() || ' ').replace(/\\t/g, '\t');
  const lines = raw.split(/\r?\n/);
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 保留空行和註解行
    if (!trimmed || trimmed.startsWith('#')) {
      result.push(line);
      continue;
    }

    // 解析資料行
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) {
      result.push(line); // 保持原樣
      continue;
    }

    let word = '', root = '', count = 1;

    if (parts.length === 2 && !isNaN(parts[1])) {
      // 格式: 詞組\t計數
      word = parts[0];
      count = parseInt(parts[1], 10);
      
      // 生成字根
      if (/^[a-zA-Z]+$/.test(word)) {
        // 英文: 字根轉小寫，詞組保持原形
        root = word.toLowerCase();
      } else if (/^[\u4e00-\u9fff]+$/.test(word)) {
        // 中文: 生成快倉碼
        try {
          const cjResult = await FcjUtils.cjMakeFromText(word, 'fcj', {
            charLengthFilter: () => true,
            showCount: false,
            separator: ' ',
            freeCjMaxLength: freeCjLimit
          });
          
          if (cjResult) {
            const cjLines = cjResult.split('\n').filter(Boolean);
            if (cjLines.length > 0) {
              const cjParts = cjLines[0].split(' ');
              root = cjParts[1] || word; // 取字根或回退到原詞
            } else {
              root = word; // 回退
            }
          } else {
            root = word; // 回退
          }
        } catch (e) {
          console.warn('生成快倉碼失敗:', word, e);
          root = word; // 回退
        }
      } else {
        root = word; // 其他情況直接用詞組當字根
      }
    } else {
      // 格式: 詞組\t字根\t計數 或 字根\t詞組\t計數 或 詞組\t字根 (計數=1)
      if (parts.length >= 3 && !isNaN(parts[2])) {
        count = parseInt(parts[2], 10);
      }

      // 判斷字根和詞組的位置
      if (/^[a-z]+$/.test(parts[0])) {
        // 第一個是字根
        root = parts[0];
        word = parts[1];
      } else if (/^[a-z]+$/.test(parts[1])) {
        // 第二個是字根
        word = parts[0];
        root = parts[1];
      } else {
        // 都不是字根格式，跳過
        result.push(line);
        continue;
      }
    }

    // 輸出統一格式: 詞組\t字根\t計數
    result.push(`${word}${separator}${root}${separator}${count}`);
  }

  $('#outputTextarea').val(result.join('\n'));

  // 更新計數
  const $outCount = $('#outputCount');
  if ($outCount.length) {
    $outCount.text(`總計 ${result.length} 行`);
  }

  const $meta = $('#outputMeta');
  if ($meta.length) {
    $meta.text('本次使用：補完整字典功能');
    $('#flowQuick, #flowFCJ').css({ borderColor: '#ccc' });
  }
}

// 檢查格式是否需要標準化
function needsNormalization(lines) {
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;
    
    // 檢查是否有 詞組\t計數 格式（需要補字根）
    if (parts.length === 2 && !isNaN(parts[1])) {
      return true;
    }
    
    // 檢查是否有無字根的不規範格式
    if (parts.length >= 2) {
      const p0 = parts[0], p1 = parts[1];
      const hasRoot = /^[a-z]+$/.test(p0) || /^[a-z]+$/.test(p1);
      if (!hasRoot) {
        return true;
      }
    }
  }
  return false;
}

// 含註解去重功能 -- v2 : 智能格式處理 + 去重
async function dedupeWithComments() {
  const raw = $('#inputTextarea').val() || '';
  if (!raw.trim()) {
    $('#outputTextarea').val('');
    return;
  }

  const lines = raw.split(/\r?\n/);
  
  // 檢查是否需要先標準化格式
  if (needsNormalization(lines)) {
    const $meta = $('#outputMeta');
    if ($meta.length) {
      $meta.text('檢測到格式異常，正在自動標準化...');
    }
    
    // 執行標準化
    await normalizeDictionary();
    
    // 使用標準化後的結果作為新的輸入
    const normalizedData = $('#outputTextarea').val();
    if (!normalizedData.trim()) {
      if ($meta.length) {
        $meta.text('標準化失敗，請檢查輸入格式');
      }
      return;
    }
    
    // 重新設定輸入為標準化後的資料
    const normalizedLines = normalizedData.split(/\r?\n/);
    
    if ($meta.length) {
      $meta.text('格式標準化完成，正在去重...');
    }
    
    // 繼續執行去重邏輯
    await performDeduplication(normalizedLines);
  } else {
    // 格式正常，直接去重
    await performDeduplication(lines);
  }
}

// 執行去重邏輯（從原 dedupeWithComments 提取）
async function performDeduplication(lines) {
  const separator = ($('#separatorOpt').val() || ' ').replace(/\\t/g, '\t');
  const defaultLimitAttr = parseInt($('#freeCjLimitSelect').data('default-limit'), 10);
  const freeCjLimit = getDictMakerFreeCjLimit(Number.isFinite(defaultLimitAttr) ? defaultLimitAttr : 0);
  const result = new Array(lines.length);
  const seen = Object.create(null);

  // 一次遍歷完成：標記 + 去重
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 保留空白與註解
    if (!trimmed || trimmed.startsWith('#')) {
      result[i] = line; // 原樣保留
      continue;
    }

    // 快速切割
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;

    // 根據簡單規則判斷 root/word/count (巢狀判斷，全小寫優先為字根)
    let root = '', word = '', count = 1;
    const p0 = parts[0], p1 = parts[1], p2 = parts[2];

    if (/^[a-z]+$/.test(p0)) {
      // p0 是全小寫
      if (!/^[a-z]+$/.test(p1)) {
        // p1 不是全小寫 → p0 是字根
        root = p0;
        word = p1;
        if (p2 && /^\d+$/.test(p2)) count = +p2;
      } else {
        // p0 p1 都是小寫 → 保持原順序，p0 當字根
        root = p0;
        word = p1;
        if (p2 && /^\d+$/.test(p2)) count = +p2;
      }
    } else {
      // p0 不是全小寫
      if (/^[a-z]+$/.test(p1)) {
        // p1 是全小寫 → p1 是字根
        word = p0;
        root = p1;
        if (p2 && /^\d+$/.test(p2)) count = +p2;
      } else {
        // 都不是標準字根格式，跳過
        continue;
      }
    }

    if (freeCjLimit > 0 && root && root.length > freeCjLimit) {
      root = root.substring(0, freeCjLimit);
    }

    const key = root + '|' + word;
    const existing = seen[key];

    if (existing) {
      existing.count += count;
      // 記錄為已處理，原位置留 null
      result[i] = null;
    } else {
      seen[key] = { root, word, count, index: i };
    }
  }

  // 第二階段：將 seen 結果回填到原始順序
  for (const key in seen) {
    const { index, root, word, count } = seen[key];
    result[index] = `${word}${separator}${root}${separator}${count}`;
  }

  // 輸出結果（過濾掉 null）
  const finalLines = result.filter(line => line !== null);

  $('#outputTextarea').val(finalLines.join('\n'));

  const $outCount = $('#outputCount');
  if ($outCount.length) $outCount.text(`總計 ${finalLines.length} 行`);

  const $meta = $('#outputMeta');
  if ($meta.length) {
    $meta.text('本次使用：智能註解去重功能（含自動格式標準化）');
    $('#flowQuick, #flowFCJ').css({ borderColor: '#ccc' });
  }
}
/*
含註解去重功能 -- v2

優點分析

1. 性能優化
• 單次遍歷：原版需要多次遍歷，新版 O(n) 單次遍歷，舊版實際是 O(3n~4n)
• 避免字符串操作：不需要添加/移除 __skip__ 標記，減少字符串處理開銷
• 直接索引訪問：使用 result[i] 直接定位，比查找映射更高效

2. 內存效率
• 預分配陣列：new Array(lines.length) 避免動態擴容
• 原地操作：直接在結果陣列中標記和修改，不需要額外的臨時陣列
• 簡單資料結構：Object.create(null) 比 Map 稍微輕量一些

3. 代碼簡潔性
• 邏輯直觀：一次遍歷完成所有核心邏輯
• 狀態管理簡單：不需要多階段處理和複雜的標記系統
• 減少代碼量：約 50% 的代碼行數減少

4. 可讀性
• 流程清晰：處理邏輯更線性，容易理解
• 變數命名清楚：p0, p1, p2 簡潔明瞭

缺點分析

1. 內存使用
• 空間浪費：result 陣列初始大小等於輸入行數，但最終可能有很多 null
• 重複項目開銷：重複行會在陣列中留下 null，在記憶體中佔位

2. 邏輯複雜度
• 索引依賴：依賴索引對應關係，較容易出錯
• null 處理：需要額外的 filter 步驟處理 null 值

3. 擴展性限制
• 固定處理模式：如果未來需要其他類型的標記或處理，較難擴展
• 調試困難：出錯時較難追蹤哪些行被如何處理

4. 邊界情況
• 稀疏陣列：大量重複時會產生稀疏陣列，filter 操作成本較高
• 內存峰值：短期內同時持有原始和結果陣列
*/

// 註解去重功能 -- v1 : 適合更大型的文件
function dedupeWithComments_v1() {
  const raw = $('#inputTextarea').val() || '';
  const lines = raw.split(/\r?\n/);
  let skipId = 0;

  // 第一階段：為註解和空行添加 __skip__{id} 標記
  const processedLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 空行或註解行添加標記
    if (!trimmed || trimmed.startsWith('#')) {
      processedLines.push(`__skip__${skipId++} ${line}`);
    } else {
      processedLines.push(line);
    }
  }

  // 第二階段：對處理後的內容進行去重
  const seen = new Map();

  for (let i = 0; i < processedLines.length; i++) {
    const line = processedLines[i].trim();

    // 跳過 __skip__ 標記的行
    if (line.startsWith('__skip__')) continue;

    // 解析資料行
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;

    let root = '', word = '', count = 1;

    // 判斷字根和字詞的位置
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

    if (freeCjLimit > 0 && root && root.length > freeCjLimit) {
      root = root.substring(0, freeCjLimit);
    }

    const key = root + '|' + word;

    if (!seen.has(key)) {
      seen.set(key, { root: root, word: word, count: count, index: i, originalLine: line });
    } else {
      const existing = seen.get(key);
      existing.count += count;
      // 標記原始行為已處理
      processedLines[i] = `__processed__${i}`;
    }
  }

  // 第三階段：重新組合結果
  const separator = $('#separatorOpt').val().replace(/\\t/g, '\t') || ' ';
  const dedupeMap = new Map();

  // 建立去重後的資料映射
  for (const [key, data] of seen.entries()) {
    const newLine = `${data.word}${separator}${data.root}${separator}${data.count}`;
    dedupeMap.set(data.index, newLine);
  }

  // 第四階段：按原始順序輸出，移除標記
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
      // 使用去重後的資料
      result.push(dedupeMap.get(i));
    } else {
      // 保持原始資料行
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
    $meta.text('本次使用：註解去重功能');
    $('#flowQuick, #flowFCJ').css({ borderColor: '#ccc' });
  }
}


// override runMake with shared implementation
function runMake(mode) {
  console.log('runMake called with mode:', mode);
  const raw = $('#inputTextarea').val() || '';
  const append3AtEnd = (mode === 'fcj') && $('#fcjOpt_freq1000_code3_to_code2').is(':checked');
  const charLengthFilter = getCharLengthFilter();
  const base = typeof RimeBaseManager !== 'undefined'
    ? RimeBaseManager.getBase()
    : (() => {
        const parsed = parseInt($('#rimeBaseInput').val(), 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
      })();
  const baseEnabled = base > 0;
  const separator = ($('#separatorOpt').val() || ' ').replace(/\\t/g, '\t');
  const rootOrder = $('#rootOrderOpt').val() || 'after';
  const defaultLimitAttr = parseInt($('#freeCjLimitSelect').data('default-limit'), 10);
  const freeCjLimit = getDictMakerFreeCjLimit(Number.isFinite(defaultLimitAttr) ? defaultLimitAttr : 0);
  console.log('runMake params:', { base, baseEnabled, separator });

  const payloadInfo = transformTextForRimeBase(raw, base);
  const payload = payloadInfo.text;

  FcjUtils.cjMakeFromText(payload, mode, {
    append3AtEnd,
    charLengthFilter,
    showCount: baseEnabled,
    separator,
    rootOrder,
    freeCjMaxLength: freeCjLimit
  })
    .then(finalText => {
      $('#outputTextarea').val(finalText);
      const $outCount = $('#outputCount');
      if ($outCount.length) {
        const n = finalText ? finalText.split(/\n/).filter(Boolean).length : 0;
        $outCount.text(`總計 ${n} 行`);
      }
      const $meta = $('#outputMeta');
      if ($meta.length) {
        const modeTitle = mode === 'quick' ? '速成流程' : '快倉流程';
        $meta.text(`本次使用：${modeTitle}`);
        $('#flowQuick, #flowFCJ').css({ borderColor: '#ccc' });
        if (mode === 'quick') $('#flowQuick').css({ borderColor: 'green' });
        else $('#flowFCJ').css({ borderColor: 'green' });
      }
    })
    .catch(e => {
      alert(e && e.message ? e.message : '轉碼失敗');
    });
}



