/**
 * buttonManager.js - 按鈕管理模組
 * 
 * 職責：
 * - 統一管理所有按鈕的事件綁定
 * - 委派按鈕點擊事件到對應的 handler
 * - 提供可配置的按鈕初始化機制
 * - 使用依賴注入模式，避免硬編碼業務邏輯依賴
 * 
 * 設計模式：
 * - 配置驅動：按鈕配置與綁定邏輯分離
 * - 依賴注入：業務邏輯函式透過 init() 注入
 * - 向後相容：保持原有的全域 API 可用
 * 
 * API:
 * - ButtonManager.init(actions) - 初始化並注入業務邏輯
 * - ButtonManager.bindButtons() - 綁定所有按鈕事件
 * - ButtonManager.handleDownload() - 處理下載功能
 * 
 * 使用範例：
 * ```javascript
 * ButtonManager.init({
 *   onProcessActions: {
 *     dedupeWithComments,
 *     normalizeDictionary,
 *     runMakeQuick: () => runMake('quick'),
 *     runMakeFCJ: () => runMake('fcj'),
 *     nextStep
 *   },
 *   onUtilityActions: {
 *     download: FileOps.download
 *   }
 * });
 * ```
 */

(function(global) {
  'use strict';

  // 確保 Modules 命名空間存在
  global.Modules = global.Modules || {};

  // ============================================================
  // ButtonManager 物件 - 按鈕管理器
  // ============================================================
  const ButtonManager = {
    /**
     * 按鈕配置定義
     * 
     * 配置結構說明：
     * - processButtons: 處理功能按鈕（去重、標準化、生成碼表等）
     * - utilityButtons: 工具按鈕（下載、複製等）
     * 
     * 每個按鈕項目包含：
     * - id: 按鈕的 DOM ID
     * - handler: 點擊事件處理函式（可為函式或函式引用）
     */
    configs: {
      // 處理按鈕配置（從 dictMaker.js 移轉）
      processButtons: [
        { id: 'dedupeWithCommentsBtn', handler: () => dedupeWithComments() },
        { id: 'normalizeBtn', handler: () => normalizeDictionary() },
        { id: 'quickBtn', handler: () => runMake('quick') },
        { id: 'fcjBtn', handler: () => runMake('fcj') },
        { id: 'nextStepBtn', handler: () => nextStep() }
      ],
      
      // 工具按鈕配置（使用字符串引用避免初始化順序問題）
      utilityButtons: [
        { id: 'downloadBtn', handler: function() { return ButtonManager.handleDownload(); } }
      ]
    },

    /**
     * 儲存注入的業務邏輯函式
     * @private
     */
    _injectedActions: null,

    /**
     * 初始化按鈕管理器
     * 
     * @param {Object} actions - 可選的業務邏輯注入物件
     * @param {Object} actions.onProcessActions - 處理功能的函式集合
     * @param {Function} actions.onProcessActions.dedupeWithComments - 去重函式
     * @param {Function} actions.onProcessActions.normalizeDictionary - 標準化函式
     * @param {Function} actions.onProcessActions.runMakeQuick - 速成生成函式
     * @param {Function} actions.onProcessActions.runMakeFCJ - 快倉生成函式
     * @param {Function} actions.onProcessActions.nextStep - 輸出轉輸入函式
     * @param {Object} actions.onUtilityActions - 工具功能的函式集合
     * @param {Function} actions.onUtilityActions.download - 下載函式
     * 
     * 注意：
     * - 若未提供 actions 參數，將使用全域函式（向後相容模式）
     * - 提供 actions 參數時，將覆蓋預設配置（依賴注入模式）
     */
    init(actions) {
      // 儲存注入的業務邏輯
      if (actions) {
        this._injectedActions = actions;
        
        // 動態重建配置（依賴注入模式）
        if (actions.onProcessActions) {
          const pa = actions.onProcessActions;
          this.configs.processButtons = [
            { id: 'dedupeWithCommentsBtn', handler: pa.dedupeWithComments },
            { id: 'normalizeBtn', handler: pa.normalizeDictionary },
            { id: 'quickBtn', handler: pa.runMakeQuick },
            { id: 'fcjBtn', handler: pa.runMakeFCJ },
            { id: 'nextStepBtn', handler: pa.nextStep }
          ].filter(btn => btn.handler); // 過濾未提供的函式
        }
        
        if (actions.onUtilityActions) {
          const ua = actions.onUtilityActions;
          this.configs.utilityButtons = [
            { id: 'downloadBtn', handler: () => this.handleDownload() }
          ].filter(btn => btn.handler);
        }
      }
      
      // 綁定所有按鈕
      this.bindButtons();
    },

    /**
     * 綁定所有按鈕的點擊事件
     * 
     * 實作細節：
     * - 遍歷 processButtons 和 utilityButtons 配置
     * - 使用 jQuery 選擇器找到對應的 DOM 元素
     * - 綁定 click 事件到指定的 handler
     * - 忽略不存在的按鈕（容錯處理）
     */
    bindButtons() {
      // 綁定處理按鈕
      this.configs.processButtons.forEach(({ id, handler }) => {
        const $btn = $(`#${id}`);
        if ($btn.length && typeof handler === 'function') {
          $btn.on('click', handler);
        }
      });

      // 綁定工具按鈕
      this.configs.utilityButtons.forEach(({ id, handler }) => {
        const $btn = $(`#${id}`);
        if ($btn.length && typeof handler === 'function') {
          $btn.on('click', handler);
        }
      });
    },

    /**
     * 處理下載按鈕點擊事件
     * 
     * 功能說明：
     * - 從輸出區域取得文字內容
     * - 生成帶時間戳的檔名
     * - 委派到 FileOps.download() 執行下載
     * 
     * 依賴項：
     * - UIHelpers.formatTimestamp() - 時間戳格式化
     * - FileOps.download() - 檔案下載功能
     * - jQuery - DOM 操作
     * 
     * 向後相容：
     * - 若注入的 actions.onUtilityActions.download 可用，優先使用
     * - 否則回退到全域 FileOps.download
     */
    handleDownload() {
      // 取得輸出內容
      const data = $('#outputTextarea').val() || '';
      
      // 生成檔名（使用 UIHelpers 的時間戳格式化）
      const timestamp = typeof formatTimestamp === 'function' 
        ? formatTimestamp() 
        : new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `dict_output_${timestamp}.txt`;
      
      // 執行下載（優先使用注入的函式，否則使用全域 FileOps）
      const downloadFn = this._injectedActions?.onUtilityActions?.download 
        || (typeof FileOps !== 'undefined' && FileOps.download)
        || global.downloadText; // 最後的回退選項
      
      if (typeof downloadFn === 'function') {
        downloadFn(data, filename);
      } else {
        console.error('下載函式不可用，請確認 FileOps 模組已載入');
        alert('下載功能暫時無法使用，請稍後再試');
      }
    }
  };

  // ============================================================
  // 模組註冊與向後相容
  // ============================================================
  
  // 註冊到 Modules 命名空間
  global.Modules.buttonManager = ButtonManager;

  // 向後相容：直接掛載到全域
  global.ButtonManager = ButtonManager;

  // 開發模式標記
  if (typeof console !== 'undefined' && console.info) {
    console.info('✅ buttonManager.js 模組已載入（完整功能版）');
  }

})(window);
