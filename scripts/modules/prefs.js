/**
 * prefs.js - 偏好設定管理模組
 * 
 * 職責：
 * - 提供 localStorage 基礎存取介面 (prefs)
 * - 提供偏好設定管理器 (PrefsManager)
 * - 處理 checkbox、select、input 的持久化
 * 
 * API:
 * - prefs.get(key, defaultValue)
 * - prefs.set(key, value)
 * - prefs.remove(key)
 * - PrefsManager.init()
 * - PrefsManager.restorePreferences()
 * - PrefsManager.bindEvents()
 */

(function(global) {
  'use strict';

  // 確保 Modules 命名空間存在
  global.Modules = global.Modules || {};

  // ============================================================
  // prefs 物件 - localStorage 基礎存取層（支援 unifiedConfig 委派）
  // ============================================================
  const prefs = {
    /**
     * 偵測是否存在 unifiedConfig（執行期特徵檢測）
     * @returns {boolean} - 是否存在 unifiedConfig
     */
    _hasUnifiedConfig() {
      return typeof global.unifiedConfig !== 'undefined' && 
             global.unifiedConfig !== null &&
             typeof global.unifiedConfig.get === 'function';
    },

    /**
     * 執行一次性資料遷移（從 legacy 到 unified）
     * 僅在 unified 尚無對應值時進行遷移
     */
    _migrateToUnified() {
      if (!this._hasUnifiedConfig() || this._migrated) return;
      
      try {
        const keysToMigrate = [
          'fcjOpt_freq1000_code3_to_code2',
          'fcjOpt_singleChar', 'fcjOpt_2char', 'fcjOpt_3char', 'fcjOpt_4char', 'fcjOpt_5pluschar',
          'countOpt', 'separatorOpt', 'rangeInput',
          'rootOrderOpt', 'formatOpt'
        ];

        keysToMigrate.forEach(key => {
          const unifiedKey = `dictMaker.${key}`;
          const unifiedValue = global.unifiedConfig.get(unifiedKey);
          
          // 只在 unified 沒有值時才從 legacy 遷移
          if (unifiedValue === null || unifiedValue === undefined) {
            const legacyKey = `dict_maker.${key}`;
            const legacyValue = localStorage.getItem(legacyKey);
            if (legacyValue !== null) {
              try {
                global.unifiedConfig.set(unifiedKey, JSON.parse(legacyValue));
              } catch (e) {
                console.warn(`遷移 ${key} 失敗:`, e);
              }
            }
          }
        });

        this._migrated = true;
        console.log('✅ prefs 已完成向 unifiedConfig 遷移');
      } catch (e) {
        console.warn('prefs 遷移過程發生錯誤:', e);
      }
    },

    /**
     * 生成帶前綴的 localStorage 鍵名（legacy 模式）
     * @param {string} key - 鍵名
     * @returns {string} - 帶前綴的完整鍵名
     */
    _prefKey(key) {
      return 'dict_maker.' + key;
    },

    /**
     * 從 localStorage 讀取值（支援 unifiedConfig 委派）
     * @param {string} key - 鍵名
     * @param {*} defVal - 預設值
     * @returns {*} - 讀取的值或預設值
     */
    get(key, defVal = null) {
      // 檢測 unifiedConfig 是否存在
      if (this._hasUnifiedConfig()) {
        // 執行一次性遷移（如果尚未執行）
        this._migrateToUnified();
        
        // 委派給 unifiedConfig
        try {
          return global.unifiedConfig.get(`dictMaker.${key}`, defVal);
        } catch (e) {
          console.warn(`unifiedConfig.get 失敗，fallback 到 legacy: ${key}`, e);
        }
      }
      
      // Fallback 到 legacy localStorage
      try {
        const v = localStorage.getItem(this._prefKey(key));
        return v === null ? defVal : JSON.parse(v);
      } catch {
        return defVal;
      }
    },

    /**
     * 寫入值到 localStorage（支援 unifiedConfig 委派）
     * @param {string} key - 鍵名
     * @param {*} val - 要儲存的值
     */
    set(key, val) {
      // 檢測 unifiedConfig 是否存在
      if (this._hasUnifiedConfig()) {
        // 執行一次性遷移（如果尚未執行）
        this._migrateToUnified();
        
        // 委派給 unifiedConfig
        try {
          global.unifiedConfig.set(`dictMaker.${key}`, val);
          return;
        } catch (e) {
          console.warn(`unifiedConfig.set 失敗，fallback 到 legacy: ${key}`, e);
        }
      }
      
      // Fallback 到 legacy localStorage
      try {
        localStorage.setItem(this._prefKey(key), JSON.stringify(val));
      } catch {}
    },

    /**
     * 從 localStorage 移除值（支援 unifiedConfig 委派）
     * @param {string} key - 鍵名
     */
    remove(key) {
      // 檢測 unifiedConfig 是否存在
      if (this._hasUnifiedConfig()) {
        // 委派給 unifiedConfig
        try {
          global.unifiedConfig.remove(`dictMaker.${key}`);
          return;
        } catch (e) {
          console.warn(`unifiedConfig.remove 失敗，fallback 到 legacy: ${key}`, e);
        }
      }
      
      // Fallback 到 legacy localStorage
      try {
        localStorage.removeItem(this._prefKey(key));
      } catch {}
    }
  };

  // ============================================================
  // PrefsManager - 偏好設定管理器
  // ============================================================
  const PrefsManager = {
    /**
     * 配置定義 - 所有需要持久化的 UI 元素
     */
    configs: {
      // checkbox 項目
      checkboxes: [
        { id: 'fcjOpt_freq1000_code3_to_code2', defaultValue: false },
        { id: 'fcjOpt_singleChar', defaultValue: true },
        { id: 'fcjOpt_2char', defaultValue: true },
        { id: 'fcjOpt_3char', defaultValue: true },
        { id: 'fcjOpt_4char', defaultValue: true },
        { id: 'fcjOpt_5pluschar', defaultValue: true },
        { id: 'countOpt', defaultValue: false }
      ],
      // select 項目
      selects: [
        { id: 'separatorOpt', defaultValue: ' ' },
        { id: 'rootOrderOpt', defaultValue: 'after' },
        { id: 'freeCjLimitSelect', defaultValue: '0' },
        { id: 'formatOpt', defaultValue: '' } // 預設為空值，只在用戶明確選擇時才記憶
      ],
      // input 項目
      inputs: [
        { id: 'rangeInput', defaultValue: '>2999' }
      ]
    },

    /**
     * 初始化偏好設定管理器
     * 恢復所有持久化的 UI 狀態並綁定事件
     */
    init() {
      try {
        this.restorePreferences();
        this.bindEvents();
      } catch (e) {
        console.warn('偏好設定初始化失敗:', e);
      }
    },

    /**
     * 恢復所有偏好設定到 UI 元素
     */
    restorePreferences() {
      // legacy: 將舊 freeCjLimit5Checkbox 轉為新下拉設定
      const legacyLimitCheckbox = prefs.get('freeCjLimit5Checkbox');
      if (legacyLimitCheckbox !== null) {
        const converted = (legacyLimitCheckbox === true || legacyLimitCheckbox === '1') ? '5' : '0';
        prefs.set('freeCjLimitSelect', converted);
        prefs.remove('freeCjLimit5Checkbox');
      }

      // 恢復 checkbox 狀態
      this.configs.checkboxes.forEach(({ id, defaultValue }) => {
        const value = prefs.get(id);
        const checked = value !== null ? (value === true || value === '1') : defaultValue;
        $(`#${id}`).prop('checked', checked);
      });

      // 恢復 select 狀態
      this.configs.selects.forEach(({ id, defaultValue }) => {
        const value = prefs.get(id);
        const finalValue = value !== null ? value : defaultValue;
        
        if (id === 'formatOpt') {
          // formatOpt 特殊處理：確保空值時選中空選項
          const $element = $(`#${id}`);
          $element.val(finalValue);
          
          // 如果設定失敗（即沒有對應的 option），強制選中第一個空選項
          if ($element.val() !== finalValue) {
            $element.prop('selectedIndex', 0);
          }
        } else {
          $(`#${id}`).val(finalValue);
        }
      });

      // 恢復 input 狀態
      this.configs.inputs.forEach(({ id, defaultValue }) => {
        const value = prefs.get(id);
        $(`#${id}`).val(value !== null ? value : defaultValue);
      });
    },

    /**
     * 綁定所有 UI 元素的變更事件以自動持久化
     */
    bindEvents() {
      // 綁定 checkbox 事件
      this.configs.checkboxes.forEach(({ id }) => {
        $(`#${id}`).on('change', function() {
          prefs.set(id, this.checked === true);
        });
      });

      // 綁定 select 事件
      this.configs.selects.forEach(({ id }) => {
        $(`#${id}`).on('change', function() {
          if (id === 'formatOpt') {
            // formatOpt 特殊邏輯：只在有明確選擇時才記憶，空值時移除
            if (this.value && this.value !== '') {
              prefs.set(id, this.value);
            } else {
              prefs.remove(id);
            }
          } else {
            // 其他 select 元素正常處理
            prefs.set(id, this.value);
          }
        });
      });

      // 綁定 input 事件
      this.configs.inputs.forEach(({ id }) => {
        $(`#${id}`).on('input change', function() {
          prefs.set(id, this.value);
        });
      });
    }
  };

  // ============================================================
  // 模組註冊與向後相容
  // ============================================================
  
  // 註冊到 Modules 命名空間
  global.Modules.prefs = {
    prefs: prefs,
    PrefsManager: PrefsManager
  };

  // 向後相容：直接掛載到全域
  global.prefs = prefs;
  global.PrefsManager = PrefsManager;

  // 開發模式標記
  if (typeof console !== 'undefined' && console.info) {
    console.info('✅ prefs.js 模組已載入');
  }

})(window);
