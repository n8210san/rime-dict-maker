// 重構後的共用功能整合
(function(global) {
  'use strict';

  class RefactoredCommon {
    constructor() {
      this.initialized = false;
      this.config = null;
      this.undoStack = [];
      this.maxUndo = 100;
    }

    // 初始化共用功能
    async init(pageType = 'common', options = {}) {
      if (this.initialized) return;

      try {
        // 初始化配置管理
        this.config = global.commonConfig || new global.ConfigManager('rovodev_common');
        
        // 初始化字數過濾管理
        if (options.enableCharFilter) {
          this.setupCharFilter(pageType, options.charFilterOptions);
        }

        // 初始化倉頡處理器
        if (options.enableCangjie) {
          await global.cangjieProcessor.loadDict();
        }

        // 綁定通用UI事件
        this.bindCommonEvents(options);

        // 綁定配置持久化
        this.bindConfigPersistence(options.configBindings || {});

        this.initialized = true;
        console.log(`RefactoredCommon 已初始化 (${pageType})`);

      } catch (error) {
        console.error('RefactoredCommon 初始化失敗:', error);
        throw error;
      }
    }

    // 設置字數過濾器
    setupCharFilter(pageType, options = {}) {
      const filterName = options.filterName || pageType;
      const prefix = options.prefix || '';
      
      // 註冊過濾器
      global.charFilterManager.registerFilter(filterName, undefined, prefix);
      
      // 如果指定了容器，創建UI
      if (options.containerId) {
        global.charFilterManager.createUI(options.containerId, filterName);
      }
    }

    // 綁定通用事件
    bindCommonEvents(options = {}) {
      // 檔案處理
      if (options.enableFileHandling !== false) {
        this.bindFileEvents();
      }

      // 撤銷/重做
      if (options.enableUndo !== false) {
        this.bindUndoEvents();
      }

      // 拖放支援
      if (options.enableDragDrop !== false) {
        this.bindDragDropEvents();
      }
    }

    // 綁定檔案相關事件
    bindFileEvents() {
      $('#openFileBtn').on('click', () => $('#openFileInput').trigger('click'));
      
      $('#openFileInput').on('change', async (e) => {
        const files = e.target.files && Array.from(e.target.files);
        if (files && files.length) {
          await this.readFiles(files);
        }
        e.target.value = ''; // 允許重複選擇同一檔案
      });
    }

    // 綁定撤銷事件
    bindUndoEvents() {
      $('#undoBtn').on('click', () => this.undo());
      $('#swapBtn').on('click', () => this.swapInputOutput());
      $('#nextStepBtn').on('click', () => this.moveOutputToInput());
    }

    // 綁定拖放事件
    bindDragDropEvents() {
      const $input = $('#inputTextarea');
      if (!$input.length) return;

      $input.on('dragenter dragover dragleave dragend drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const isDragOver = e.type === 'dragenter' || e.type === 'dragover';
        $input.toggleClass('drag-over', isDragOver);
      });

      $input.on('drop', async (e) => {
        const dt = e.originalEvent && e.originalEvent.dataTransfer;
        if (!dt) return;

        if (dt.files && dt.files.length) {
          await this.readFiles(Array.from(dt.files));
        } else {
          const text = dt.getData && dt.getData('text/plain');
          if (text) {
            this.setInputOutput(text, '', 'dropText');
          }
        }
      });
    }

    // 讀取檔案
    async readFiles(files) {
      try {
        const encoding = $('#encodingSelect').val() || 'utf-8';
        const chunks = [];
        
        for (const file of files) {
          const text = await this.readFileAsText(file, encoding);
          chunks.push(text);
        }
        
        const combinedText = chunks.join('\n\n');
        this.setInputOutput(combinedText, '', 'openFiles');
        
      } catch (error) {
        this.showStatus('讀取檔案失敗: ' + error.message, 'error');
      }
    }

    // 讀取單一檔案
    readFileAsText(file, encoding) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('讀檔失敗'));
        reader.onload = () => resolve(String(reader.result || ''));
        
        try {
          reader.readAsText(file, encoding);
        } catch (error) {
          reject(error);
        }
      });
    }

    // 撤銷操作
    undo() {
      if (this.undoStack.length === 0) return false;
      
      const previous = this.undoStack.pop();
      $('#inputTextarea').val(previous.input);
      $('#outputTextarea').val(previous.output);
      this.updateUndoButton();
      
      return true;
    }

    // 交換輸入輸出
    swapInputOutput() {
      const inputVal = $('#inputTextarea').val() || '';
      const outputVal = $('#outputTextarea').val() || '';
      this.setInputOutput(outputVal, inputVal, 'swap');
    }

    // 移動輸出到輸入
    moveOutputToInput() {
      const outputVal = $('#outputTextarea').val() || '';
      this.setInput(outputVal, 'nextStep');
    }

    // 設置輸入輸出內容
    setInputOutput(inputVal, outputVal, operation = '') {
      this.pushToUndoStack();
      $('#inputTextarea').val(inputVal);
      $('#outputTextarea').val(outputVal);
      
      if (operation) {
        this.showStatus(`執行: ${operation}`, 'success');
      }
    }

    // 設置輸入內容
    setInput(value, operation = '') {
      this.pushToUndoStack();
      $('#inputTextarea').val(value);
      
      if (operation) {
        this.showStatus(`執行: ${operation}`, 'success');
      }
    }

    // 設置輸出內容
    setOutput(value, operation = '') {
      this.pushToUndoStack();
      $('#outputTextarea').val(value);
      
      // 更新計數顯示
      this.updateOutputCount(value);
      
      if (operation) {
        this.showStatus(`執行: ${operation}`, 'success');
      }
    }

    // 推入撤銷堆疊
    pushToUndoStack() {
      const currentState = {
        input: $('#inputTextarea').val() || '',
        output: $('#outputTextarea').val() || ''
      };
      
      this.undoStack.push(currentState);
      
      if (this.undoStack.length > this.maxUndo) {
        this.undoStack.shift();
      }
      
      this.updateUndoButton();
    }

    // 更新撤銷按鈕
    updateUndoButton() {
      const $btn = $('#undoBtn');
      const count = this.undoStack.length;
      
      if ($btn.length) {
        $btn.text(count ? `復原(${count})` : '復原')
           .prop('disabled', count === 0);
      }
    }

    // 更新輸出計數
    updateOutputCount(text) {
      const $count = $('#outputCount, #outputTextareaCount');
      if ($count.length && text) {
        const lines = text.split('\n').filter(Boolean).length;
        $count.text(`總計 ${lines} 行`);
      }
    }

    // 顯示狀態訊息
    showStatus(message, type = 'info', timeout = 5000) {
      const $status = $('#excuted_result, #option_status, #statusDisplay');
      if (!$status.length) return;

      const colors = {
        success: 'green',
        warning: 'orange',
        error: 'red',
        info: 'blue'
      };

      $status.text(message).css('color', colors[type] || 'black');

      if (timeout > 0 && type !== 'error') {
        setTimeout(() => {
          if ($status.text() === message) {
            $status.text('').css('color', '');
          }
        }, timeout);
      }
    }

    // 綁定配置持久化
    bindConfigPersistence(bindings) {
      this.config.bindElements(bindings);
    }

    // 獲取字數過濾器
    getCharLengthFilter(filterName = 'default') {
      return global.charFilterManager.getFilter(filterName);
    }

    // 獲取倉頡處理器
    getCangjieProcessor() {
      return global.cangjieProcessor;
    }
  }

  // 建立全域實例
  global.RefactoredCommon = RefactoredCommon;
  global.refactoredCommon = new RefactoredCommon();

  // 向後相容的全域函數
  global.setInput = (value, operation) => global.refactoredCommon.setInput(value, operation);
  global.setOutput = (value, operation) => global.refactoredCommon.setOutput(value, operation);
  global.setIO = (input, output, operation) => global.refactoredCommon.setInputOutput(input, output, operation);

})(window);