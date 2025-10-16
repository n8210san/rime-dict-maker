// UI管理模組 - 現代化重構版
(function(global) {
  'use strict';

  // 註冊UI管理模組
  ModuleSystem.register('ui', async function(deps) {
    
    class UIModule extends ModuleSystem.BaseModule {
      constructor(config) {
        super('ui', { config });
        this.components = new Map();
        this.eventHandlers = new Map();
        this.undoStack = [];
        this.maxUndoSize = 50;
        this.version = '2.0.0';
      }

      async _doInit() {
        console.log('🔧 初始化UI管理模組...');
        
        this.bindCommonEvents();
        this.restoreUIState();
        this.initializeUndo();
      }

      // 綁定通用事件
      bindCommonEvents() {
        // 檔案處理
        this.bindFileEvents();
        
        // 拖放支援
        this.bindDragDropEvents();
        
        // 編碼選擇持久化
        this.bindEncodingEvents();
        
        // 通用按鈕事件
        this.bindCommonButtons();
      }

      bindFileEvents() {
        $('#openFileBtn').on('click', () => {
          $('#openFileInput').trigger('click');
        });
        
        $('#openFileInput').on('change', async (e) => {
          const files = e.target.files && Array.from(e.target.files);
          if (files && files.length) {
            await this.handleFiles(files);
          }
          e.target.value = ''; // 允許重複選擇
        });
      }

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
            await this.handleFiles(Array.from(dt.files));
          } else {
            const text = dt.getData && dt.getData('text/plain');
            if (text) {
              this.setInputOutput(text, '', 'dropText');
            }
          }
        });
      }

      bindEncodingEvents() {
        const $encoding = $('#encodingSelect');
        if (!$encoding.length) return;

        // 恢復保存的編碼選擇
        const savedEncoding = this.dep('config').get('common.encoding', 'utf-8');
        $encoding.val(savedEncoding);

        // 綁定變更事件
        $encoding.on('change', () => {
          this.dep('config').set('common.encoding', $encoding.val());
        });
      }

      bindCommonButtons() {
        $('#undoBtn').on('click', () => this.undo());
        $('#swapBtn').on('click', () => this.swapInputOutput());
        $('#nextStepBtn').on('click', () => this.moveOutputToInput());
      }

      // 檔案處理
      async handleFiles(files) {
        try {
          const encoding = $('#encodingSelect').val() || 'utf-8';
          const chunks = [];
          
          for (const file of files) {
            const text = await this.readFileAsText(file, encoding);
            chunks.push(text);
          }
          
          const combinedText = chunks.join('\n\n');
          this.setInputOutput(combinedText, '', 'openFiles');
          
          this.showStatus(`已載入 ${files.length} 個檔案`, 'success');
          
        } catch (error) {
          this.showStatus('讀取檔案失敗: ' + error.message, 'error');
        }
      }

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

      // 內容管理
      setInput(value, operation = '') {
        this.pushToUndoStack();
        $('#inputTextarea').val(value);
        
        if (operation) {
          this.showStatus(`執行: ${operation}`, 'success');
        }

        this.emit('inputChanged', { value, operation });
      }

      setOutput(value, operation = '') {
        this.pushToUndoStack();
        $('#outputTextarea').val(value);
        this.updateOutputCount(value);
        
        if (operation) {
          this.showStatus(`執行: ${operation}`, 'success');
        }

        this.emit('outputChanged', { value, operation });
      }

      setInputOutput(inputVal, outputVal, operation = '') {
        this.pushToUndoStack();
        $('#inputTextarea').val(inputVal);
        $('#outputTextarea').val(outputVal);
        this.updateOutputCount(outputVal);
        
        if (operation) {
          this.showStatus(`執行: ${operation}`, 'success');
        }

        this.emit('contentChanged', { input: inputVal, output: outputVal, operation });
      }

      // 撤銷系統
      initializeUndo() {
        this.updateUndoButton();
      }

      pushToUndoStack() {
        const currentState = {
          input: $('#inputTextarea').val() || '',
          output: $('#outputTextarea').val() || '',
          timestamp: Date.now()
        };
        
        this.undoStack.push(currentState);
        
        if (this.undoStack.length > this.maxUndoSize) {
          this.undoStack.shift();
        }
        
        this.updateUndoButton();
        this.emit('undoStateChanged', this.undoStack.length);
      }

      undo() {
        if (this.undoStack.length === 0) return false;
        
        const previous = this.undoStack.pop();
        $('#inputTextarea').val(previous.input);
        $('#outputTextarea').val(previous.output);
        this.updateOutputCount(previous.output);
        this.updateUndoButton();
        
        this.showStatus('已復原', 'info');
        this.emit('undoExecuted', previous);
        
        return true;
      }

      updateUndoButton() {
        const $btn = $('#undoBtn');
        const count = this.undoStack.length;
        
        if ($btn.length) {
          $btn.text(count ? `復原(${count})` : '復原')
             .prop('disabled', count === 0);
        }
      }

      // 內容操作
      swapInputOutput() {
        const inputVal = $('#inputTextarea').val() || '';
        const outputVal = $('#outputTextarea').val() || '';
        this.setInputOutput(outputVal, inputVal, 'swap');
      }

      moveOutputToInput() {
        const outputVal = $('#outputTextarea').val() || '';
        this.setInput(outputVal, 'nextStep');
      }

      // UI 組件創建
      createEncodingSelect(containerId, options = {}) {
        const {
          id = 'encodingSelect',
          title = '檔案編碼',
          defaultValue = 'utf-8',
          encodings = [
            { value: 'utf-8', text: 'UTF-8' },
            { value: 'big5', text: 'Big5' },
            { value: 'gbk', text: 'GBK' },
            { value: 'gb18030', text: 'GB18030' },
            { value: 'shift_jis', text: 'Shift_JIS' },
            { value: 'utf-16le', text: 'UTF-16LE' },
            { value: 'utf-16be', text: 'UTF-16BE' }
          ]
        } = options;

        const optionsHtml = encodings.map(enc => 
          `<option value="${enc.value}" ${enc.value === defaultValue ? 'selected' : ''}>${enc.text}</option>`
        ).join('');

        const html = `
          <select id="${id}" title="${title}" style="height: 48px; background-color: #eef;">
            ${optionsHtml}
          </select>
        `;

        $(containerId).html(html);
        
        // 綁定到配置管理
        this.dep('config').bindElement(`#${id}`, 'encoding', { defaultValue });
        
        return $(`#${id}`);
      }

      createButtonGroup(containerId, buttons = []) {
        const html = buttons.map(btn => {
          const {
            id,
            text,
            title = '',
            disabled = false,
            className = '',
            style = '',
            handler = null
          } = btn;

          return `
            <button id="${id}" 
                    ${title ? `title="${title}"` : ''} 
                    ${disabled ? 'disabled' : ''}
                    ${className ? `class="${className}"` : ''}
                    ${style ? `style="${style}"` : ''}
            >${text}</button>
          `;
        }).join('');

        $(containerId).append(html);

        // 綁定事件處理器
        const buttonMap = {};
        buttons.forEach(btn => {
          const $button = $(`#${btn.id}`);
          buttonMap[btn.id] = $button;
          
          if (btn.handler) {
            $button.on('click', btn.handler);
          }
        });

        return buttonMap;
      }

      createDualTextareas(containerId, options = {}) {
        const {
          inputId = 'inputTextarea',
          outputId = 'outputTextarea',
          inputTitle = '輸入',
          outputTitle = '輸出',
          inputPlaceholder = '請在此輸入...',
          outputPlaceholder = '',
          showCounts = true
        } = options;

        const html = `
          <div class="container">
            <div class="text-box">
              <h3>${inputTitle}</h3>
              <textarea id="${inputId}" placeholder="${inputPlaceholder}"></textarea>
              ${showCounts ? `<div id="${inputId}Count" class="text-count"></div>` : ''}
            </div>
            <div class="text-box">
              <h3>${outputTitle}</h3>
              <textarea id="${outputId}" placeholder="${outputPlaceholder}"></textarea>
              ${showCounts ? `<div id="${outputId}Count" class="text-count"></div>` : ''}
            </div>
          </div>
        `;

        $(containerId).html(html);

        // 綁定內容變更事件
        $(`#${inputId}`).on('input', ModuleSystem.utils.debounce(() => {
          this.updateInputCount($(`#${inputId}`).val());
        }, 300));

        return {
          input: $(`#${inputId}`),
          output: $(`#${outputId}`),
          inputCount: $(`#${inputId}Count`),
          outputCount: $(`#${outputId}Count`)
        };
      }

      // 狀態顯示
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

        this.emit('statusChanged', { message, type });
      }

      updateInputCount(text) {
        const $count = $('#inputTextareaCount, #inputCount');
        if ($count.length && text) {
          const lines = text.split('\n').filter(Boolean).length;
          $count.text(`${lines} 行`);
        }
      }

      updateOutputCount(text) {
        const $count = $('#outputTextareaCount, #outputCount');
        if ($count.length && text) {
          const lines = text.split('\n').filter(Boolean).length;
          $count.text(`總計 ${lines} 行`);
        }
      }

      // 下載功能
      downloadOutput(filename = null) {
        const data = $('#outputTextarea').val();
        if (!data.trim()) {
          this.showStatus('沒有可下載的內容', 'warning');
          return false;
        }

        const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        if (!filename) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          filename = `output_${timestamp}.txt`;
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
          URL.revokeObjectURL(url);
          a.remove();
        }, 0);

        this.showStatus('檔案已下載', 'success');
        this.emit('fileDownloaded', { filename, size: data.length });
        
        return true;
      }

      // 恢復UI狀態
      restoreUIState() {
        // 恢復編碼選擇
        const encoding = this.dep('config').get('common.encoding');
        if (encoding) {
          $('#encodingSelect').val(encoding);
        }

        // 恢復其他UI狀態...
        this.emit('uiStateRestored');
      }

      // 獲取統計信息
      getStats() {
        return {
          components: this.components.size,
          eventHandlers: this.eventHandlers.size,
          undoStackSize: this.undoStack.length,
          version: this.version
        };
      }

      // 清理資源
      async destroy() {
        // 移除所有事件監聽器
        $(document).off('.uiModule');
        
        this.components.clear();
        this.eventHandlers.clear();
        this.undoStack.length = 0;
        
        await super.destroy();
      }
    }

    const uiModule = new UIModule(deps.config);
    await uiModule.init();

    return uiModule;
    
  }, ['config']); // 依賴配置模組

})(window);