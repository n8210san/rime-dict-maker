/**
 * uiHelpers.js - UI 輔助函式模組
 * 
 * 職責：
 * - 提供通用的 UI 更新輔助函式
 * - 處理輸出區域的計數與狀態顯示
 * - 提供分隔符號取得與時間戳格式化
 * - 提供字數過濾器生成
 * 
 * API:
 * - UIHelpers.getSeparator()
 * - UIHelpers.updateOutputCount(lines)
 * - UIHelpers.updateOutputMeta(title, mode)
 * - UIHelpers.formatTimestamp()
 * - UIHelpers.getCharLengthFilter()
 */

(function(global) {
  'use strict';

  // 確保 Modules 命名空間存在
  global.Modules = global.Modules || {};

  // ============================================================
  // UIHelpers 物件 - UI 輔助函式集合
  // ============================================================
  const UIHelpers = {
    /**
     * 取得當前選定的分隔符號
     * @returns {string} - 分隔符號（處理 \t 轉義）
     */
    getSeparator() {
      return ($('#separatorOpt').val() || ' ').replace(/\\t/g, '\t');
    },

    /**
     * 更新輸出區域的行數計數顯示
     * @param {Array|string|number} lines - 行陣列、文字字串或數字
     */
    updateOutputCount(lines) {
      const $outCount = $('#outputCount');
      if ($outCount.length) {
        const count = Array.isArray(lines) ? lines.length : 
                      typeof lines === 'string' ? lines.split(/\n/).filter(Boolean).length : lines;
        $outCount.text(`總計 ${count} 行`);
      }
    },

    /**
     * 更新輸出區域的 meta 資訊顯示
     * @param {string} title - 顯示標題
     * @param {string|null} mode - 模式 ('quick', 'fcj', 或 null)
     */
    updateOutputMeta(title, mode = null) {
      const $meta = $('#outputMeta');
      if ($meta.length) {
        $meta.text(title);
        $('#flowQuick, #flowFCJ').css({ borderColor: '#ccc' });
        if (mode === 'quick') $('#flowQuick').css({ borderColor: 'green' });
        else if (mode === 'fcj') $('#flowFCJ').css({ borderColor: 'green' });
      }
    },

    /**
     * 格式化當前時間戳為檔名友善格式
     * @returns {string} - ISO 格式時間戳（冒號和點號替換為連字號）
     */
    formatTimestamp() {
      return new Date().toISOString().replace(/[:.]/g, '-');
    },

    /**
     * 取得字數過濾器函式（整合 CharLengthOptions 組件）
     * @returns {Function} - 過濾器函式 (charLength) => boolean
     */
    getCharLengthFilter() {
      // 檢查組件是否可用
      if (typeof CharLengthOptions !== 'undefined' && CharLengthOptions.getFilter) {
        try {
          return CharLengthOptions.getFilter();
        } catch (e) {
          console.warn('字數選項組件不可用，使用預設邏輯:', e);
        }
      }
      
      // 回退邏輯：沒有UI時預設為不受限
      const checkBox = (id) => {
        const $el = $(id);
        return $el.length ? $el.is(':checked') : true;
      };
      
      return function(charLength) {
        if (charLength === 1) return checkBox('#fcjOpt_singleChar');
        if (charLength === 2) return checkBox('#fcjOpt_2char');
        if (charLength === 3) return checkBox('#fcjOpt_3char');
        if (charLength === 4) return checkBox('#fcjOpt_4char');
        if (charLength >= 5) return checkBox('#fcjOpt_5pluschar');
        return true;
      };
    }
  };

  // ============================================================
  // 模組註冊與向後相容
  // ============================================================
  
  // 註冊到 Modules 命名空間
  global.Modules.uiHelpers = UIHelpers;

  // 向後相容：將個別函式掛載到全域
  global.getSeparator = UIHelpers.getSeparator;
  global.updateOutputCount = UIHelpers.updateOutputCount;
  global.updateOutputMeta = UIHelpers.updateOutputMeta;
  global.formatTimestamp = UIHelpers.formatTimestamp;
  global.getCharLengthFilter = UIHelpers.getCharLengthFilter;

  // 開發模式標記
  if (typeof console !== 'undefined' && console.info) {
    console.info('✅ uiHelpers.js 模組已載入');
  }

})(window);
