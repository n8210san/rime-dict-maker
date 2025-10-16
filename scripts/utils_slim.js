// Slim version of utils.js - 核心功能保留版
(function(global){
  'use strict';

  // 核心撤銷功能 (簡化版)
  const undoStack = [];
  const UNDO_MAX = 50; // 減少記憶體使用

  function updateUndoLabel() {
    const n = undoStack.length;
    const $btn = $('#undoBtn');
    if ($btn.length) {
      $btn.text(n ? `復原(${n})` : '復原').prop('disabled', !n);
    }
  }

  function pushUndo(operation = '') {
    const $in = $('#inputTextarea');
    const $out = $('#outputTextarea');
    if (!$in.length || !$out.length) return;
    
    undoStack.push({ 
      input: $in.val(), 
      output: $out.val() || '' 
    });
    
    if (undoStack.length > UNDO_MAX) undoStack.shift();
    updateUndoLabel();
    
    // 簡化狀態顯示
    if (operation) {
      $('#excuted_result').text(operation).css('color','green');
    }
  }

  // 簡化的內容設定函數
  function setOutput(value, operation) { 
    pushUndo(operation);
    $('#outputTextarea').val(value);
  }
  
  function setInput(value, operation) { 
    pushUndo(operation);
    $('#inputTextarea').val(value); 
  }
  
  function setIO(inputVal, outputVal, operation) {
    pushUndo(operation);
    $('#inputTextarea').val(inputVal);
    $('#outputTextarea').val(outputVal);
  }

  // 核心檔案讀取 (簡化版)
  async function readFileAsText(file, encoding = 'utf-8') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('讀檔失敗'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsText(file, encoding);
    });
  }

  async function readSelectedFiles(files) {
    if (!files?.length) return;
    const encoding = $('#encodingSelect').val() || 'utf-8';
    
    try {
      const chunks = [];
      for (const f of files) {
        chunks.push(await readFileAsText(f, encoding));
      }
      setIO(chunks.join('\n\n'), '', 'openFiles');
    } catch (e) {
      alert('讀取檔案失敗: ' + (e.message || '未知錯誤'));
    }
  }

  // 基本UI綁定 (核心功能)
  function bindCoreUI() {
    // 編碼選擇持久化
    const $encoding = $('#encodingSelect');
    if ($encoding.length) {
      try {
        const saved = localStorage.getItem('rovodev_encoding');
        if (saved) $encoding.val(saved);
        $encoding.on('change', () => {
          try { localStorage.setItem('rovodev_encoding', $encoding.val()); } catch {}
        });
      } catch {}
    }

    // 檔案操作
    $('#openFileBtn').on('click', () => $('#openFileInput').trigger('click'));
    $('#openFileInput').on('change', e => {
      const files = e.target.files && Array.from(e.target.files);
      if (files) readSelectedFiles(files);
      e.target.value = '';
    });

    // 撤銷操作
    $('#undoBtn').on('click', () => {
      if (!undoStack.length) return;
      const prev = undoStack.pop();
      $('#inputTextarea').val(prev.input);
      $('#outputTextarea').val(prev.output);
      updateUndoLabel();
    });

    // 內容轉移
    $('#swapBtn').on('click', () => {
      const inputVal = $('#inputTextarea').val() || '';
      const outputVal = $('#outputTextarea').val() || '';
      setIO(outputVal, inputVal, 'swap');
    });

    $('#nextStepBtn').on('click', () => {
      setInput($('#outputTextarea').val(), 'nextStep');
    });

    // 基本拖放支援
    const $input = $('#inputTextarea');
    $input.on('dragover drop', e => {
      e.preventDefault();
      if (e.type === 'drop') {
        const files = e.originalEvent.dataTransfer?.files;
        if (files?.length) {
          readSelectedFiles(Array.from(files));
        } else {
          const text = e.originalEvent.dataTransfer?.getData('text/plain');
          if (text) setIO(text, '', 'dropText');
        }
      }
    });

    updateUndoLabel();
  }

  // 精簡API暴露
  const api = {
    // 核心函數
    setOutput, setInput, setIO,
    readFileAsText, readSelectedFiles,
    bindCoreUI,
    
    // 撤銷系統
    undoStack, pushUndo, updateUndoLabel
  };

  // 全域暴露 (向後相容)
  Object.assign(global, api);
  global.CoreUtils = api;

  // 自動初始化
  $(bindCoreUI);

})(window);