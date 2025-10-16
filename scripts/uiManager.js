// 統一的UI管理模組
(function(global) {
  'use strict';

  class UIManager {
    constructor() {
      this.components = new Map();
      this.eventHandlers = new Map();
    }

    // 註冊可重用的UI元件
    registerComponent(name, template, handlers = {}) {
      this.components.set(name, { template, handlers });
    }

    // 創建編碼選擇器
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
      return $(`#${id}`);
    }

    // 創建檔案輸入控制組
    createFileControls(containerId, options = {}) {
      const {
        openBtnId = 'openFileBtn',
        inputId = 'openFileInput',
        openBtnText = '開啟檔案',
        acceptTypes = '.txt,.md,.csv,.json,.log,.xml,.html,.htm,text/*',
        multiple = true
      } = options;

      const html = `
        <button id="${openBtnId}">${openBtnText}</button>
        <input type="file" id="${inputId}" 
               accept="${acceptTypes}" 
               ${multiple ? 'multiple' : ''} 
               style="display:none" />
      `;

      $(containerId).append(html);

      // 綁定事件
      $(`#${openBtnId}`).on('click', () => $(`#${inputId}`).trigger('click'));
      
      return {
        openBtn: $(`#${openBtnId}`),
        input: $(`#${inputId}`)
      };
    }

    // 創建雙欄位佈局
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
            ${showCounts ? `<div id="${inputId}Count" style="margin-top:4px; font-size:12px; color:#666;"></div>` : ''}
          </div>
          <div class="text-box">
            <h3>${outputTitle}</h3>
            <textarea id="${outputId}" placeholder="${outputPlaceholder}"></textarea>
            ${showCounts ? `<div id="${outputId}Count" style="margin-top:4px; font-size:12px; color:#666;"></div>` : ''}
          </div>
        </div>
      `;

      $(containerId).html(html);

      return {
        input: $(`#${inputId}`),
        output: $(`#${outputId}`),
        inputCount: $(`#${inputId}Count`),
        outputCount: $(`#${outputId}Count`)
      };
    }

    // 創建按鈕組
    createButtonGroup(containerId, buttons = []) {
      const html = buttons.map(btn => {
        const {
          id,
          text,
          title = '',
          disabled = false,
          className = '',
          style = ''
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

      // 返回按鈕元素映射
      const buttonMap = {};
      buttons.forEach(btn => {
        buttonMap[btn.id] = $(`#${btn.id}`);
      });

      return buttonMap;
    }

    // 創建狀態顯示區域
    createStatusDisplay(containerId, options = {}) {
      const {
        id = 'statusDisplay',
        className = 'status-display',
        style = 'margin-top:4px; font-size:12px;'
      } = options;

      const html = `
        <div id="${id}" class="${className}" style="${style}"></div>
      `;

      $(containerId).append(html);

      const $display = $(`#${id}`);

      // 返回帶有便利方法的對象
      return {
        element: $display,
        show: (message, type = 'info', timeout = 5000) => {
          const colors = {
            success: 'green',
            warning: 'orange',
            error: 'red',
            info: 'blue'
          };

          $display.text(message).css('color', colors[type] || 'black');

          if (timeout > 0 && type !== 'error') {
            setTimeout(() => {
              if ($display.text() === message) {
                $display.text('').css('color', '');
              }
            }, timeout);
          }
        },
        clear: () => $display.text('').css('color', ''),
        text: (message) => $display.text(message),
        html: (html) => $display.html(html)
      };
    }

    // 創建分隔符選擇器
    createSeparatorSelect(containerId, options = {}) {
      const {
        id = 'separatorOpt',
        label = '分隔符:',
        defaultValue = ' ',
        separators = [
          { value: '\t', text: 'tab' },
          { value: ' ', text: '空格' }
        ]
      } = options;

      const optionsHtml = separators.map(sep =>
        `<option value="${sep.value}" ${sep.value === defaultValue ? 'selected' : ''}>${sep.text}</option>`
      ).join('');

      const html = `
        <label style="margin-left:8px; font-size:13px;">${label}
          <select id="${id}" style="margin-left:4px;">
            ${optionsHtml}
          </select>
        </label>
      `;

      $(containerId).append(html);
      return $(`#${id}`);
    }

    // 創建範圍輸入控制
    createRangeInput(containerId, options = {}) {
      const {
        id = 'rangeInput',
        label = '範圍：',
        placeholder = '>300 或 300-20 或 50-250',
        defaultValue = '>2999',
        width = '180px'
      } = options;

      const html = `
        <label style="margin-left:8px; font-size:13px;">${label}</label>
        <input type="text" id="${id}" 
               placeholder="${placeholder}" 
               value="${defaultValue}"
               style="height: 40px; width: ${width}; padding: 0 8px;" />
      `;

      $(containerId).append(html);
      return $(`#${id}`);
    }

    // 統一的事件綁定管理
    bindEvents(eventMap) {
      Object.entries(eventMap).forEach(([selector, handlers]) => {
        const $element = $(selector);
        if (!$element.length) {
          console.warn(`元素 "${selector}" 不存在，跳過事件綁定`);
          return;
        }

        Object.entries(handlers).forEach(([event, handler]) => {
          $element.on(event, handler);
        });
      });
    }

    // 批量設置元素屬性
    setAttributes(attributeMap) {
      Object.entries(attributeMap).forEach(([selector, attributes]) => {
        const $element = $(selector);
        if ($element.length) {
          Object.entries(attributes).forEach(([attr, value]) => {
            if (attr === 'text') {
              $element.text(value);
            } else if (attr === 'html') {
              $element.html(value);
            } else if (attr === 'class') {
              $element.attr('class', value);
            } else if (attr === 'style') {
              $element.attr('style', value);
            } else {
              $element.attr(attr, value);
            }
          });
        }
      });
    }

    // 創建模態對話框
    createModal(options = {}) {
      const {
        id = 'commonModal',
        title = '對話框',
        content = '',
        buttons = [
          { id: 'cancelBtn', text: '取消', className: 'btn-cancel' },
          { id: 'confirmBtn', text: '確定', className: 'btn-primary' }
        ],
        closable = true
      } = options;

      const buttonsHtml = buttons.map(btn =>
        `<button id="${btn.id}" class="modal-btn ${btn.className || ''}">${btn.text}</button>`
      ).join('');

      const html = `
        <div id="${id}Backdrop" class="modal-backdrop"></div>
        <div id="${id}" class="modal">
          <div class="modal-card">
            <div class="modal-header">
              ${title}
              ${closable ? `<button id="${id}CloseBtn" class="modal-close">×</button>` : ''}
            </div>
            <div class="modal-body">
              ${content}
            </div>
            <div class="modal-footer">
              ${buttonsHtml}
            </div>
          </div>
        </div>
      `;

      $('body').append(html);

      const modal = {
        show: () => {
          $(`#${id}Backdrop, #${id}`).show();
          $(`#${id}`).css('display', 'flex');
        },
        hide: () => {
          $(`#${id}Backdrop, #${id}`).hide();
        },
        setContent: (content) => {
          $(`#${id} .modal-body`).html(content);
        },
        setTitle: (title) => {
          $(`#${id} .modal-header`).html(title + 
            (closable ? `<button id="${id}CloseBtn" class="modal-close">×</button>` : ''));
        }
      };

      // 綁定關閉事件
      if (closable) {
        $(`#${id}CloseBtn, #${id}Backdrop`).on('click', modal.hide);
      }

      return modal;
    }
  }

  // 建立全域實例
  global.UIManager = UIManager;
  global.uiManager = new UIManager();

})(window);