// Legacy utils.js - 已重構，保留向後相容性
// 新專案請使用 scripts/modules/ 下的現代模組
(function(global){
  'use strict';

  // 檢查是否已載入現代模組系統
  if (typeof global.ModuleSystem !== 'undefined') {
    console.log('⚡ 檢測到現代模組系統，utils.js 進入輕量模式');
    // 載入輕量相容層
    loadCompatibilityLayer();
    return;
  }

  //console.log('📦 載入傳統 utils.js (建議升級到 v2.0 模組系統)');

  // 簡化的撤銷系統
  const undoStack = [];
  const UNDO_MAX = 30; // 減少記憶體使用

  function updateUndoLabel() {
    const n = undoStack.length;
    const $btn = $('#undoBtn');
    if ($btn.length) {
      $btn.text(n ? `復原(${n})` : '復原').prop('disabled', !n);
    }
  }
  function pushUndo(opts) {
    const $in = $('#inputTextarea');
    const $out = $('#outputTextarea');
    if (!$in.length || !$out.length) return;
    undoStack.push({ input: $in.val(), output: $out.val() || '' });
    if (undoStack.length > UNDO_MAX) undoStack.shift();
    updateUndoLabel();
    const noteEl = $('#excuted_result');
    const noteTxt = noteEl.text();
    let outputTxt = $('#langFilterSelect option:selected').text()
    console.log(outputTxt,opts);
    outputTxt = outputTxt +' '+ opts;
    console.log(outputTxt,opts);
    $('#excuted_result').text(outputTxt).css('color','green');
  }

  function normalizeOpts(o) {
    if (typeof o === 'string') return { op: o };
    if (typeof o === 'boolean') return { skipUndo: o };
    return o || {};
  }
  
  let lastOp = null;
  function applyChange($el, newVal, opts) {
    /**
     * 將新值應用於指定的 jQuery 元素（通常是 textarea），並智能地處理復原堆疊。
     * @param {jQuery} $el - 要修改的目標 jQuery 元素。
     * @param {string|Array} newVal - 要設定的新值。如果為陣列，會自動用換行符連接。
     * @param {Object|string|boolean} opts - 選項物件。
     *   @param {string} [opts.op=null] - 本次操作的唯一標識符，用於將連續的相同操作分組，避免產生過多復原點。
     *   @param {boolean} [opts.skipUndo=false] - 如果為 true，則強制跳過此次變更的復原記錄。
     */
    if (!$el.length) return;
    const { op = null, skipUndo = false } = normalizeOpts(opts); // 標準化選項
    newVal = Array.isArray(newVal) ? newVal.join('\n') : newVal; // 陣列 自動轉 \n字串
    const curr = $el.val();

    // 滿足以下所有條件時，會執行 pushUndo():
    // 1. `skipUndo` 不為 true (即沒有被明確指示要跳過)。
    // 2. 且 (a) 當前值與新值不同，或者 (b) 提供了一個新的操作類型 (`op`) 且它與上一次的操作類型不同。
    //    這個 `op` 機制是為了防止例如連續打字時，每輸入一個字就產生一筆復原記錄。
    if (!skipUndo && (curr !== newVal || (op && op !== lastOp))) pushUndo(opts);

    // 將新值設定到元素上。
    $el.val(newVal);

    // 如果有提供操作類型，則記錄下來，供下一次呼叫時比對。
    if (op) lastOp = op;
  }
  function setOutput(v, opts) { applyChange($('#outputTextarea'), v, opts); }
  function setInput(v, opts) { applyChange($('#inputTextarea'), v, opts); }
  function setIO(inVal, outVal, opts) {
    applyChange($('#inputTextarea'), inVal, opts);
    const newOpts = typeof opts === 'object' ? { ...opts, skipUndo: true } : { skipUndo: true };
    applyChange($('#outputTextarea'), outVal, newOpts);
  }

  // File reading with encoding
  async function readFilesAsText(files, encoding) {
    const chunks = [];
    for (const f of files) {
      const text = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('讀檔失敗'));
        reader.onload = () => resolve(String(reader.result || ''));
        try { reader.readAsText(f, encoding || 'utf-8'); } catch (e) { reject(e); }
      });
      chunks.push(text);
    }
    return chunks.join('\n\n');
  }
  async function readSelectedFiles(files) {
    if (!files || !files.length) return;
    const encoding = ($('#encodingSelect').val() || 'utf-8').toLowerCase();
    try {
      const text = await readFilesAsText(files, encoding);
      setIO(text, '', { op: 'openFiles' });
    } catch (e) {
      alert((e && e.message) ? e.message : '讀取檔案失敗');
    }
  }

  // Encoding persistence
  function bindEncodingPersistence() {
    const $sel = $('#encodingSelect');
    if (!$sel.length) return;
    try {
      const saved = localStorage.getItem('rovodev_encoding');
      if (saved) $sel.val(saved);
    } catch {}
    $sel.on('change', () => {
      try { localStorage.setItem('rovodev_encoding', $sel.val()); } catch {}
    });
  }

  // Common UI bindings: open file, undo, swap, drag & drop
  function bindCommonUI() {
    bindEncodingPersistence();

    $('#openFileBtn').on('click', () => $('#openFileInput').trigger('click'));
    $('#openFileInput').on('change', e => {
      const files = e.target.files && Array.from(e.target.files);
      readSelectedFiles(files); // 讀檔流程會自行先入棧（由 output(..., true) 觸發）
      e.target.value = ''; // 可重選同一檔案
    });

    $('#undoBtn').on('click', () => {
      if (!undoStack.length) return;
      const prev = undoStack.pop();
      $('#inputTextarea').val(prev.input);
      $('#outputTextarea').val(prev.output);
      updateUndoLabel();
    });

    $('#swapBtn').on('click', () => {
      const inputVal = $('#inputTextarea').val() || '';
      const outputVal = $('#outputTextarea').val() || '';
      setIO(outputVal, inputVal, 'swap');
    });

    $('#nextStepBtn').on('click', () => {
      setInput($('#outputTextarea').val(), 'nextStep');
    });

    // drag & drop onto input area
    const $in = $('#inputTextarea');
    const showDrag = v => $in.toggleClass('drag-over', v);
    $in.on('dragenter dragover dragleave dragend drop', e => {
      e.preventDefault(); e.stopPropagation();
      showDrag(e.type==='dragenter'||e.type==='dragover');
    }).on('drop', async e => {
      const dt = e.originalEvent && e.originalEvent.dataTransfer;
      if (!dt) return;
      if (dt.files && dt.files.length) return readSelectedFiles(Array.from(dt.files));
      const plain = dt.getData && dt.getData('text/plain');
      if (plain) return setIO(plain,'','dropPlain');
      if (dt.items && dt.items.length) for (const item of dt.items) if (item.kind==='string') {
        item.getAsString(str => setIO(str,'','dropPlain')); break;
      }
    });

    updateUndoLabel(); // initial state
  }

  // Common ensure-jieba-ready handler used by both pages
  function ensureJiebaReady() {
    let tries = 100; // wait up to ~10s
    const tick = () => {
      if (typeof global.jieba_cut === 'function') {
        $('#pageTitle').css({ borderColor: '#0F0' });
        if (typeof global.resume_jieba_cut === 'function') {
          try { global.resume_jieba_cut(); } catch (e) { console.warn('resume error', e); }
        }
      } else if (tries-- > 0) {
        setTimeout(tick, 100);
      } else {
        console.warn('Jieba not ready after waiting');
      }
    };
    tick();
  }

  // 簡化的配置管理 (傳統模式)
  function updateOptionStatus(message, type = 'info') {
    const $status = $('#option_status, #excuted_result');
    const colors = { success: 'green', warning: 'orange', error: 'red', info: 'blue' };
    $status.text(message).css('color', colors[type] || 'black');
    
    if (type !== 'error') {
      setTimeout(() => {
        if ($status.text() === message) $status.text('').css('color', '');
      }, 5000);
    }
  }

  // expose
  // 倉頡編碼函數 - 引用 cangjieProcessor.js 的實現（避免重複定義）
  async function loadCangjieDict() {
    // 檢查是否有 cangjieProcessor 實例
    if (global.cangjieProcessor && typeof global.cangjieProcessor.loadCangjieDict === 'function') {
      return await global.cangjieProcessor.loadCangjieDict();
    }
    
    // 降級方案：使用傳統實現（向後相容）
    console.warn('⚠️ cangjieProcessor 未載入，使用降級實現');
    if (global._cjMap) return global._cjMap;
    
    try {
      const resp = await fetch('data/cangjie5.dict.yaml');
      if (!resp.ok) throw new Error('無法讀取 data/cangjie5.dict.yaml');
      const text = await resp.text();
      const lines = text.split(/\r?\n/);
      const map = Object.create(null);
      
      for (const raw of lines) {
        if (!raw) continue;
        const t = raw.trim();
        if (!t || t.startsWith('#')) continue;
        const first = t[0];
        if (first === '-' || /[A-Za-z]/.test(first)) continue;
        
        const parts = raw.split(/\t+/);
        if (parts.length < 2) continue;
        const han = parts[0].trim();
        const code = parts[1].trim();
        const code2 = (parts[2] || '').trim();
        if (!han || !code) continue;
        if (!(han in map)) map[han] = code + (code2 ? ' ' + code2 : '');
      }
      
      global._cjMap = map;
      return map;
    } catch (error) {
      console.error('傳統倉頡載入失敗:', error);
      throw error;
    }
  }
  
  function pickQuick(codeStr) {
    // 引用 cangjieProcessor 的實現
    if (global.cangjieProcessor && typeof global.cangjieProcessor.pickQuick === 'function') {
      return global.cangjieProcessor.pickQuick(codeStr);
    }
    // 降級實現
    const main = (codeStr.split(/\s+/)[0] || '').trim();
    const n = main.length;
    if (!n) return '';
    if (n === 1) return main;
    return main[0] + main[n - 1];
  }
  
  function pickFCJ(codeStr) {
    // 引用 cangjieProcessor 的實現
    if (global.cangjieProcessor && typeof global.cangjieProcessor.pickFCJ === 'function') {
      return global.cangjieProcessor.pickFCJ(codeStr);
    }
    // 降級實現
    const main = (codeStr.split(/\s+/)[0] || '').trim();
    const n = main.length;
    if (!n) return '';
    if (n === 1) return main;
    if (n === 2) return main;
    return main.slice(0, 2) + main[n - 1];
  }
  
  // 簡化版 cjMakeFromText
  async function cjMakeFromText(text, mode = 'fcj', opts = {}) {
    //console.warn('🔄 使用傳統編碼生成，建議升級到 v2.0 模組系統');
    const map = await loadCangjieDict();
    const lines = String(text || '').split(/\r?\n/);
    const out = [];
    const seen = new Set();
    const seenFCJ = new Set();
    
    const { append3AtEnd = false, charLengthFilter = () => true, showCount = false, separator = ' ' } = opts;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const match = trimmed.match(/^[\u4e00-\u9fff]+/);
      if (!match) continue;
      
      const phrase = match[0];
      const chars = phrase.split('');
      if (!charLengthFilter(chars.length)) continue;
      
      // 簡化處理邏輯
      if (mode === 'quick') {
        for (const han of chars) {
          const code = map[han];
          if (!code) continue;
          const newCode = pickQuick(code);
          if (!newCode) continue;
          const key = han + '\u0001' + newCode;
          if (!seen.has(key)) {
            seen.add(key);
            out.push(`${han}${separator}${newCode}`);
          }
        }
      } else if (mode === 'fcj') {
        if (chars.length === 1) {
          const han = chars[0];
          const code = map[han];
          if (code) {
            const mainCode = pickFCJ(code);
            if (mainCode && !seenFCJ.has(`${han}${separator}${mainCode}`)) {
              out.push(`${han}${separator}${mainCode}`);
              seenFCJ.add(`${han}${separator}${mainCode}`);
            }
          }
        } else {
          let composed = '';
          let allOk = true;
          for (const han of chars) {
            const code = map[han];
            if (!code) { allOk = false; break; }
            const piece = pickQuick(code);
            if (!piece) { allOk = false; break; }
            composed += piece;
          }
          if (allOk && composed && !seenFCJ.has(`${phrase}${separator}${composed}`)) {
            out.push(`${phrase}${separator}${composed}`);
            seenFCJ.add(`${phrase}${separator}${composed}`);
          }
        }
      }
    }
    
    return out.join('\n');
  }

  // 簡化的API暴露 (傳統模式)
  const api = {
    undoStack, UNDO_MAX, updateUndoLabel, pushUndo,
    readFilesAsText, bindEncodingPersistence, bindCommonUI,
    ensureJiebaReady, updateOptionStatus,
    cjMakeFromText, loadCangjieDict, pickQuick, pickFCJ
  };
  
  global.FcjUtils = api;
  global.setOutput = setOutput;
  global.setInput = setInput;
  global.setIO = setIO;
  global.readSelectedFiles = readSelectedFiles;

  // 自動初始化
  $(bindCommonUI);
  $(ensureJiebaReady);

  // 輕量相容層：當檢測到現代模組系統時載入
  const RIME_BASE_STORAGE_KEY = 'global_rime_base';
  const RIME_BASE_DEFAULT = 3;
  let currentRimeBase = null;
  let lastPositiveRimeBase = RIME_BASE_DEFAULT;
  const rimeBaseListeners = new Set();
  const boundRimeBaseInputs = new Map();

  function sanitizeRimeBase(value) {
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0) return 0;
      return Math.floor(value);
    }
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
  }

  function readStoredRimeBase() {
    let stored = null;
    try {
      const raw = localStorage.getItem(RIME_BASE_STORAGE_KEY);
      if (raw !== null) {
        stored = sanitizeRimeBase(raw);
      } else {
        const wordsConfigRaw = localStorage.getItem('rovodev_words_config');
        if (wordsConfigRaw) {
          try {
            const wordsConfig = JSON.parse(wordsConfigRaw);
            if (wordsConfig && wordsConfig.rimeBase !== undefined) {
              stored = sanitizeRimeBase(wordsConfig.rimeBase);
            }
          } catch (_) {}
        }
        if (stored === null) {
          const dictBaseRaw = localStorage.getItem('dict_maker.rimeBase');
          if (dictBaseRaw !== null) stored = sanitizeRimeBase(dictBaseRaw);
        }
        if (stored === null) {
          const countOptRaw = localStorage.getItem('dict_maker.countOpt');
          if (countOptRaw !== null) {
            try {
              const parsed = JSON.parse(countOptRaw);
              if (parsed === true || parsed === '1') stored = RIME_BASE_DEFAULT;
              else if (parsed === false || parsed === '0') stored = 0;
            } catch (_) {}
          }
        }
      }
    } catch (_) {
      stored = null;
    }
    if (stored === null) stored = RIME_BASE_DEFAULT;
    return stored;
  }

  function persistRimeBase(value) {
    try {
      localStorage.setItem(RIME_BASE_STORAGE_KEY, String(value));
      localStorage.setItem('dict_maker.rimeBase', String(value));
    } catch (_) {}
  }

  function notifyRimeBaseChange(value) {
    rimeBaseListeners.forEach(listener => {
      try {
        listener(value);
      } catch (err) {
        console.warn('RimeBaseManager listener error:', err);
      }
    });
  }

  function updateBoundRimeBaseInputs(value) {
    boundRimeBaseInputs.forEach(($input, element) => {
      if (!element || !document.contains(element)) {
        boundRimeBaseInputs.delete(element);
        return;
      }
      $input.val(value);
    });
  }

  const RimeBaseManager = {
    getDefault() {
      return RIME_BASE_DEFAULT;
    },
    getBase() {
      if (currentRimeBase === null) {
        currentRimeBase = readStoredRimeBase();
        if (currentRimeBase > 0) lastPositiveRimeBase = currentRimeBase;
      }
      return currentRimeBase;
    },
    setBase(value, options = {}) {
      const sanitized = sanitizeRimeBase(value);
      if (currentRimeBase === null) {
        currentRimeBase = this.getBase();
      }
      if (sanitized === currentRimeBase) return currentRimeBase;
      currentRimeBase = sanitized;
      if (sanitized > 0) {
        lastPositiveRimeBase = sanitized;
      }
      persistRimeBase(currentRimeBase);
      updateBoundRimeBaseInputs(currentRimeBase);
      if (!options.silent) {
        notifyRimeBaseChange(currentRimeBase);
      }
      return currentRimeBase;
    },
    primeBase(value) {
      if (currentRimeBase === null) {
        this.setBase(value, { silent: true });
      }
    },
    getLastPositiveBase() {
      return lastPositiveRimeBase;
    },
    onChange(callback, { immediate = true } = {}) {
      if (typeof callback !== 'function') return () => {};
      rimeBaseListeners.add(callback);
      if (immediate) {
        try {
          callback(this.getBase());
        } catch (err) {
          console.warn('RimeBaseManager listener init error:', err);
        }
      }
      return () => rimeBaseListeners.delete(callback);
    },
    bindInput(selector, options = {}) {
      if (typeof jQuery === 'undefined') return;
      const $input = $(selector);
      if (!$input.length) return;
      const element = $input[0];
      boundRimeBaseInputs.set(element, $input);
      $input.val(this.getBase());
      const handleInput = () => {
        const raw = $input.val();
        const sanitized = sanitizeRimeBase(raw);
        this.setBase(sanitized);
      };
      $input.off('input.rimeBase change.rimeBase').on('input.rimeBase change.rimeBase', handleInput);
      if (options.onChange) {
        this.onChange(options.onChange);
      }
    },
    applyBaseToText(text, baseValue, fallbackValue = 1) {
      const base = sanitizeRimeBase(
        baseValue === undefined || baseValue === null ? this.getBase() : baseValue
      );
      const baseEnabled = base > 0;
      const lines = String(text || '')
        .split(/\r?\n/)
        .map(line => line.trim());
      const processed = [];
      let total = 0;

      for (const line of lines) {
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
        if (!baseEnabled) {
          processed.push(word);
          continue;
        }
        const rawCount = match[2] ? parseInt(match[2], 10) : NaN;
        const normalized = Number.isFinite(rawCount) && rawCount > 0 ? rawCount : fallbackValue;
        const finalCount = normalized + base;
        processed.push(`${word} ${finalCount}`);
      }

      return {
        text: processed.join('\n'),
        total,
        base
      };
    }
  };

  global.RimeBaseManager = RimeBaseManager;

  function loadCompatibilityLayer() {
    console.log('🔄 載入輕量相容層...');
    
    // 延遲載入相容層，確保模組系統已就緒
    $(async function() {
      try {
        // 獲取現代模組實例
        const ui = await ModuleSystem.get('ui');
        const config = await ModuleSystem.get('config');
        const cangjie = await ModuleSystem.get('cangjie');
        
        // 提供向後相容的全域函數
        global.setOutput = ui.setOutput.bind(ui);
        global.setInput = ui.setInput.bind(ui);
        global.setIO = ui.setInputOutput.bind(ui);
        global.readSelectedFiles = ui.handleFiles.bind(ui);
        
        // 提供簡化的 FcjUtils，整合倉頡模組
        global.FcjUtils = {
          updateOptionStatus: ui.showStatus.bind(ui),
          // 整合倉頡編碼生成函式
          cjMakeFromText: async (text, mode, opts) => {
            const result = await cangjie.generateCodes(text, mode, opts);
            // 現代模組返回物件格式 { output, stats }，需要向後相容
            return typeof result === 'object' && result.output ? result.output : result;
          },
          loadCangjieDict: () => cangjie.loadDict(),
          pickQuick: (code) => cangjie.pickQuick(code),
          pickFCJ: (code) => cangjie.pickFCJ(code)
        };
        
        console.log('✅ 輕量相容層載入完成（含倉頡整合）');
        
      } catch (error) {
        console.warn('⚠️ 相容層載入失敗，保持傳統模式:', error);
      }
    });
  }

})(window);
