// 倉頡編碼處理模組
(function(global) {
  'use strict';

  class CangjieProcessor {
    constructor() {
      this._cjMap = null;
    }

    // 讀取並解析 cangjie5.dict.yaml，建立 {漢字: 編碼字串} 映射
    async loadCangjieDict() {
      if (this._cjMap) return this._cjMap;
      
      try {
        const resp = await fetch('data/cangjie5.dict.yaml');
        if (!resp.ok) throw new Error('無法讀取 data/cangjie5.dict.yaml');
        
        const text = await resp.text();
        const map = Object.create(null); // 使用 Object 而非 Map，確保向後相容
        
        const lines = text.split(/\r?\n/);
        for (const raw of lines) {
          if (!raw) continue;
          const trimmed = raw.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          
          const first = trimmed[0];
          if (first === '-' || /[A-Za-z]/.test(first)) continue;
          
          // 使用 tab 分隔符解析 YAML 格式：中文字 [tab] 編碼 [tab] 次編碼(可能無)
          const parts = raw.split(/\t+/);
          if (parts.length < 2) continue;
          
          const han = parts[0].trim();
          const code = parts[1].trim();
          const code2 = (parts[2] || '').trim();
          
          if (!han || !code) continue;
          if (!(han in map)) {
            map[han] = code + (code2 ? ' ' + code2 : '');
          }
        }
        
        this._cjMap = map;
        console.log(`載入倉頡字典：${Object.keys(map).length} 個字根映射`);
        return this._cjMap;
      } catch (error) {
        console.error('載入倉頡字典失敗:', error);
        this._cjMap = Object.create(null); // 空映射避免重複載入
        return this._cjMap;
      }
    }

    // 速成編碼：取左1碼+右1碼
    pickQuick(codeStr) {
      const main = (codeStr.split(/\s+/)[0] || '').trim();
      const n = main.length;
      if (!n) return '';
      if (n === 1) return main; // 原碼只有一碼，直接用一碼
      // 主碼長度 > 1：一律取左碼 + 右碼
      return main[0] + main[n - 1];
    }

    // 快倉編碼：取左2碼+右1碼，不可超過原碼長度
    pickFCJ(codeStr) {
      // 中文單字用 left(2)+right(1)；不可超過原碼長度
      const main = (codeStr.split(/\s+/)[0] || '').trim();
      const n = main.length;
      if (!n) return '';
      if (n === 1) return main;
      if (n === 2) return main; // 已是兩碼
      return main.slice(0, 2) + main[n - 1];
    }

    // 根據模式處理編碼
    processCode(codeStr, mode = 'fcj') {
      switch (mode.toLowerCase()) {
        case 'quick':
          return this.pickQuick(codeStr);
        case 'fcj':
        case 'freecj':
          return this.pickFCJ(codeStr);
        default:
          return codeStr;
      }
    }

    // 批量處理字符編碼
    async processText(text, mode = 'fcj') {
      const cjMap = await this.loadCangjieDict();
      const chars = text.split('');
      const results = [];
      
      for (const char of chars) {
        if (char in cjMap) {
          const code = cjMap[char];
          const processedCode = this.processCode(code, mode);
          results.push({ char, code: processedCode, original: code });
        } else {
          results.push({ char, code: null, original: null });
        }
      }
      
      return results;
    }

    // 清除快取（用於重新載入）
    clearCache() {
      this._cjMap = null;
    }
  }

  // 暴露到全域
  global.CangjieProcessor = CangjieProcessor;
  
  // 建立預設實例
  global.cangjieProcessor = new CangjieProcessor();
  
  // 向後相容的函數
  global.loadCangjieDict = () => global.cangjieProcessor.loadCangjieDict();
  global.pickQuick = (codeStr) => global.cangjieProcessor.pickQuick(codeStr);
  global.pickFCJ = (codeStr) => global.cangjieProcessor.pickFCJ(codeStr);

})(window);