// 配置管理模組 - 現代化重構版
(function(global) {
  'use strict';

  // 註冊配置管理模組
  ModuleSystem.register('config', async function() {
    
    class ConfigModule extends ModuleSystem.BaseModule {
      constructor() {
        super('config');
        this.cache = new Map();
        this.watchers = new Map();
        this.namespaces = new Map();
        this.version = '2.0.0';
      }

      async _doInit() {
        console.log('🔧 初始化配置管理模組...');
        await this.migrateOldConfigs();
        this.bindGlobalEvents();
      }

      // 遷移舊版配置
      async migrateOldConfigs() {
        const migrations = [
          this.migrateDictMakerPrefs.bind(this),
          this.migrateWordsConfig.bind(this),
          this.migrateUtilsConfig.bind(this),
          this.migrateCharLengthConfig.bind(this),
          this.migrateEncodingConfig.bind(this)
        ];

        for (const migrate of migrations) {
          try {
            await migrate();
          } catch (error) {
            console.warn('配置遷移警告:', error);
          }
        }

        console.log('✅ 配置遷移完成');
      }

      async migrateDictMakerPrefs() {
        const keys = [
          'fcjOpt_freq1000_code3_to_code2', 'fcjOpt_singleChar', 'fcjOpt_2char', 
          'fcjOpt_3char', 'fcjOpt_4char', 'fcjOpt_5pluschar',
          'countOpt', 'separatorOpt', 'rangeInput'
        ];

        for (const key of keys) {
          const oldKey = `dict_maker.${key}`;
          const value = localStorage.getItem(oldKey);
          if (value !== null) {
            this.set(`dictMaker.${key}`, JSON.parse(value));
          }
        }
      }

      async migrateWordsConfig() {
        const oldConfig = localStorage.getItem('rovodev_words_config');
        if (oldConfig) {
          const parsed = JSON.parse(oldConfig);
          Object.entries(parsed).forEach(([key, value]) => {
            this.set(`words.${key}`, value);
          });
        }

        const customDict = localStorage.getItem('rovodev_custom_dict');
        if (customDict) {
          this.set('words.customDict', JSON.parse(customDict));
        }
      }

      async migrateUtilsConfig() {
        const configs = [
          { old: 'rovodev_word_config', new: 'utils.wordConfig' },
          { old: 'rovodev_word_config_version', new: 'utils.wordConfigVersion', parse: parseInt },
          { old: 'rovodev_server_support', new: 'utils.serverSupport', parse: v => v === 'true' }
        ];

        for (const { old, new: newKey, parse } of configs) {
          const value = localStorage.getItem(old);
          if (value !== null) {
            this.set(newKey, parse ? parse(value) : JSON.parse(value));
          }
        }
      }

      async migrateCharLengthConfig() {
        const keys = [
          'fcjOpt_singleChar', 'fcjOpt_2char', 'fcjOpt_3char', 'fcjOpt_4char', 'fcjOpt_5pluschar',
          'freeCjSingleCharCheckbox', 'freeCj2charCheckbox', 'freeCj3charCheckbox',
          'freeCj4charCheckbox', 'freeCj5pluscharCheckbox'
        ];

        for (const key of keys) {
          const value = localStorage.getItem(key);
          if (value !== null) {
            this.set(`charLength.${key}`, value === 'true');
          }
        }
      }

      async migrateEncodingConfig() {
        const encoding = localStorage.getItem('rovodev_encoding');
        if (encoding) {
          this.set('common.encoding', encoding);
        }
      }

      // 核心 API 方法
      get(key, defaultValue = null) {
        const normalizedKey = this._normalizeKey(key);
        
        if (this.cache.has(normalizedKey)) {
          return this.cache.get(normalizedKey);
        }

        try {
          const value = localStorage.getItem(normalizedKey);
          const parsed = value === null ? defaultValue : JSON.parse(value);
          this.cache.set(normalizedKey, parsed);
          return parsed;
        } catch {
          return defaultValue;
        }
      }

      set(key, value) {
        const normalizedKey = this._normalizeKey(key);
        const oldValue = this.cache.get(normalizedKey);
        
        this.cache.set(normalizedKey, value);
        
        try {
          localStorage.setItem(normalizedKey, JSON.stringify(value));
          this.emit('configChanged', { key, value, oldValue });
          this._notifyWatchers(key, value, oldValue);
          return true;
        } catch {
          return false;
        }
      }

      remove(key) {
        const normalizedKey = this._normalizeKey(key);
        const oldValue = this.cache.get(normalizedKey);
        
        this.cache.delete(normalizedKey);
        
        try {
          localStorage.removeItem(normalizedKey);
          this.emit('configRemoved', { key, oldValue });
          this._notifyWatchers(key, null, oldValue);
          return true;
        } catch {
          return false;
        }
      }

      // 監聽配置變更
      watch(key, callback) {
        if (!this.watchers.has(key)) {
          this.watchers.set(key, new Set());
        }
        this.watchers.get(key).add(callback);

        // 返回取消監聽的函數
        return () => {
          const callbacks = this.watchers.get(key);
          if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
              this.watchers.delete(key);
            }
          }
        };
      }

      _notifyWatchers(key, newValue, oldValue) {
        const callbacks = this.watchers.get(key);
        if (callbacks) {
          callbacks.forEach(callback => {
            try {
              callback(newValue, oldValue, key);
            } catch (error) {
              console.error('配置監聽器錯誤:', error);
            }
          });
        }
      }

      // 命名空間支援
      namespace(name) {
        if (!this.namespaces.has(name)) {
          this.namespaces.set(name, new ConfigNamespace(this, name));
        }
        return this.namespaces.get(name);
      }

      // UI 自動綁定
      bindElement(selector, configKey, options = {}) {
        const {
          defaultValue = null,
          namespace = '',
          event = 'auto',
          immediate = true
        } = options;

        const $el = $(selector);
        if (!$el.length) return false;

        const fullKey = namespace ? `${namespace}.${configKey}` : configKey;

        // 初始化元素值
        if (immediate) {
          const savedValue = this.get(fullKey, defaultValue);
          if (savedValue !== null) {
            if ($el.is(':checkbox')) {
              $el.prop('checked', savedValue === true);
            } else {
              $el.val(savedValue);
            }
          }
        }

        // 自動檢測事件類型
        let eventType = event;
        if (event === 'auto') {
          eventType = $el.is(':checkbox') ? 'change' : 'input change';
        }

        // 綁定變更事件
        $el.on(eventType, () => {
          const value = $el.is(':checkbox') ? $el.is(':checked') : $el.val();
          this.set(fullKey, value);
        });

        // 監聽配置變更並同步到 UI
        this.watch(fullKey, (newValue) => {
          if ($el.is(':checkbox')) {
            $el.prop('checked', newValue === true);
          } else {
            $el.val(newValue);
          }
        });

        return true;
      }

      // 批量綁定
      bindElements(bindings, namespace = '') {
        const results = {};
        Object.entries(bindings).forEach(([selector, config]) => {
          const configData = typeof config === 'string' 
            ? { key: config } 
            : config;
          
          results[selector] = this.bindElement(selector, configData.key, {
            ...configData,
            namespace
          });
        });
        return results;
      }

      // 批量操作
      getMultiple(keys) {
        const result = {};
        keys.forEach(key => {
          result[key] = this.get(key);
        });
        return result;
      }

      setMultiple(configs) {
        const results = {};
        Object.entries(configs).forEach(([key, value]) => {
          results[key] = this.set(key, value);
        });
        return results;
      }

      // 匯出/匯入配置
      export() {
        const config = {};
        for (const [key, value] of this.cache) {
          if (key.startsWith('rovodev_unified_')) {
            const cleanKey = key.replace('rovodev_unified_', '');
            config[cleanKey] = value;
          }
        }
        return config;
      }

      import(config) {
        Object.entries(config).forEach(([key, value]) => {
          this.set(key, value);
        });
      }

      // 清理舊配置
      cleanup() {
        const oldKeys = [
          'dict_maker.fcjOpt_freq1000_code3_to_code2',
          'rovodev_words_config',
          'rovodev_custom_dict', 
          'rovodev_word_config',
          'rovodev_encoding'
        ];

        oldKeys.forEach(key => {
          try {
            localStorage.removeItem(key);
          } catch {}
        });

        console.log('🧹 已清理舊配置格式');
      }

      // 工具方法
      _normalizeKey(key) {
        return key.startsWith('rovodev_') ? key : `rovodev_unified_${key}`;
      }

      bindGlobalEvents() {
        // 監聽在線/離線狀態
        window.addEventListener('online', () => {
          this.emit('networkOnline');
        });

        window.addEventListener('offline', () => {
          this.emit('networkOffline');
        });
      }

      // 獲取統計信息
      getStats() {
        return {
          cacheSize: this.cache.size,
          watcherCount: this.watchers.size,
          namespaceCount: this.namespaces.size,
          version: this.version
        };
      }
    }

    // 配置命名空間類
    class ConfigNamespace {
      constructor(manager, namespace) {
        this.manager = manager;
        this.namespace = namespace;
      }

      get(key, defaultValue) {
        return this.manager.get(`${this.namespace}.${key}`, defaultValue);
      }

      set(key, value) {
        return this.manager.set(`${this.namespace}.${key}`, value);
      }

      remove(key) {
        return this.manager.remove(`${this.namespace}.${key}`);
      }

      watch(key, callback) {
        return this.manager.watch(`${this.namespace}.${key}`, callback);
      }

      bindElements(bindings) {
        return this.manager.bindElements(bindings, this.namespace);
      }
    }

    const configModule = new ConfigModule();
    await configModule.init();

    return configModule;
  });

})(window);