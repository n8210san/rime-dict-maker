// 統一的字數過濾管理模組
(function(global) {
  'use strict';

  class CharFilterManager {
    constructor() {
      this.filters = new Map();
      this.defaultOptions = [
        { id: 'singleChar', label: '單字', length: 1, default: true },
        { id: '2char', label: '2字', length: 2, default: true },
        { id: '3char', label: '3字', length: 3, default: true },
        { id: '4char', label: '4字', length: 4, default: true },
        { id: '5pluschar', label: '5字以上', length: '5+', default: true }
      ];
    }

    // 註冊過濾器（支援不同頁面的不同需求）
    registerFilter(name, options = this.defaultOptions, prefix = '') {
      const filterConfig = {
        name,
        options: options.map(opt => ({
          ...opt,
          id: prefix ? `${prefix}${opt.id}` : opt.id
        })),
        prefix
      };
      
      this.filters.set(name, filterConfig);
      return filterConfig;
    }

    // 獲取過濾器函數
    getFilter(name = 'default') {
      const config = this.filters.get(name);
      if (!config) {
        console.warn(`過濾器 "${name}" 未找到，使用預設邏輯`);
        return () => true;
      }

      return (charLength) => {
        // 根據配置選項檢查對應的 checkbox
        for (const option of config.options) {
          if (option.length === charLength || 
              (option.length === '5+' && charLength >= 5)) {
            const $checkbox = $(`#${option.id}`);
            return $checkbox.length ? $checkbox.is(':checked') : option.default;
          }
        }
        return true; // 預設允許
      };
    }

    // 創建UI元素
    createUI(containerId, filterName, options = null) {
      const config = this.filters.get(filterName);
      if (!config) {
        console.error(`過濾器 "${filterName}" 不存在`);
        return false;
      }

      const $container = $(containerId);
      if (!$container.length) {
        console.error(`容器 "${containerId}" 不存在`);
        return false;
      }

      const uiOptions = options || config.options;
      const html = uiOptions.map(opt => `
        <label style="margin-right: 8px; font-size: 13px;">
          <input type="checkbox" id="${opt.id}" ${opt.default ? 'checked' : ''}> 
          ${opt.label}
        </label>
      `).join('');

      $container.html(html);

      // 綁定驗證邏輯（至少選一個）
      this.bindValidation(filterName);
      
      return true;
    }

    // 綁定驗證邏輯
    bindValidation(filterName) {
      const config = this.filters.get(filterName);
      if (!config) return;

      const checkboxIds = config.options.map(opt => `#${opt.id}`);
      const checkboxSelector = checkboxIds.join(', ');

      $(document).on('change', checkboxSelector, function() {
        const hasAnyChecked = checkboxIds.some(id => $(id).is(':checked'));
        
        if (!hasAnyChecked) {
          // 阻止全部取消選擇
          $(this).prop('checked', true);
          if (typeof FcjUtils !== 'undefined' && FcjUtils.updateOptionStatus) {
            FcjUtils.updateOptionStatus('警告：至少要選擇一個字數選項', 'error');
          } else {
            alert('警告：至少要選擇一個字數選項');
          }
          return false;
        }
      });
    }

    // 獲取選中的字數範圍
    getSelectedLengths(filterName) {
      const config = this.filters.get(filterName);
      if (!config) return [];

      return config.options
        .filter(opt => {
          const $checkbox = $(`#${opt.id}`);
          return $checkbox.length && $checkbox.is(':checked');
        })
        .map(opt => opt.length);
    }

    // 批量設置選項狀態
    setOptions(filterName, settings) {
      const config = this.filters.get(filterName);
      if (!config) return false;

      Object.entries(settings).forEach(([optionId, checked]) => {
        const $checkbox = $(`#${optionId}`);
        if ($checkbox.length) {
          $checkbox.prop('checked', checked);
        }
      });

      return true;
    }
  }

  // 建立全域實例
  global.CharFilterManager = CharFilterManager;
  global.charFilterManager = new CharFilterManager();

})(window);