// words.js - page-specific logic (shared utilities moved to scripts/utils.js)

// Modal logic
function openCustomDictModal() {
  let stored = localStorage.getItem('rovodev_custom_dict');
  let defaultDict;
  try { defaultDict = stored ? JSON.parse(stored) : null; } catch (_) { defaultDict = null; }
  if (!Array.isArray(defaultDict)) {
    defaultDict = [["繪製",99999999,"p"],["去重",777777,"n"],["幫我",666666,"n"]];
  }
  $('#customDictInput').val(JSON.stringify(defaultDict,null,2));
  $('#customDictError').text('');
  $('#rovodevModalBackdrop').show();
  $('#rovodevCustomDictModal').css('display','flex');
  setTimeout(() => $('#customDictInput').focus(), 0);
}
function closeCustomDictModal() {
  $('#rovodevModalBackdrop, #rovodevCustomDictModal').hide();
}

// jieba check
function checkJieba() {
  const ok = typeof call_jieba_cut !== 'undefined';
  if (!ok) setResultStatus('Jieba 斷詞函式未載入，請稍候。', 'warning');
  return ok;
}

function getSourceText() {
  let txt = ($('#sourceSelect').val() === 'output') ? $('#outputTextarea').val() : $('#inputTextarea').val()
  txt = txt.trim();
  const noteStr = '缺少執行的來源';
  const noteEl = $('#excuted_result');
  const noteTxt = noteEl.text();
  if (!txt) noteEl.text(noteStr).css('color','red');
  else noteEl.text( noteTxt.replaceAll(noteStr,'') ); // 清除
  return txt;
}

function langFiltering(txt, regex, keep_tail_num) {
  // 語言過濾 + 符號斷詞
  // 只要沒設定 regex 就依照語言選項過濾, 相當於 [基本標點符號斷詞]
  if (regex === ' ') return txt;

  const zh = '\u4e00-\u9fff'; // 中文字符（擴展）
  const jp = '\u3040-\u309f\u30a0-\u30ff'; // 日文平假名 + 片假名
  const kr = '\uac00-\ud7af'; // 韓文
  const en = 'a-zA-Z'; // 英文
  if (!regex) {
    const filterType = $('#langFilterSelect').val();
    let pattern;
    switch (filterType) {
      case 'all': // 全部（中、日、韓、英）
        pattern = `${zh}${jp}${kr}${en}`;
        break;
      case 'cjk': // 中日韓
        pattern = `${zh}${jp}${kr}`;
        break;
      case 'zh': // 純中文
        pattern = zh;
        break;
      case 'en': // 純英文
        pattern = en;
        break;
      default: // 預設：中 + 英
        pattern = `${zh}${en}`;
    }
    regex = new RegExp(`[^${pattern}]`, 'g');
    console.log('langFiltering - filterType:', filterType, 'pattern:', pattern, 'regex:', regex);
  }
  // 保護行尾數字 (用於計數) 
  if (keep_tail_num) {
    regex = new RegExp(`(?!\\s*\\d+\\s*$)${regex.source}`, 'gm');
  }
  const result = txt.replace(regex,' '); // 基本過濾 (用空白吃掉雜訊)
  console.log('langFiltering - input:', txt.substring(0, 50), 'output:', result.substring(0, 50));
  return result;
}

// 新的去重複邏輯，支援行尾數字統計
function dedupWithTailNumber(arr) {
  const countMap = new Map(); // 儲存 {內容: 總次數}
  
  arr.forEach(line => {
    // 檢查行尾是否有數字
    const match = line.match(/^(.+?)\s+(\d+)$/);
    if (match) {
      const [, content, count] = match;
      const num = parseInt(count, 10);
      countMap.set(content, (countMap.get(content) || 0) + num);
    } else {
      // 沒有行尾數字，視為出現1次
      countMap.set(line, (countMap.get(line) || 0) + 1);
    }
  });
  
  // 根據需求決定輸出格式
  return Array.from(countMap.entries()).map(([content, count]) => 
    count > 1 ? `${content} ${count}` : content
  );
}

