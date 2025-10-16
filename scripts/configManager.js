// 統一的配置管理模組
(function(global) {
  'use strict';

  class ConfigManager {
    constructor(namespace = 'rovodev') {
      this.namespace = namespace;
      this.cache = new Map();
    }

    // 統一的偏好設定管理
    _getKey(key) {
      return `${this.namespace}_${key}`;
    }

    get(key, defaultValue = null) {
      const cacheKey = this._getKey(key);
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      try {
        const value = localStorage.getItem(cacheKey);
        const parsed = value === null ? defaultValue : JSON.parse(value);
        this.cache.set(cacheKey, parsed);
        return parsed;
      } catch {
        return defaultValue;
      }
    }

    set(key, value) {
      const cacheKey = this._getKey(key);
      this.cache.set(cacheKey, value);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    }

    remove(key) {
      const cacheKey = this._getKey(key);
      this.cache.delete(cacheKey);
      try {
        localStorage.removeItem(cacheKey);
        return true;
      } catch {
        return false;
      }
    }

    // 批量配置管理
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

    // 綁定UI元素到配置
    bindElement(selector, configKey, defaultValue = null) {
      const $el = $(selector);
      if (!$el.length) return false;

      // 初始化元素值
      const savedValue = this.get(configKey, defaultValue);
      if (savedValue !== null) {
        if ($el.is(':checkbox')) {
          $el.prop('checked', savedValue === true);
        } else {
          $el.val(savedValue);
        }
      }

      // 綁定變更事件
      const eventType = $el.is(':checkbox') ? 'change' : 'input change';
      $el.on(eventType, () => {
        const value = $el.is(':checkbox') ? $el.is(':checked') : $el.val();
        this.set(configKey, value);
      });

      return true;
    }

    // 批量綁定UI元素
    bindElements(configs) {
      const results = {};
      Object.entries(configs).forEach(([selector, config]) => {
        const { key, defaultValue } = typeof config === 'string' 
          ? { key: config, defaultValue: null } 
          : config;
        results[selector] = this.bindElement(selector, key, defaultValue);
      });
      return results;
    }
  }

  // 建立全域實例
  global.ConfigManager = ConfigManager;
  global.commonConfig = new ConfigManager('rovodev_common');

})(window);