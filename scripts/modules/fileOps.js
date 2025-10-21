/**
 * fileOps.js - 檔案操作模組
 * 
 * 職責：
 * - 提供文字檔案下載功能
 * - 提供輸出轉輸入功能（nextStep）
 * - 整合時間戳格式化用於檔名生成
 * 
 * API:
 * - FileOps.download(text, filename)
 * - FileOps.moveOutputToInput(fromId, toId)
 */

(function(global) {
  'use strict';

  // 確保 Modules 命名空間存在
  global.Modules = global.Modules || {};

  // ============================================================
  // FileOps 物件 - 檔案操作函式集合
  // ============================================================
  const FileOps = {
    /**
     * 下載文字內容為檔案
     * @param {string} text - 要下載的文字內容
     * @param {string} filename - 檔名（可選，預設使用時間戳）
     */
    download(text, filename) {
      const data = text || '';
      const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `dict_output_${formatTimestamp()}.txt`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 0);
    },

    /**
     * 將輸出區域內容移動到輸入區域
     * @param {string} fromId - 來源 textarea 的選擇器（預設 '#outputTextarea'）
     * @param {string} toId - 目標 textarea 的選擇器（預設 '#inputTextarea'）
     */
    moveOutputToInput(fromId = '#outputTextarea', toId = '#inputTextarea') {
      const outputData = $(fromId).val() || '';
      $(toId).val(outputData);
      
      // 更新狀態
      const $meta = $('#outputMeta');
      if ($meta.length) {
        $meta.text('輸出已轉移到輸入區域');
      }
    }
  };

  // ============================================================
  // 模組註冊與向後相容
  // ============================================================
  
  // 註冊到 Modules 命名空間
  global.Modules.fileOps = FileOps;

  // 向後相容：掛載個別函式到全域
  global.downloadText = FileOps.download;
  global.moveOutputToInput = FileOps.moveOutputToInput;
  
  // nextStep 是原有的全域函式名稱，指向 moveOutputToInput
  global.nextStep = FileOps.moveOutputToInput;

  // 開發模式標記
  if (typeof console !== 'undefined' && console.info) {
    console.info('✅ fileOps.js 模組已載入');
  }

})(window);
