// Shared utilities for words.html and dictMaker.html
// Requires jQuery (slim is fine)
(function(global){
  'use strict';

  // Undo stack for #inputTextarea and #outputTextarea
  const undoStack = [];
  const UNDO_MAX = 100;

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

  // ----- Config Management -----
  let _configCache = null;
  
  async function loadWordConfig() {
    if (_configCache) return _configCache;
    
    let serverConfig = null;
    let localConfigData = null;
    
    // 嘗試從伺服器載入配置
    try {
      const resp = await fetch('config/word_config.json');
      if (resp.ok) {
        serverConfig = await resp.json();
        console.log('伺服器配置載入成功');
      } else {
        throw new Error(`無法讀取配置檔案: ${resp.status}`);
      }
    } catch (error) {
      console.warn('載入伺服器配置失敗:', error.message);
    }
    
    // 嘗試從 LocalStorage 載入配置
    localConfigData = loadConfigFromLocalStorage();
    
    // 決定使用哪個配置
    if (serverConfig && localConfigData) {
      // 伺服器和本地都有配置，比較時間戳決定使用哪個
      const serverTime = new Date(serverConfig.lastModified || 0).getTime();
      const localTime = localConfigData.timestamp || 0;
      
      if (localTime > serverTime) {
        console.log('使用本地配置（較新）');
        _configCache = localConfigData.config;
        updateOptionStatus('使用本地配置（較新版本）', 'info');
      } else {
        console.log('使用伺服器配置');
        _configCache = serverConfig;
        // 同步到本地
        saveConfigToLocalStorage();
      }
    } else if (serverConfig) {
      console.log('使用伺服器配置');
      _configCache = serverConfig;
      // 備份到本地
      saveConfigToLocalStorage();
    } else if (localConfigData) {
      console.log('使用本地配置（離線模式）');
      _configCache = localConfigData.config;
      updateOptionStatus('使用本地配置（離線模式）', 'warning');
    } else {
      console.warn('使用預設配置');
      // 返回基本的預設配置
      _configCache = {
        encoding: { default: "utf-8" },
        sortOrder: { default: "count" },
        freeCj: { 
          limit5Chars: true,
          includeSingleChar: true,
          includeWordGroup: true
        },
        buttons: {},
        ui: { pageTitle: "斷詞整理器" }
      };
      // 保存預設配置到本地
      saveConfigToLocalStorage();
      updateOptionStatus('使用預設配置', 'info');
    }
    
    return _configCache;
  }
  
  function getConfigValue(path, defaultValue = null) {
    if (!_configCache) {
      console.warn('配置尚未載入，請先呼叫 loadWordConfig()');
      return defaultValue;
    }
    
    const keys = path.split('.');
    let current = _configCache;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }
    
    return current;
  }
  
  function setConfigValue(path, value) {
    if (!_configCache) {
      console.warn('配置尚未載入，請先呼叫 loadWordConfig()');
      return false;
    }
    
    const keys = path.split('.');
    const lastKey = keys.pop();
    let current = _configCache;
    
    for (const key of keys) {
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[lastKey] = value;
    return true;
  }
  
  // LocalStorage 配置管理
  const LOCAL_CONFIG_KEY = 'rovodev_word_config';
  const LOCAL_CONFIG_VERSION_KEY = 'rovodev_word_config_version';
  const SERVER_SUPPORT_KEY = 'rovodev_server_support';
  
  // 伺服器支援狀態追蹤
  let _serverSupport = null; // null=未知, true=支援, false=不支援
  
  function saveConfigToLocalStorage() {
    if (!_configCache) return false;
    
    try {
      const configStr = JSON.stringify(_configCache);
      const timestamp = Date.now();
      
      localStorage.setItem(LOCAL_CONFIG_KEY, configStr);
      localStorage.setItem(LOCAL_CONFIG_VERSION_KEY, timestamp.toString());
      
      console.log('配置已保存到 LocalStorage');
      return true;
    } catch (error) {
      console.warn('保存配置到 LocalStorage 失敗:', error.message);
      return false;
    }
  }
  
  function loadConfigFromLocalStorage() {
    try {
      const configStr = localStorage.getItem(LOCAL_CONFIG_KEY);
      if (!configStr) return null;
      
      const config = JSON.parse(configStr);
      const timestamp = localStorage.getItem(LOCAL_CONFIG_VERSION_KEY);
      
      return {
        config,
        timestamp: timestamp ? parseInt(timestamp) : 0
      };
    } catch (error) {
      console.warn('從 LocalStorage 讀取配置失敗:', error.message);
      return null;
    }
  }
  
  function clearLocalStorageConfig() {
    localStorage.removeItem(LOCAL_CONFIG_KEY);
    localStorage.removeItem(LOCAL_CONFIG_VERSION_KEY);
    console.log('LocalStorage 配置已清除');
  }
  
  // 檢查伺服器是否支援寫入
  function getServerSupport() {
    if (_serverSupport !== null) return _serverSupport;
    
    try {
      const saved = localStorage.getItem(SERVER_SUPPORT_KEY);
      if (saved !== null) {
        _serverSupport = saved === 'true';
        return _serverSupport;
      }
    } catch {}
    
    return null; // 未知狀態
  }
  
  function setServerSupport(supported) {
    _serverSupport = supported;
    try {
      localStorage.setItem(SERVER_SUPPORT_KEY, supported.toString());
    } catch {}
  }
  
  // 保存配置（伺服器 + LocalStorage）
  async function saveWordConfig(forceServerTry = false) {
    if (!_configCache) {
      console.warn('無配置可保存');
      return false;
    }
    
    // 先保存到 LocalStorage（總是成功）
    const localSaved = saveConfigToLocalStorage();
    
    // 檢查是否應該嘗試保存到伺服器
    const serverSupport = getServerSupport();
    if (!forceServerTry && serverSupport === false) {
      // 已知伺服器不支援，跳過嘗試
      if (localSaved) {
        updateOptionStatus('配置已保存到本地（靜態伺服器）', 'info');
      }
      return true; // 本地保存成功就算成功
    }
    
    // 嘗試保存到伺服器
    try {
      const response = await fetch('config/word_config.json', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(_configCache, null, 2)
      });
      
      if (!response.ok) {
        // 記錄伺服器不支援（404, 405 等）
        if (response.status === 404 || response.status === 405 || response.status === 501) {
          setServerSupport(false);
          if (localSaved) {
            updateOptionStatus('偵測到靜態伺服器，配置將只保存到本地', 'info');
          }
          return true;
        }
        throw new Error(`保存失敗: ${response.status}`);
      }
      
      // 成功保存到伺服器
      setServerSupport(true);
      updateOptionStatus('配置已保存（伺服器+本地）', 'success');
      return true;
    } catch (error) {
      console.warn('保存配置到伺服器失敗:', error.message);
      
      // 如果是網路錯誤，不要記錄為不支援
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        if (localSaved) {
          updateOptionStatus('配置已保存到本地（網路錯誤）', 'warning');
        }
      } else {
        // 其他錯誤可能是伺服器不支援
        setServerSupport(false);
        if (localSaved) {
          updateOptionStatus('配置已保存到本地（伺服器不支援）', 'warning');
        }
      }
      
      return localSaved;
    }
  }
  
  // 更新狀態顯示
  function updateOptionStatus(message, type = 'info') {
    const $status = $('#option_status');
    const colors = {
      success: 'green',
      warning: 'orange', 
      error: 'red',
      info: 'blue'
    };
    
    $status.text(message).css('color', colors[type] || 'black');
    
    // 5秒後清除狀態（除非是錯誤訊息）
    if (type !== 'error') {
      setTimeout(() => {
        if ($status.text() === message) {
          $status.text('').css('color', '');
        }
      }, 5000);
    }
  }
  
  // 綁定配置變更事件
  function bindConfigChangeEvents() {
    // encoding 變更
    $('#encodingSelect').on('change', function() {
      const value = $(this).val();
      setConfigValue('encoding.default', value);
      saveWordConfig();
    });
    
    // sortOrder 變更  
    $('#sortOrderSelect').on('change', function() {
      const value = $(this).val();
      setConfigValue('sortOrder.default', value);
      saveWordConfig();
    });
    
    // textFilter 變更
    $('#textFilterSelect').on('change', function() {
      const value = $(this).val();
      setConfigValue('textFilter.default', value);
      saveWordConfig();
    });
    
    // freeCj 相關 checkbox 變更
    $('#freeCjLimit5Checkbox').on('change', function() {
      const value = $(this).is(':checked');
      setConfigValue('freeCj.limit5Chars', value);
      saveWordConfig();
    });
    
    $('#freeCjSingleCharCheckbox').on('change', function() {
      const value = $(this).is(':checked');
      setConfigValue('freeCj.includeSingleChar', value);
      saveWordConfig();
    });
    
    $('#freeCjWordGroupCheckbox').on('change', function() {
      const value = $(this).is(':checked');
      setConfigValue('freeCj.includeWordGroup', value);
      saveWordConfig();
    });
    
    // 偵測在線/離線狀態變化
    window.addEventListener('online', function() {
      const serverSupport = getServerSupport();
      
      if (serverSupport === false) {
        // 已知是靜態伺服器，不嘗試同步
        updateOptionStatus('網路已恢復（靜態伺服器模式）', 'info');
      } else if (_configCache) {
        // 未知或支援寫入的伺服器，嘗試同步
        updateOptionStatus('網路已恢復，嘗試同步配置...', 'info');
        setTimeout(() => {
          saveWordConfig(true); // forceServerTry = true
        }, 1000);
      }
    });
    
    window.addEventListener('offline', function() {
      updateOptionStatus('網路斷線，配置將保存到本地', 'warning');
    });
  }
  
  // 重置配置到預設值
  function resetWordConfig() {
    const defaultConfig = {
      encoding: { 
        default: "utf-8",
        options: ["utf-8", "big5", "gbk", "gb18030", "shift_jis", "utf-16le", "utf-16be"]
      },
      sortOrder: { 
        default: "count",
        options: ["count", "alpha"]
      },
      freeCj: { 
        limit5Chars: true,
        includeSingleChar: true,
        includeWordGroup: true
      },
      fileInput: {
        acceptTypes: ".txt,.md,.csv,.json,.log,.xml,.html,.htm,text/*",
        multiple: true
      },
      ui: { 
        pageTitle: "🤘斷詞整理器🤘",
        inputPlaceholder: "請在此輸入文字..."
      }
    };
    
    _configCache = defaultConfig;
    clearLocalStorageConfig();
    saveWordConfig();
    applyConfigToUI();
    updateOptionStatus('配置已重置為預設值', 'success');
  }
  
  // 應用配置到UI元素
  async function applyConfigToUI() {
    const config = await loadWordConfig();
    
    // 設定預設編碼
    const defaultEncoding = getConfigValue('encoding.default');
    if (defaultEncoding) {
      $('#encodingSelect').val(defaultEncoding);
    }
    
    // 設定預設排序方式
    const defaultSort = getConfigValue('sortOrder.default');
    if (defaultSort) {
      $('#sortOrderSelect').val(defaultSort);
    }
    
    // 設定預設文字過濾方式
    const defaultTextFilter = getConfigValue('textFilter.default');
    if (defaultTextFilter) {
      $('#textFilterSelect').val(defaultTextFilter);
    }
    
    // 設定頁面標題
    const pageTitle = getConfigValue('ui.pageTitle');
    if (pageTitle) {
      $('#pageTitle').text(pageTitle);
    }
    
    // 設定輸入框提示文字
    const inputPlaceholder = getConfigValue('ui.inputPlaceholder');
    if (inputPlaceholder) {
      $('#inputTextarea').attr('placeholder', inputPlaceholder);
    }
    
    // 設定按鈕文字和狀態
    const buttons = getConfigValue('buttons', {});
    Object.keys(buttons).forEach(buttonKey => {
      const buttonConfig = buttons[buttonKey];
      const buttonId = buttonKey === 'jiebaCustom' ? 'jiebaCustomBtn' : 
                       buttonKey === 'punctuationSortCount' ? 'punctuationSortCountBtn' :
                       buttonKey === 'pureEn' ? 'pureEnBtn' :
                       buttonKey === 'nextStep' ? 'nextStepBtn' :
                       buttonKey === 'openFile' ? 'openFileBtn' :
                       `${buttonKey}Btn`;
      
      const $button = $(`#${buttonId}`);
      if ($button.length && buttonConfig) {
        if (buttonConfig.text) $button.text(buttonConfig.text);
        if (buttonConfig.enabled !== undefined) $button.prop('disabled', !buttonConfig.enabled);
        if (buttonConfig.display !== undefined) $button.toggle(buttonConfig.display);
      }
    });
    
    // 設定 freeCj 相關預設值
    const freeCjLimit = getConfigValue('freeCj.limit5Chars');
    if (freeCjLimit !== null) {
      $('#freeCjLimit5Checkbox').prop('checked', freeCjLimit);
    }
    
    const freeCjSingleChar = getConfigValue('freeCj.includeSingleChar');
    if (freeCjSingleChar !== null) {
      $('#freeCjSingleCharCheckbox').prop('checked', freeCjSingleChar);
    }
    
    const freeCjWordGroup = getConfigValue('freeCj.includeWordGroup');
    if (freeCjWordGroup !== null) {
      $('#freeCjWordGroupCheckbox').prop('checked', freeCjWordGroup);
    }
    
    console.log('配置已應用到UI');
  }

  // expose
  // ----- Cangjie helpers (shared with dictMaker and words freeCj) -----
  async function loadCangjieDict() {
    if (global._cjMap) return global._cjMap;
    const resp = await fetch('data/cangjie5.dict.yaml');
    if (!resp.ok) throw new Error('無法讀取 data/cangjie5.dict.yaml');
    const text = await resp.text();
    const lines = text.split(/\r?\n/);
    const map = Object.create(null);
    for (let i=0; i<lines.length; i++) {
      const raw = lines[i];
      if (!raw) continue;
      const t = raw.trim();
      if (!t) continue;
      if (t.startsWith('#')) continue; // 註解
      const first = t[0];
      if (first === '-' || /[A-Za-z]/.test(first)) continue; // 忽略以 - 或英文字母開頭
      // 預期格式：中文字 [tab] 編碼 [tab] 次編碼(可能無)
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
  }
  function pickQuick(codeStr) {
    const main = (codeStr.split(/\s+/)[0] || '').trim();
    const n = main.length;
    if (!n) return '';
    if (n === 1) return main;
    return main[0] + main[n - 1];
  }
  function pickFCJ(codeStr) {
    const main = (codeStr.split(/\s+/)[0] || '').trim();
    const n = main.length;
    if (!n) return '';
    if (n === 1) return main;
    if (n === 2) return main;
    return main.slice(0, 2) + main[n - 1];
  }
  async function cjMakeFromText(text, mode = 'fcj', opts = {}) {
    const map = await loadCangjieDict();
    const lines = String(text || '').split(/\r?\n/);
    const out = [];
    const seen = new Set(); // for quick mode de-dup (han+code)
    const seenFCJ = new Set();
    const pushImmediate = (line) => { if (!seenFCJ.has(line)) { out.push(line); seenFCJ.add(line); } };
    const append3AtEnd = !!opts.append3AtEnd;
    const charLengthFilter = opts.charLengthFilter || (() => true);
    const showCount = !!opts.showCount;
    const separator = opts.separator || ' ';
    const delayed3 = [];
    
    console.log('cjMakeFromText debug:', {mode, opts, showCount, separator});

    for (let i=0; i<lines.length; i++) {
      const line = (lines[i]||'').trim();
      if (!line) continue;
      const m = line.match(/^[\u4e00-\u9fff]+/); // 前綴中文詞
      if (!m) continue;
      const phrase = m[0];
      const chars = phrase.split('');
      
      // 提取原始計數
      let originalCount = '';
      if (showCount) {
        const countMatch = line.slice(phrase.length).match(/\s+(\d+)/);
        if (countMatch) {
          originalCount = separator + countMatch[1];
        } else {
          originalCount = separator + '3'; // 預設值為 3
        }
      }
      
      if (mode === 'quick') {
        if (!charLengthFilter(chars.length)) continue;
        for (let j=0; j<chars.length; j++) {
          const han = chars[j];
          const code = map[han];
          if (!code) continue;
          const newCode = pickQuick(code);
          if (!newCode) continue;
          const key = han + '\u0001' + newCode;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(`${han}${separator}${newCode}${originalCount}`);
        }
      } else if (mode === 'fcj') {
        if (chars.length === 1) {
          if (!charLengthFilter(chars.length)) continue;
          
          const han = chars[0];
          const code = map[han];
          if (!code) continue;
          const mainCode = pickFCJ(code);
          if (!mainCode) continue;
          let freq = 0;
          const mf = line.slice(phrase.length).match(/\s+(\d+)/);
          if (mf) { const t = parseInt(mf[1], 10); if (Number.isFinite(t)) freq = t; }
          if (freq > 1000 && mainCode.length === 3) {
            if (append3AtEnd) {
              delayed3.push(`${han}${separator}${mainCode}${originalCount}`);
              pushImmediate(`${han}${separator}${mainCode[0]}${mainCode[mainCode.length-1]}${originalCount}`);
            } else {
              pushImmediate(`${han}${separator}${mainCode}${originalCount}`);
            }
          } else {
            pushImmediate(`${han}${separator}${mainCode}${originalCount}`);
          }
        } else {
          if (!charLengthFilter(chars.length)) continue;
          
          let composed = '';
          let allOk = true;
          for (let j=0; j<chars.length; j++) {
            const han = chars[j];
            const code = map[han];
            if (!code) { allOk = false; break; }
            const piece = pickQuick(code);
            if (!piece) { allOk = false; break; }
            composed += piece;
          }
          if (allOk && composed) pushImmediate(`${phrase}${separator}${composed}${originalCount}`);
        }
      }
    }
    if (append3AtEnd && delayed3.length) {
      const toDelete = new Set(delayed3);
      for (let k = out.length - 1; k >= 0; k--) {
        if (toDelete.has(out[k])) out.splice(k, 1);
      }
      out.push(...delayed3);
    }
    return out.join('\n');
  }

  const api = {
    undoStack, UNDO_MAX,
    updateUndoLabel, pushUndo,
     readFilesAsText,
    bindEncodingPersistence, bindCommonUI,
    ensureJiebaReady,
    // Cangjie
    loadCangjieDict, pickQuick, pickFCJ, cjMakeFromText,
    // Config Management
    loadWordConfig, getConfigValue, setConfigValue, applyConfigToUI, saveWordConfig, updateOptionStatus, bindConfigChangeEvents,
    saveConfigToLocalStorage, loadConfigFromLocalStorage, clearLocalStorageConfig, resetWordConfig,
  };
  global.FcjUtils = api;
  // legacy globals for existing code
  global.setOutput = setOutput;
  global.setInput = setInput;
  global.setIO = setIO;
  global.readSelectedFiles = readSelectedFiles;

  // auto-bind on DOM ready
  $(bindCommonUI);

  // auto ensure jieba (harmless if not present)
  $(ensureJiebaReady);

  // auto-apply config when DOM is ready
  $(applyConfigToUI);
  
  // auto-bind config change events when DOM is ready
  $(bindConfigChangeEvents);

})(window);
