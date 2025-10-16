// ConfigManager 整合版 - 統一現有配置邏輯
(function(global) {
  'use strict';

  // 統一的配置管理器，整合所有現有配置
  class UnifiedConfigManager {
    constructor() {
      this.cache = new Map();
      this.namespaces = new Map();
      this.initialized = false;
    }

    // 初始化並遷移現有配置
    async init() {
      if (this.initialized) return;
      
      // 遷移現有的各種配置格式
      await this.migrateExistingConfigs();
      this.initialized = true;
      console.log('UnifiedConfigManager 初始化完成');
    }

    // 遷移現有配置邏輯
    async migrateExistingConfigs() {
      // 1. 遷移 dictMaker 的 prefs 系統
      this.migrateDictMakerPrefs();
      
      // 2. 遷移 words.js 的配置
      this.migrateWordsConfig();
      
      // 3. 遷移 utils.js 的複雜配置
      this.migrateUtilsConfig();
      
      // 4. 遷移 CharLengthOptions 配置
      this.migrateCharLengthConfig();
      
      // 5. 遷移編碼選擇配置
      this.migrateEncodingConfig();
    }

    // 1. 遷移 dictMaker.js 的 prefs 系統
    migrateDictMakerPrefs() {
      const dictMakerKeys = [
        'fcjOpt_freq1000_code3_to_code2',
        'fcjOpt_singleChar', 'fcjOpt_2char', 'fcjOpt_3char', 'fcjOpt_4char', 'fcjOpt_5pluschar',
        'countOpt', 'separatorOpt', 'rangeInput'
      ];

      dictMakerKeys.forEach(key => {
        try {
          const oldKey = `dict_maker.${key}`;
          const value = localStorage.getItem(oldKey);
          if (value !== null) {
            this.set(`dictMaker.${key}`, JSON.parse(value));
          }
        } catch (e) {
          console.warn(`遷移 dictMaker 配置失敗: ${key}`, e);
        }
      });
    }

    // 2. 遷移 words.js 配置
    migrateWordsConfig() {
      try {
        const oldConfig = localStorage.getItem('rovodev_words_config');
        if (oldConfig) {
          const parsed = JSON.parse(oldConfig);
          Object.entries(parsed).forEach(([key, value]) => {
            this.set(`words.${key}`, value);
          });
        }
      } catch (e) {
        console.warn('遷移 words 配置失敗:', e);
      }

      // 遷移自訂詞典
      try {
        const customDict = localStorage.getItem('rovodev_custom_dict');
        if (customDict) {
          this.set('words.customDict', JSON.parse(customDict));
        }
      } catch (e) {
        console.warn('遷移自訂詞典失敗:', e);
      }
    }

    // 3. 遷移 utils.js 的複雜配置
    migrateUtilsConfig() {
      try {
        const wordConfig = localStorage.getItem('rovodev_word_config');
        const wordConfigVersion = localStorage.getItem('rovodev_word_config_version');
        
        if (wordConfig) {
          const parsed = JSON.parse(wordConfig);
          this.set('utils.wordConfig', parsed);
          if (wordConfigVersion) {
            this.set('utils.wordConfigVersion', parseInt(wordConfigVersion));
          }
        }
      } catch (e) {
        console.warn('遷移 utils 配置失敗:', e);
      }

      // 遷移伺服器支援狀態
      try {
        const serverSupport = localStorage.getItem('rovodev_server_support');
        if (serverSupport !== null) {
          this.set('utils.serverSupport', serverSupport === 'true');
        }
      } catch (e) {
        console.warn('遷移伺服器支援狀態失敗:', e);
      }
    }

    // 4. 遷移 CharLengthOptions 配置
    migrateCharLengthConfig() {
      const charLengthKeys = [
        'fcjOpt_singleChar', 'fcjOpt_2char', 'fcjOpt_3char', 
        'fcjOpt_4char', 'fcjOpt_5pluschar',
        'freeCjSingleCharCheckbox', 'freeCj2charCheckbox', 'freeCj3charCheckbox',
        'freeCj4charCheckbox', 'freeCj5pluscharCheckbox'
      ];

      charLengthKeys.forEach(key => {
        try {
          const value = localStorage.getItem(key);
          if (value !== null) {
            this.set(`charLength.${key}`, value === 'true');
          }
        } catch (e) {
          console.warn(`遷移字數選項配置失敗: ${key}`, e);
        }
      });
    }

    // 5. 遷移編碼選擇配置
    migrateEncodingConfig() {
      try {
        const encoding = localStorage.getItem('rovodev_encoding');
        if (encoding) {
          this.set('common.encoding', encoding);
        }
      } catch (e) {
        console.warn('遷移編碼配置失敗:', e);
      }
    }

    // 統一的 get/set 介面
    get(key, defaultValue = null) {
      const fullKey = this._normalizeKey(key);
      
      if (this.cache.has(fullKey)) {
        return this.cache.get(fullKey);
      }

      try {
        const value = localStorage.getItem(fullKey);
        const parsed = value === null ? defaultValue : JSON.parse(value);
        this.cache.set(fullKey, parsed);
        return parsed;
      } catch {
        return defaultValue;
      }
    }

    set(key, value) {
      const fullKey = this._normalizeKey(key);
      this.cache.set(fullKey, value);
      
      try {
        localStorage.setItem(fullKey, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    }

    remove(key) {
      const fullKey = this._normalizeKey(key);
      this.cache.delete(fullKey);
      
      try {
        localStorage.removeItem(fullKey);
        return true;
      } catch {
        return false;
      }
    }

    // 標準化 key 名稱
    _normalizeKey(key) {
      return key.startsWith('rovodev_') ? key : `rovodev_unified_${key}`;
    }

    // 向後相容的命名空間支援
    namespace(name) {
      if (!this.namespaces.has(name)) {
        this.namespaces.set(name, new ConfigNamespace(this, name));
      }
      return this.namespaces.get(name);
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

    // UI 自動綁定（整合版）
    bindElement(selector, configKey, options = {}) {
      const {
        defaultValue = null,
        namespace = '',
        event = 'auto'
      } = options;

      const $el = $(selector);
      if (!$el.length) return false;

      const fullKey = namespace ? `${namespace}.${configKey}` : configKey;

      // 初始化元素值
      const savedValue = this.get(fullKey, defaultValue);
      if (savedValue !== null) {
        if ($el.is(':checkbox')) {
          $el.prop('checked', savedValue === true);
        } else {
          $el.val(savedValue);
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

      return true;
    }

    // 批量綁定元素
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

    // 清理舊配置
    cleanupOldConfigs() {
      const oldKeys = [
        'dict_maker.fcjOpt_freq1000_code3_to_code2',
        'dict_maker.countOpt',
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

      console.log('已清理舊配置格式');
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

    bindElements(bindings) {
      return this.manager.bindElements(bindings, this.namespace);
    }
  }

  // 建立全域實例
  const unifiedConfig = new UnifiedConfigManager();

  // 向後相容的 API
  global.unifiedConfig = unifiedConfig;
  global.UnifiedConfigManager = UnifiedConfigManager;

  // dictMaker.js 相容層
  global.prefs = {
    get: (key, defaultValue) => unifiedConfig.get(`dictMaker.${key}`, defaultValue),
    set: (key, value) => unifiedConfig.set(`dictMaker.${key}`, value),
    remove: (key) => unifiedConfig.remove(`dictMaker.${key}`)
  };

  // words.js 相容層  
  global.wordsConfig = unifiedConfig.namespace('words');

  // utils.js 相容層
  global.utilsConfig = unifiedConfig.namespace('utils');

  // 通用配置
  global.commonConfig = unifiedConfig.namespace('common');

  // 自動初始化
  $(async function() {
    try {
      await unifiedConfig.init();
      console.log('統一配置管理器已就緒');
    } catch (error) {
      console.error('配置管理器初始化失敗:', error);
    }
  });

})(window);