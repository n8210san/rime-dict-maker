// CharFilterManager 整合版 - 統一字數過濾邏輯
(function(global) {
  'use strict';

  class UnifiedCharFilterManager {
    constructor() {
      this.filters = new Map();
      this.defaultOptions = [
        { id: 'singleChar', label: '單字', length: 1, default: true },
        { id: '2char', label: '2字', length: 2, default: true },
        { id: '3char', label: '3字', length: 3, default: true },
        { id: '4char', label: '4字', length: 4, default: true },
        { id: '5pluschar', label: '5字以上', length: '5+', default: true }
      ];
      this.initialized = false;
    }

    // 初始化並整合現有的字數過濾邏輯
    init() {
      if (this.initialized) return;
      
      // 註冊各頁面的過濾器
      this.setupDictMakerFilter();
      this.setupWordsFilter();
      this.setupCharLengthOptionsIntegration();
      
      this.initialized = true;
      console.log('UnifiedCharFilterManager 初始化完成');
    }

    // 設置 dictMaker.html 的過濾器
    setupDictMakerFilter() {
      const dictMakerOptions = [
        { id: 'fcjOpt_singleChar', label: '單字', length: 1, default: true },
        { id: 'fcjOpt_2char', label: '2字', length: 2, default: true },
        { id: 'fcjOpt_3char', label: '3字', length: 3, default: true },
        { id: 'fcjOpt_4char', label: '4字', length: 4, default: true },
        { id: 'fcjOpt_5pluschar', label: '5字以上', length: '5+', default: true }
      ];

      this.registerFilter('dictMaker', dictMakerOptions);
    }

    // 設置 words.html 的過濾器
    setupWordsFilter() {
      const wordsOptions = [
        { id: 'freeCjSingleCharCheckbox', label: '單字', length: 1, default: true },
        { id: 'freeCj2charCheckbox', label: '2字', length: 2, default: true },
        { id: 'freeCj3charCheckbox', label: '3字', length: 3, default: true },
        { id: 'freeCj4charCheckbox', label: '4字', length: 4, default: true },
        { id: 'freeCj5pluscharCheckbox', label: '5字以上', length: '5+', default: true }
      ];

      this.registerFilter('words', wordsOptions);
    }

    // 整合 CharLengthOptions 組件
    setupCharLengthOptionsIntegration() {
      // 檢查是否存在 CharLengthOptions 組件
      if (typeof global.CharLengthOptions !== 'undefined') {
        const originalGetFilter = global.CharLengthOptions.getFilter;
        
        // 增強 CharLengthOptions.getFilter 以支援統一管理
        global.CharLengthOptions.getFilter = (filterId = 'charLengthOptions') => {
          if (this.filters.has(filterId)) {
            return this.getFilter(filterId);
          }
          return originalGetFilter ? originalGetFilter() : (() => true);
        };
      }
    }

    // 註冊過濾器
    registerFilter(name, options = this.defaultOptions) {
      const filterConfig = {
        name,
        options: options.map(opt => ({ ...opt }))
      };
      
      this.filters.set(name, filterConfig);
      console.log(`註冊字數過濾器: ${name}，包含 ${options.length} 個選項`);
      return filterConfig;
    }

    // 獲取過濾器函數（整合版）
    getFilter(name = 'default') {
      const config = this.filters.get(name);
      if (!config) {
        console.warn(`過濾器 "${name}" 未找到，使用通用邏輯`);
        return this._getGenericFilter();
      }

      return (charLength) => {
        // 根據配置選項檢查對應的 checkbox 或配置
        for (const option of config.options) {
          if (this._matchesLength(option.length, charLength)) {
            return this._isOptionEnabled(option);
          }
        }
        return true; // 預設允許
      };
    }

    // 通用過濾器（當沒有特定配置時使用）
    _getGenericFilter() {
      return (charLength) => {
        // 嘗試通用的 checkbox 檢查
        const genericIds = [
          `opt_${charLength}char`,
          `${charLength}char`,
          `char${charLength}`,
          charLength === 1 ? 'singleChar' : `${charLength}char`
        ];

        for (const id of genericIds) {
          const $el = $(`#${id}`);
          if ($el.length) {
            return $el.is(':checked');
          }
        }

        // 如果找不到對應的 UI 元素，檢查配置
        if (global.unifiedConfig) {
          const key = charLength === 1 ? 'singleChar' : 
                     charLength >= 5 ? '5pluschar' : `${charLength}char`;
          return global.unifiedConfig.get(`charFilter.${key}`, true);
        }

        return true; // 最後退路：允許所有
      };
    }

    // 檢查長度是否匹配
    _matchesLength(optionLength, charLength) {
      if (optionLength === charLength) return true;
      if (optionLength === '5+' && charLength >= 5) return true;
      return false;
    }

    // 檢查選項是否啟用
    _isOptionEnabled(option) {
      // 1. 優先檢查 UI 元素
      const $checkbox = $(`#${option.id}`);
      if ($checkbox.length) {
        return $checkbox.is(':checked');
      }

      // 2. 檢查統一配置
      if (global.unifiedConfig) {
        const configKey = `charFilter.${option.id}`;
        return global.unifiedConfig.get(configKey, option.default);
      }

      // 3. 檢查舊版 prefs 系統
      if (global.prefs && typeof global.prefs.get === 'function') {
        return global.prefs.get(option.id, option.default);
      }

      // 4. 使用預設值
      return option.default;
    }

    // 創建UI元素（與現有組件整合）
    createUI(containerId, filterName, options = {}) {
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

      // 檢查是否使用 CharLengthOptions 組件
      if (typeof global.CharLengthOptions !== 'undefined' && options.useComponent !== false) {
        try {
          global.CharLengthOptions.inject(containerId, {
            options: config.options,
            filterId: filterName
          });
          return true;
        } catch (e) {
          console.warn('CharLengthOptions 組件使用失敗，回退到手動創建:', e);
        }
      }

      // 手動創建 UI
      this._createManualUI($container, config);
      return true;
    }

    // 手動創建UI
    _createManualUI($container, config) {
      const html = config.options.map(opt => `
        <label style="margin-right: 8px; font-size: 13px;">
          <input type="checkbox" id="${opt.id}" ${opt.default ? 'checked' : ''}> 
          ${opt.label}
        </label>
      `).join('');

      $container.html(html);

      // 綁定變更事件到統一配置
      config.options.forEach(opt => {
        $(`#${opt.id}`).on('change', () => {
          if (global.unifiedConfig) {
            global.unifiedConfig.set(`charFilter.${opt.id}`, $(`#${opt.id}`).is(':checked'));
          }
        });
      });

      // 綁定驗證邏輯
      this._bindValidation(config);
    }

    // 綁定驗證邏輯（至少選一個）
    _bindValidation(config) {
      const checkboxIds = config.options.map(opt => `#${opt.id}`);
      const checkboxSelector = checkboxIds.join(', ');

      $(document).off('change.charFilter', checkboxSelector); // 避免重複綁定
      $(document).on('change.charFilter', checkboxSelector, function() {
        const hasAnyChecked = checkboxIds.some(id => $(id).is(':checked'));
        
        if (!hasAnyChecked) {
          // 阻止全部取消選擇
          $(this).prop('checked', true);
          
          // 顯示警告
          if (global.FcjUtils && global.FcjUtils.updateOptionStatus) {
            global.FcjUtils.updateOptionStatus('警告：至少要選擇一個字數選項', 'error');
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
        .filter(opt => this._isOptionEnabled(opt))
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
        
        // 同步到配置
        if (global.unifiedConfig) {
          global.unifiedConfig.set(`charFilter.${optionId}`, checked);
        }
      });

      return true;
    }

    // 重置過濾器到預設狀態
    resetFilter(filterName) {
      const config = this.filters.get(filterName);
      if (!config) return false;

      const defaultSettings = {};
      config.options.forEach(opt => {
        defaultSettings[opt.id] = opt.default;
      });

      return this.setOptions(filterName, defaultSettings);
    }
  }

  // 建立全域統一實例
  const unifiedCharFilter = new UnifiedCharFilterManager();

  // 向後相容的全域函數
  global.getCharLengthFilter = (filterName = 'default') => unifiedCharFilter.getFilter(filterName);

  // 整合到現有的命名空間
  if (!global.FcjUtils) global.FcjUtils = {};
  global.FcjUtils.getCharLengthFilter = global.getCharLengthFilter;

  // 新的統一API
  global.unifiedCharFilter = unifiedCharFilter;
  global.UnifiedCharFilterManager = UnifiedCharFilterManager;

  // 自動初始化
  $(function() {
    try {
      unifiedCharFilter.init();
      console.log('字數過濾管理器已就緒');
    } catch (error) {
      console.error('字數過濾管理器初始化失敗:', error);
    }
  });

})(window);