// 為 words.html 提供統一的字數過濾器
function getUnifiedCharLengthFilter() {
  // 檢查是否有統一的字數選項組件
  if (typeof CharLengthOptions !== 'undefined' && CharLengthOptions.getFilter) {
    try {
      return CharLengthOptions.getFilter();
    } catch (e) {
      console.warn('使用統一字數過濾器失敗，回退到舊邏輯:', e);
    }
  }
  
  // 回退邏輯：支援新的詳細字數選項
  const checkBox = (id) => {
    const $el = $(id);
    return $el.length ? $el.is(':checked') : true;
  };
  
  return function(charLength) {
    if (charLength === 1) return checkBox('#freeCjSingleCharCheckbox');
    if (charLength === 2) return checkBox('#freeCj2charCheckbox');
    if (charLength === 3) return checkBox('#freeCj3charCheckbox');
    if (charLength === 4) return checkBox('#freeCj4charCheckbox');
    if (charLength >= 5) return checkBox('#freeCj5pluscharCheckbox');
    return true; // 預設不受限
  };
}

function prepare(returnType = '',regex = '') {
  let originalText = getSourceText();
  if (!originalText) return ''; // 空無目標早退
  console.log('prepare → returnType:', returnType);
  
  keep_tail_num = returnType.includes('+num');
  originalText = langFiltering(originalText,regex, keep_tail_num ); // 語言過濾 + 符號斷詞
  if (keep_tail_num && !returnType.includes('dedup')) return originalText; // 保護行尾數字時且不去重複時, 早退
  // originalText = originalText.replace(/([\u4e00-\u9fa5])([a-zA-Z])/g, '$1 $2').replace(/([a-zA-Z])([\u4e00-\u9fa5])/g, '$1 $2') // 分開中英文 -- 不必, 因為 jieba 會做

  const arr_no_empty_wraplines = originalText.split(/\s+/).filter(Boolean); // 空白即換行 & 去空行 的陣列
  let prepared = arr_no_empty_wraplines;
  
  if (returnType.includes('dedup')) {
    if (returnType.includes('+num') || returnType.includes('+count')) {
      // 含計數的智能去重複邏輯
      prepared = dedupWithTailNumber(arr_no_empty_wraplines);
    } else {
      // 簡易去重複
      prepared = [...new Set(arr_no_empty_wraplines)];
    }
  }
  
  // 字數篩選邏輯：根據勾選的字數選項過濾結果
  if (returnType.includes('charFilter') || returnType === 'dedup' || returnType === '[]') {
    const charLengthFilter = getUnifiedCharLengthFilter();
    prepared = prepared.filter(word => {
      // 提取純中文字符長度（忽略行尾數字）
      const cleanWord = word.replace(/\s+\d+$/, ''); // 移除行尾數字
      const chineseLength = cleanWord.replace(/[^\u4e00-\u9fff]/g, '').length;
      
      // 如果沒有中文字符，保留（可能是英文詞彙）
      if (chineseLength === 0) {
        return charLengthFilter(cleanWord.length);
      }
      
      return charLengthFilter(chineseLength);
    });
  }
  
  if (returnType.includes('[]')) return prepared;
  return prepared.join('\n'); // str\n : 陣列用\n轉為換行的 --> 單字串
}
function getRimeBase() {
  if (typeof RimeBaseManager !== 'undefined') {
    return RimeBaseManager.getBase();
  }
  const parsed = parseInt($('#rimeBaseInput').val(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 3;
}

function setResultStatus(message, type = 'info', timeout = 5000) {
  const $status = $('#excuted_result');
  if (!$status.length) return;
  const colors = { success: 'green', warning: 'orange', error: 'red', info: 'blue' };
  const text = message || '';
  $status.text(text).css('color', colors[type] || '');

  if (timeout && type !== 'error') {
    setTimeout(() => {
      if ($status.text() === text) {
        $status.text('').css('color', '');
      }
    }, timeout);
  }
}

function normalizeRimeEntries(base) {
  const prepared = prepare('dedup+num');
  if (!prepared) return { payload: '', total: 0, base };
  if (typeof RimeBaseManager === 'undefined') {
    const lines = prepared.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    return { payload: lines.join('\n'), total: lines.length, base };
  }
  const result = RimeBaseManager.applyBaseToText(prepared, base, 1);
  return {
    payload: result.text,
    total: result.total,
    base: result.base
  };
}

async function createRimeLines(payload, base, total) {
  if (!payload || !total) return { lines: [], total: 0 };
  if (typeof FcjUtils === 'undefined' || typeof FcjUtils.cjMakeFromText !== 'function') {
    throw new Error('倉頡模組尚未載入');
  }

  const freeCjLimitAttr = parseInt($('#freeCjLimitSelect').data('default-limit'), 10);
  const freeCjLimit = getWordsFreeCjLimit(Number.isFinite(freeCjLimitAttr) ? freeCjLimitAttr : 0);
  const baseEnabled = base > 0;
  const options = {
    rootOrder: 'after',
    separator: '\t',
    showCount: baseEnabled,
    charLengthFilter: getUnifiedCharLengthFilter(),
    freeCjMaxLength: freeCjLimit
  };

  let raw = await FcjUtils.cjMakeFromText(payload, 'fcj', options);
  if (raw && typeof raw === 'object' && typeof raw.output === 'string') {
    raw = raw.output;
  }
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  return { lines, total };
}

let wordsFreeCjLimitCtrl = null;

function getWordsFreeCjLimit(defaultValue = 0) {
  if (wordsFreeCjLimitCtrl && typeof wordsFreeCjLimitCtrl.getValue === 'function') {
    return wordsFreeCjLimitCtrl.getValue();
  }
  const $select = $('#freeCjLimitSelect');
  if ($select.length) {
    const val = parseInt($select.val(), 10);
    if (Number.isFinite(val) && val >= 0) return val;
  }
  return defaultValue;
}

function setWordsFreeCjLimit(value) {
  if (wordsFreeCjLimitCtrl && typeof wordsFreeCjLimitCtrl.setValue === 'function') {
    wordsFreeCjLimitCtrl.setValue(value);
  } else {
    const $select = $('#freeCjLimitSelect');
    if ($select.length) {
      const val = Number.isFinite(value) ? String(value) : String($select.data('default-limit') || 0);
      $select.val(val);
    }
  }
}

$('#freeCjLimit5Checkbox').prop('checked', Number.isFinite(value) && value >= 5);
function renderOptionStatus() {
  const parts = [];

  const langText = $('#langFilterSelect option:selected').text();
  if (langText) parts.push(`語言:${langText.trim()}`);

  const sortText = $('#sortOrderSelect option:selected').text();
  if (sortText) parts.push(`排序:${sortText.trim()}`);

  const base = getRimeBase();
  if (Number.isFinite(base)) parts.push(`Rime基數:${base}`);

  const lengthStates = [
    ['單', '#freeCjSingleCharCheckbox'],
    ['2字', '#freeCj2charCheckbox'],
    ['3字', '#freeCj3charCheckbox'],
    ['4字', '#freeCj4charCheckbox'],
    ['5+字', '#freeCj5pluscharCheckbox']
  ].map(([label, selector]) => {
    const $el = $(selector);
    return $el.length ? { label, checked: $el.is(':checked') } : null;
  }).filter(Boolean);
  if (lengthStates.length) {
    const enabled = lengthStates.filter(item => item.checked).map(item => item.label);
    if (enabled.length === lengthStates.length) {
      parts.push('freeCj:全部');
    } else if (enabled.length) {
      parts.push(`freeCj:${enabled.join('/')}`);
    } else {
      parts.push('freeCj:未選');
    }
  }

  const defaultLimit = parseInt($('#freeCjLimitSelect').data('default-limit'), 10);
  const limit = getWordsFreeCjLimit(Number.isFinite(defaultLimit) ? defaultLimit : 0);
  parts.push(`字根長度:${limit > 0 ? `<=${limit}` : '不限'}`);

  $('#option_status').text(parts.join(' | '));
}

// Parse custom dict: support JSON array or comma-separated words
function parseCustomDict(input) {
  if (!input) return [];
  const s = String(input).trim();
  // Try JSON first
  try {
    const arr = JSON.parse(s);
    if (Array.isArray(arr)) return arr;
  } catch (_) {}
  // Fallback: comma or whitespace separated tokens -> highest weight words
  const tokens = s.split(/[,\s]+/).map(t=>t.trim()).filter(Boolean);
  return tokens.map(w => [w, 99999999, 'n']);
}

// Config management with localStorage
function loadConfig() {
  try {
    const stored = localStorage.getItem('rovodev_words_config');
    const config = stored ? JSON.parse(stored) : {};
    
    // Load rimeBaseInput
    if (config.rimeBase !== undefined && typeof RimeBaseManager !== 'undefined') {
      RimeBaseManager.primeBase(config.rimeBase);
      RimeBaseManager.setBase(config.rimeBase, { silent: true });
    }
    
    // Load langFilterSelect
    if (config.langFilter !== undefined) {
      $('#langFilterSelect').val(config.langFilter);
    }
    
    // Load encodingSelect
    if (config.encoding !== undefined) {
      $('#encodingSelect').val(config.encoding);
    }
    
    // Load sortOrderSelect
    if (config.sortOrder !== undefined) {
      $('#sortOrderSelect').val(config.sortOrder);
    }
    
    // Load checkbox states
    if (config.freeCjSingleChar !== undefined) {
      $('#freeCjSingleCharCheckbox').prop('checked', config.freeCjSingleChar);
    }

    if (config.freeCjWordGroup !== undefined) {
      const multiChecked = !!config.freeCjWordGroup;
      $('#freeCj2charCheckbox, #freeCj3charCheckbox, #freeCj4charCheckbox, #freeCj5pluscharCheckbox').prop('checked', multiChecked);
    }

    if (config.freeCjLimit !== undefined) {
      setWordsFreeCjLimit(config.freeCjLimit);
    } else if (config.freeCjLimit5 !== undefined) {
      setWordsFreeCjLimit(config.freeCjLimit5 ? 5 : 0);
    } else {
      const defaultLimit = parseInt($('#freeCjLimitSelect').data('default-limit'), 10);
      if (!Number.isNaN(defaultLimit)) {
        setWordsFreeCjLimit(defaultLimit);
      }
    }
    
    return config;
  } catch (e) {
    console.warn('Failed to load config:', e);
    return {};
  }
}

function saveConfig() {
  try {
    const config = {
      rimeBase: typeof RimeBaseManager !== 'undefined' ? RimeBaseManager.getBase() : $('#rimeBaseInput').val(),
      langFilter: $('#langFilterSelect').val(),
      encoding: $('#encodingSelect').val(),
      sortOrder: $('#sortOrderSelect').val(),
      freeCjSingleChar: $('#freeCjSingleCharCheckbox').is(':checked'),
      freeCjWordGroup: $('#freeCj2charCheckbox, #freeCj3charCheckbox, #freeCj4charCheckbox, #freeCj5pluscharCheckbox').filter(':checked').length > 0,
      freeCjLimit: getWordsFreeCjLimit(parseInt($('#freeCjLimitSelect').data('default-limit'), 10) || 0)
    };
    localStorage.setItem('rovodev_words_config', JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save config:', e);
  }
}

// main init (bind only page-specific buttons)
$(() => {
  // 初始化字數選項組件（使用完整的 2字-5字 UI）
  CharLengthOptions.inject('#wordsCharOptions', {
    options: [
      { id: 'freeCjSingleCharCheckbox', label: '單字', length: 1, default: true },
      { id: 'freeCj2charCheckbox', label: '2字', length: 2, default: true },
      { id: 'freeCj3charCheckbox', label: '3字', length: 3, default: true },
      { id: 'freeCj4charCheckbox', label: '4字', length: 4, default: true },
      { id: 'freeCj5pluscharCheckbox', label: '5字以上', length: '5+', default: true }
    ],
    containerClass: 'words-char-options'
  });
  
  if (typeof FreeCjLimitSelector !== 'undefined') {
    const defaultLimit = parseInt($('#freeCjLimitSelect').data('default-limit'), 10);
    wordsFreeCjLimitCtrl = FreeCjLimitSelector.bind('#freeCjLimitSelect', {
      defaultValue: Number.isFinite(defaultLimit) ? defaultLimit : 0
    });
  } else {
    wordsFreeCjLimitCtrl = null;
  }
  
  // Load configuration from localStorage
  loadConfig();
  renderOptionStatus();
  $('#freeCjLimit5Checkbox').prop('checked', getWordsFreeCjLimit(parseInt($('#freeCjLimitSelect').data('default-limit'), 10) || 0) >= 5);
  
  // Highlight correct textarea based on source select
  function updateSourceHighlight() {
    const source = $('#sourceSelect').val();
    $('#inputTextarea, #outputTextarea').removeClass('highlight-red');
    if (source === 'output') {
      $('#outputTextarea').addClass('highlight-red');
    } else {
      $('#inputTextarea').addClass('highlight-red');
    }
  }

  $('#sourceSelect').on('change', updateSourceHighlight);
  updateSourceHighlight(); // Initial call

  // Bind config change events to save to localStorage
  if (typeof RimeBaseManager !== 'undefined') {
    RimeBaseManager.bindInput('#rimeBaseInput', {
      onChange: () => {
        renderOptionStatus();
        saveConfig();
      }
    });
  } else {
    if (typeof RimeBaseManager !== 'undefined') {
    RimeBaseManager.bindInput('#rimeBaseInput', {
      onChange: () => {
        renderOptionStatus();
        saveConfig();
      }
    });
  } else {
    $('#rimeBaseInput').on('input change', () => { saveConfig(); renderOptionStatus(); });
  }
  }
  $('#langFilterSelect').on('change', () => { saveConfig(); renderOptionStatus(); });
  $('#encodingSelect').on('change', () => { saveConfig(); renderOptionStatus(); });
  $('#sortOrderSelect').on('change', () => { saveConfig(); renderOptionStatus(); });
  $('#freeCjLimitSelect').on('change', () => {
    saveConfig();
    renderOptionStatus();
    const currentLimit = getWordsFreeCjLimit(parseInt($('#freeCjLimitSelect').data('default-limit'), 10) || 0);
    $('#freeCjLimit5Checkbox').prop('checked', Number.isFinite(currentLimit) && currentLimit >= 5);
  });
  $('#freeCjLimit5Checkbox').on('change', function() {
    const checked = $(this).is(':checked');
    const target = checked ? 5 : 0;
    setWordsFreeCjLimit(target);
    saveConfig();
    renderOptionStatus();
  });

  // 斷詞
  $('#jiebaBtn').on('click', () => {
    if (!checkJieba()) return;
    const txt = getSourceText();
    if(txt) call_jieba_cut(txt, res => setOutput(res.join(' '), 'jieba'));
  });

  $('#applyCustomDictBtn').on('click', () => {
    $('#customDictError').text('');
    let customDict;
    try {
      customDict = parseCustomDict($('#customDictInput').val());
      if (!customDict.length) throw new Error('自訂詞典為空');
    } catch(e) {
      $('#excuted_result').text('解析失敗：'+e.message).css('color','red');
      return '解析失敗：'+e.message;
    }
    try { localStorage.setItem('rovodev_custom_dict', JSON.stringify(customDict)); } catch {}
    const txt = getSourceText();
    if (!txt) return ; // 空無目標早退

    if (typeof call_jieba_cut !== 'undefined') {
      call_jieba_cut(txt, customDict, tokens => {
        setOutput(tokens.join(' '), 'jiebaCustom');
        closeCustomDictModal();
      });
    } else {
      $('#excuted_result').text('Jieba 斷詞函式未載入。').css('color','blue');
    }
  });
  $('#cancelCustomDictBtn, #rovodevModalBackdrop').on('click', closeCustomDictModal);
  $('#jiebaCustomBtn').on('click', openCustomDictModal);

  // Pime 轉 Rime 格式 = 字根後置
  $('#PimeBtn').on('click', () => {
    const base = parseInt($('#rimeBaseInput').val()) || 3;
    const src = getSourceText();
    setOutput( (src || '')
      .replace(/^([a-z]+) (\S+)/g,'$2\t$1\t'+base)
      .replace(/\n([a-z]+) (\S+)/g,'\n$2\t$1\t'+base) ,'pime'
    );
  });

  // Rime 格式輸出：詞\t碼\t頻
  $('#RimeBtn').on('click', async () => {
    renderOptionStatus();
    const base = getRimeBase();
    try {
      const { payload, total, base: normalizedBase } = normalizeRimeEntries(base);
      if (!total || !payload) {
        setOutput('', 'rime');
        setResultStatus('沒有可輸出的詞條', 'warning');
        return;
      }

      const { lines } = await createRimeLines(payload, normalizedBase, total);
      if (!lines.length) {
        setOutput('', 'rime');
        setResultStatus('倉頡碼尚未就緒或無法為詞條配碼', 'warning');
        return;
      }

      setOutput(lines.join('\n'), 'rime');
      const missing = Math.max(total - lines.length, 0);
      if (missing) {
        setResultStatus(`Rime 輸出完成：${lines.length} 筆，略過 ${missing} 筆無碼詞條`, 'warning');
      } else {
        const statusMessage = normalizedBase > 0
          ? `Rime 輸出完成，共 ${lines.length} 筆條目`
          : `Rime 輸出完成 (不計數)，共 ${lines.length} 筆條目`;
        setResultStatus(statusMessage, 'success');
      }
    } catch (error) {
      console.error('[words] Rime export failed', error);
      setResultStatus('Rime 輸出失敗，請稍後再試。', 'error', 0);
    }
  });
  $('#toDictMakerBtn').on('click', () => {
    const text = $('#inputTextarea').val() || '';
    const trimmed = text.trim();
    const statusEl = $('#excuted_result');
    const storageKey = window.WORDS_TO_DICTMAKER_KEY || 'words_to_dictMaker_payload';
    try {
      if (trimmed) {
        console.log('[words] store transfer payload');
        const payload = { ts: Date.now(), text };
        localStorage.setItem(storageKey, JSON.stringify(payload));
        statusEl.text('已傳送至字典整理器').css('color', '');
      } else {
        console.log('[words] clear transfer payload');
        localStorage.removeItem(storageKey);
        statusEl.text('輸入為空，未送出').css('color', 'red');
        return;
      }
    } catch (e) {
      console.warn('寫入字典整理資料失敗:', e);
      statusEl.text('無法存入瀏覽器，請手動複製').css('color', 'red');
    }
    const win = window.open('dictMaker.html', 'dictMaker');
    console.log('[words] open dictMaker window', !!win);
    if (!win) {
      window.location.href = 'dictMaker.html';
      return;
    }
    if (typeof win.focus === 'function') {
      win.focus();
    }
  });


  // freeCj（快倉編碼），流程：
  // 1) prepare() 過濾雜訊
  // 2) 若 jieba 可用，先斷詞再以換行連接
  // 3) 使用共用的 cjMakeFromText(processedText, 'fcj', opts) 取得快倉編碼
  // freeCj checkbox 驗證和警告
  $('#freeCjBtn').on('click', async () => {
    renderOptionStatus();
    // 檢查 checkbox 狀態
    if (!validateFreeCjCheckboxes()) {
      return;
    }

    const defaultLimitAttr = parseInt($('#freeCjLimitSelect').data('default-limit'), 10);
    const freeCjLimit = getWordsFreeCjLimit(Number.isFinite(defaultLimitAttr) ? defaultLimitAttr : 0);

    let processed = prepare('dedup');
    // 若 jieba 可用先斷詞
    if (checkJieba()) {
      processed = await new Promise(resolve => {
        call_jieba_cut(processed, tokens => resolve(tokens.join('\n')));
      });
    }
    processed = await doFreeCj(processed, 'fcj', { append3AtEnd:true, freeCjMaxLength: freeCjLimit });
    processed = processed.replace(/(.+) ([a-z]+)/g,'$2 $1');

    // 套用字根長度限制
    if (freeCjLimit > 0) {
      const limitRegex = new RegExp(`^([a-z]{${freeCjLimit}})[a-z]+`, 'gm');
      processed = processed.replace(limitRegex, '$1');
    }

    // 依據單字/詞組選項篩除
    // 依據各字數選項篩除
    const lengthStates = new Map([
      [1, $('#freeCjSingleCharCheckbox').is(':checked')],
      [2, $('#freeCj2charCheckbox').is(':checked')],
      [3, $('#freeCj3charCheckbox').is(':checked')],
      [4, $('#freeCj4charCheckbox').is(':checked')]
    ]);
    const length5Plus = $('#freeCj5pluscharCheckbox').is(':checked');
    const allLengthsEnabled = Array.from(lengthStates.values()).every(Boolean) && length5Plus;

    if (!allLengthsEnabled) {
      processed = processed.split('\n')
        .filter(line => {
          const match = line.match(/^[a-z]+ (.+)$/);
          if (!match) return true; // 非既定格式保留

          const chineseText = match[1];
          const len = chineseText.length;

          if (len >= 5) return length5Plus;
          if (lengthStates.has(len)) return lengthStates.get(len);

          // 未對應字數，預設遵循 5+ 選項
          return length5Plus;
        })
        .join('\n');
    }

    setOutput(processed, 'freeCj');
    const entryCount = processed ? processed.split(/\n/).filter(Boolean).length : 0;
    setResultStatus(`freeCj 輸出完成：${entryCount} 筆`, 'success');
  });

  // 提供 doFreeCj，維持相容需求（可直接呼叫）
  async function doFreeCj(textOrProcess, mode = 'fcj', opts = {}) {
    // 階段三：功能整合 - 使用統一的字數過濾邏輯
    if (!opts.charLengthFilter) {
      opts.charLengthFilter = getUnifiedCharLengthFilter();
    }
    return await FcjUtils.cjMakeFromText(textOrProcess, mode, opts);
  }
  
  // words.html 的字數過濾邏輯（基於現有的 checkbox）
  function getWordsCharLengthFilter() {
    const resolveFlag = (selector, fallback = true) => {
      const $el = $(selector);
      return $el.length ? $el.is(':checked') : fallback;
    };

    const lengthStates = new Map([
      [1, resolveFlag('#freeCjSingleCharCheckbox')],
      [2, resolveFlag('#freeCj2charCheckbox')],
      [3, resolveFlag('#freeCj3charCheckbox')],
      [4, resolveFlag('#freeCj4charCheckbox')]
    ]);
    const length5Plus = resolveFlag('#freeCj5pluscharCheckbox');

    return function(charLength) {
      if (charLength >= 5) return length5Plus;
      if (lengthStates.has(charLength)) return lengthStates.get(charLength);
      return length5Plus;
    };
  }
  
  function validateFreeCjCheckboxes() {
    // 檢查是否至少有一個字數選項被勾選
    const hasAnyChecked = [
      '#freeCjSingleCharCheckbox',
      '#freeCj2charCheckbox', 
      '#freeCj3charCheckbox',
      '#freeCj4charCheckbox',
      '#freeCj5pluscharCheckbox'
    ].some(id => $(id).is(':checked'));

    if (!hasAnyChecked) {
      setResultStatus('警告：至少要選擇一個字數選項', 'error', 0);
      return false;
    }
    return true;
  }
  // 綁定所有字數選項的 checkbox 事件
  $('#freeCjSingleCharCheckbox, #freeCj2charCheckbox, #freeCj3charCheckbox, #freeCj4charCheckbox, #freeCj5pluscharCheckbox').on('change', function() {
    if (!validateFreeCjCheckboxes()) {
      // 復原操作
      $(this).prop('checked', true);
      renderOptionStatus();
      saveConfig();
      return;
    }
    // 驗證通過後，觸發配置保存
    renderOptionStatus();
    saveConfig();
  });

  // 簡易斷句 - 根據下拉選單決定過濾規則
  $('#simpleBtn').on('click', () => {
    setOutput(prepare('dedup'), '簡易斷句 去重');
  });

  // 簡易斷句、排序與計數
  $('#punctuationSortCountBtn').on('click', () => {
    const words = prepare('[]');
    const wordCounts = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});

    const sortOrder = $('#sortOrderSelect').val();
    let sortedWords;

    if (sortOrder === 'alpha') {
      sortedWords = Object.entries(wordCounts)
        .sort(([wordA], [wordB]) => wordB.localeCompare(wordA)) // 依字母排序
        //.sort(([wordA], [wordB]) => wordA.localeCompare(wordB)) // 依字母倒排
        .map(([word, count]) => `${word}\t${count}`);
    } else { // Default to 'count'
      sortedWords = Object.entries(wordCounts)
        .sort(([, countA], [, countB]) => countB - countA) // 依計數倒排序
        .map(([word, count]) => `${word}\t${count}`);
    }

    setOutput(sortedWords.join('\n'), 'punctuationSortCount');
  });
});
