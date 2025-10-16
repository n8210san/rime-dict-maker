// 字數過濾模組 - 現代化重構版
(function(global) {
  'use strict';

  // 註冊字數過濾模組
  ModuleSystem.register('charFilter', async function(deps) {
    
    class CharFilterModule extends ModuleSystem.BaseModule {
      constructor(config) {
        super('charFilter', { config });
        this.filters = new Map();
        this.activeFilters = new Map();
        this.uiBindings = new Map();
        this.version = '2.0.0';
      }

      async _doInit() {
        console.log('🔧 初始化字數過濾模組...');
        
        this.registerDefaultFilters();
        this.bindConfigEvents();
        this.restoreFiltersFromConfig();
      }

      // 註冊預設過濾器配置
      registerDefaultFilters() {
        // dictMaker 頁面過濾器
        this.registerFilter('dictMaker', [
          { id: 'fcjOpt_singleChar', label: '單字', length: 1, default: true },
          { id: 'fcjOpt_2char', label: '2字', length: 2, default: true },
          { id: 'fcjOpt_3char', label: '3字', length: 3, default: true },
          { id: 'fcjOpt_4char', label: '4字', length: 4, default: true },
          { id: 'fcjOpt_5pluschar', label: '5字以上', length: '5+', default: true }
        ]);

        // words 頁面過濾器
        this.registerFilter('words', [
          { id: 'freeCjSingleCharCheckbox', label: '單字', length: 1, default: true },
          { id: 'freeCj2charCheckbox', label: '2字', length: 2, default: true },
          { id: 'freeCj3charCheckbox', label: '3字', length: 3, default: true },
          { id: 'freeCj4charCheckbox', label: '4字', length: 4, default: true },
          { id: 'freeCj5pluscharCheckbox', label: '5字以上', length: '5+', default: true }
        ]);

        // 通用過濾器
        this.registerFilter('generic', [
          { id: 'char1', label: '單字', length: 1, default: true },
          { id: 'char2', label: '2字', length: 2, default: true },
          { id: 'char3', label: '3字', length: 3, default: true },
          { id: 'char4', label: '4字', length: 4, default: true },
          { id: 'char5plus', label: '5字以上', length: '5+', default: true }
        ]);
      }

      // 註冊過濾器
      registerFilter(name, options, config = {}) {
        const filterConfig = {
          name,
          options: options.map(opt => ({ ...opt })),
          ...config
        };
        
        this.filters.set(name, filterConfig);
        this.emit('filterRegistered', name, filterConfig);
        
        console.log(`📝 註冊字數過濾器: ${name}，包含 ${options.length} 個選項`);
        return filterConfig;
      }

      // 獲取過濾器函數
      getFilter(name = 'generic') {
        // 檢查是否有快取的活躍過濾器
        if (this.activeFilters.has(name)) {
          return this.activeFilters.get(name);
        }

        const config = this.filters.get(name);
        if (!config) {
          console.warn(`過濾器 "${name}" 未找到，使用通用過濾器`);
          return this._createGenericFilter();
        }

        const filter = this._createFilter(config);
        this.activeFilters.set(name, filter);
        
        return filter;
      }

      _createFilter(config) {
        return (charLength) => {
          for (const option of config.options) {
            if (this._matchesLength(option.length, charLength)) {
              return this._isOptionEnabled(config.name, option);
            }
          }
          return true; // 預設允許
        };
      }

      _createGenericFilter() {
        return (charLength) => {
          // 嘗試通用的配置檢查
          const configKey = charLength === 1 ? 'singleChar' : 
                           charLength >= 5 ? '5pluschar' : `${charLength}char`;
          
          return this.dep('config').get(`charFilter.generic.${configKey}`, true);
        };
      }

      _matchesLength(optionLength, charLength) {
        if (optionLength === charLength) return true;
        if (optionLength === '5+' && charLength >= 5) return true;
        return false;
      }

      _isOptionEnabled(filterName, option) {
        // 1. 檢查 UI 元素
        const $checkbox = $(`#${option.id}`);
        if ($checkbox.length) {
          return $checkbox.is(':checked');
        }

        // 2. 檢查配置
        const configKey = `charFilter.${filterName}.${option.id}`;
        return this.dep('config').get(configKey, option.default);
      }

      // 創建 UI 元素
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

        // 檢查是否使用現有組件
        if (this._tryUseExistingComponent(containerId, filterName, config, options)) {
          return true;
        }

        // 手動創建 UI
        this._createManualUI($container, config, options);
        this._bindUIEvents(config);
        
        return true;
      }

      _tryUseExistingComponent(containerId, filterName, config, options) {
        // 嘗試使用 CharLengthOptions 組件
        if (typeof global.CharLengthOptions !== 'undefined' && options.useComponent !== false) {
          try {
            global.CharLengthOptions.inject(containerId, {
              options: config.options,
              filterId: filterName
            });
            
            this.uiBindings.set(filterName, { 
              type: 'component', 
              container: containerId 
            });
            
            return true;
          } catch (e) {
            console.warn('CharLengthOptions 組件使用失敗，回退到手動創建:', e);
          }
        }
        
        return false;
      }

      _createManualUI($container, config, options = {}) {
        const { 
          layout = 'horizontal',
          className = 'char-filter-group',
          labelStyle = 'margin-right: 8px; font-size: 13px;'
        } = options;

        const html = config.options.map(opt => `
          <label class="char-filter-option" style="${labelStyle}">
            <input type="checkbox" 
                   id="${opt.id}" 
                   data-filter="${config.name}"
                   data-length="${opt.length}"
                   ${opt.default ? 'checked' : ''}> 
            ${opt.label}
          </label>
        `).join(layout === 'vertical' ? '<br>' : '');

        $container.html(`<div class="${className}">${html}</div>`);
        
        this.uiBindings.set(config.name, { 
          type: 'manual', 
          container: $container[0],
          options: config.options
        });
      }

      _bindUIEvents(config) {
        const checkboxSelector = config.options.map(opt => `#${opt.id}`).join(', ');
        
        // 移除舊的事件監聽器避免重複
        $(document).off(`change.charFilter.${config.name}`, checkboxSelector);
        
        // 綁定新的事件監聽器
        $(document).on(`change.charFilter.${config.name}`, checkboxSelector, (e) => {
          const $checkbox = $(e.target);
          const filterName = $checkbox.data('filter');
          const optionId = $checkbox.attr('id');
          const checked = $checkbox.is(':checked');
          
          // 更新配置
          const configKey = `charFilter.${filterName}.${optionId}`;
          this.dep('config').set(configKey, checked);
          
          // 驗證至少選擇一個
          this._validateSelection(config);
          
          // 清除快取的過濾器
          this.activeFilters.delete(filterName);
          
          this.emit('filterChanged', { filterName, optionId, checked });
        });
      }

      _validateSelection(config) {
        const hasAnyChecked = config.options.some(opt => {
          const $checkbox = $(`#${opt.id}`);
          return $checkbox.length && $checkbox.is(':checked');
        });

        if (!hasAnyChecked) {
          // 尋找剛才取消選擇的 checkbox 並復原
          const $lastChanged = $(document.activeElement);
          if ($lastChanged.is(':checkbox')) {
            $lastChanged.prop('checked', true);
          }
          
          this.emit('validationError', {
            type: 'minSelection',
            message: '至少要選擇一個字數選項'
          });
          
          return false;
        }
        
        return true;
      }

      // 設置過濾器選項
      setOptions(filterName, settings) {
        const config = this.filters.get(filterName);
        if (!config) return false;

        Object.entries(settings).forEach(([optionId, checked]) => {
          // 更新 UI
          const $checkbox = $(`#${optionId}`);
          if ($checkbox.length) {
            $checkbox.prop('checked', checked);
          }
          
          // 更新配置
          const configKey = `charFilter.${filterName}.${optionId}`;
          this.dep('config').set(configKey, checked);
        });

        // 清除快取
        this.activeFilters.delete(filterName);
        
        this.emit('optionsChanged', { filterName, settings });
        return true;
      }

      // 重置過濾器
      resetFilter(filterName) {
        const config = this.filters.get(filterName);
        if (!config) return false;

        const defaultSettings = {};
        config.options.forEach(opt => {
          defaultSettings[opt.id] = opt.default;
        });

        return this.setOptions(filterName, defaultSettings);
      }

      // 獲取選中的字數範圍
      getSelectedLengths(filterName) {
        const config = this.filters.get(filterName);
        if (!config) return [];

        return config.options
          .filter(opt => this._isOptionEnabled(filterName, opt))
          .map(opt => opt.length);
      }

      // 綁定配置事件
      bindConfigEvents() {
        // 監聽配置變更並更新 UI
        this.dep('config').on('configChanged', ({ key, value }) => {
          if (key.startsWith('charFilter.')) {
            this._handleConfigChange(key, value);
          }
        });
      }

      _handleConfigChange(key, value) {
        const parts = key.split('.');
        if (parts.length >= 3) {
          const filterName = parts[1];
          const optionId = parts[2];
          
          // 更新對應的 UI 元素
          const $checkbox = $(`#${optionId}`);
          if ($checkbox.length && $checkbox.is(':checkbox')) {
            $checkbox.prop('checked', value === true);
          }
          
          // 清除快取
          this.activeFilters.delete(filterName);
        }
      }

      // 從配置恢復過濾器狀態
      restoreFiltersFromConfig() {
        for (const [filterName, config] of this.filters) {
          config.options.forEach(opt => {
            const configKey = `charFilter.${filterName}.${opt.id}`;
            const saved = this.dep('config').get(configKey);
            
            if (saved !== null) {
              const $checkbox = $(`#${opt.id}`);
              if ($checkbox.length) {
                $checkbox.prop('checked', saved === true);
              }
            }
          });
        }
      }

      // 獲取統計信息
      getStats() {
        return {
          totalFilters: this.filters.size,
          activeFilters: this.activeFilters.size,
          uiBindings: this.uiBindings.size,
          version: this.version
        };
      }

      // 清理資源
      async destroy() {
        // 移除所有事件監聽器
        this.filters.forEach((config) => {
          $(document).off(`change.charFilter.${config.name}`);
        });
        
        this.filters.clear();
        this.activeFilters.clear();
        this.uiBindings.clear();
        
        await super.destroy();
      }
    }

    const charFilterModule = new CharFilterModule(deps.config);
    await charFilterModule.init();

    return charFilterModule;
    
  }, ['config']); // 依賴配置模組

})(window);