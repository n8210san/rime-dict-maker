// CangjieProcessor 整合版 - 統一倉頡編碼處理
(function(global) {
  'use strict';

  class UnifiedCangjieProcessor {
    constructor() {
      this._cjMap = null;
      this._loadPromise = null;
      this.initialized = false;
    }

    // 統一的字典載入方法（整合 utils.js 和 dictMaker.js 的實現）
    async loadDict() {
      if (this._cjMap) return this._cjMap;
      if (this._loadPromise) return this._loadPromise;

      this._loadPromise = this._loadDictInternal();
      try {
        this._cjMap = await this._loadPromise;
        this.initialized = true;
        console.log('倉頡字典載入完成，共', Object.keys(this._cjMap).length, '個字符');
        return this._cjMap;
      } catch (error) {
        this._loadPromise = null; // 重置以允許重試
        throw error;
      }
    }

    async _loadDictInternal() {
      try {
        const resp = await fetch('data/cangjie5.dict.yaml');
        if (!resp.ok) throw new Error(`無法讀取 data/cangjie5.dict.yaml (${resp.status})`);
        
        const text = await resp.text();
        const lines = text.split(/\r?\n/);
        const map = Object.create(null);
        let processedCount = 0;
        
        for (const raw of lines) {
          if (!raw) continue;
          const trimmed = raw.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          
          const first = trimmed[0];
          if (first === '-' || /[A-Za-z]/.test(first)) continue;
          
          // 預期格式：中文字 [tab] 編碼 [tab] 次編碼(可能無)
          const parts = raw.split(/\t+/);
          if (parts.length < 2) continue;
          
          const han = parts[0].trim();
          const code = parts[1].trim();
          const code2 = (parts[2] || '').trim();
          
          if (!han || !code) continue;
          
          // 若同字多行，以第一筆為主
          if (!(han in map)) {
            map[han] = code + (code2 ? ' ' + code2 : '');
            processedCount++;
          }
        }
        
        if (processedCount === 0) {
          throw new Error('字典檔案格式錯誤或無有效數據');
        }
        
        return map;
      } catch (error) {
        console.error('載入倉頡字典失敗:', error);
        throw error;
      }
    }

    // 統一的速成取碼方法
    pickQuick(codeStr) {
      const main = (codeStr.split(/\s+/)[0] || '').trim();
      const n = main.length;
      if (!n) return '';
      if (n === 1) return main; // 原碼只有一碼，直接用一碼
      // 主碼長度 > 1：一律取左碼 + 右碼
      return main[0] + main[n - 1];
    }

    // 統一的快倉取碼方法
    pickFCJ(codeStr) {
      // 中文單字用 left(2)+right(1)；不可超過原碼長度
      const main = (codeStr.split(/\s+/)[0] || '').trim();
      const n = main.length;
      if (!n) return '';
      if (n === 1) return main;
      if (n === 2) return main; // 已是兩碼
      return main.slice(0, 2) + main[n - 1];
    }

    // 統一的編碼生成方法（整合 utils.js 的 cjMakeFromText）
    async generateCodes(text, mode = 'fcj', options = {}) {
      const {
        append3AtEnd = false,
        charLengthFilter = () => true,
        showCount = false,
        separator = ' '
      } = options;

      const map = await this.loadDict();
      const lines = String(text || '').split(/\r?\n/);
      const out = [];
      const seen = new Set(); // for quick mode de-dup
      const seenFCJ = new Set();
      const delayed3 = [];

      const pushImmediate = (line) => {
        if (!seenFCJ.has(line)) {
          out.push(line);
          seenFCJ.add(line);
        }
      };

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        const match = trimmed.match(/^[\u4e00-\u9fff]+/); // 前綴中文詞
        if (!match) continue;
        
        const phrase = match[0];
        const chars = phrase.split('');
        
        // 使用統一的字數過濾器
        if (!charLengthFilter(chars.length)) continue;

        // 提取原始計數
        let originalCount = '';
        if (showCount) {
          const countMatch = trimmed.slice(phrase.length).match(/\s+(\d+)/);
          originalCount = separator + (countMatch ? countMatch[1] : '3');
        }

        if (mode === 'quick') {
          await this._processQuickMode(chars, map, seen, out, separator, originalCount);
        } else if (mode === 'fcj') {
          await this._processFCJMode(phrase, chars, map, trimmed, append3AtEnd, 
                                    pushImmediate, delayed3, separator, originalCount);
        }
      }

      // 處理延後的3碼
      if (append3AtEnd && delayed3.length) {
        const toDelete = new Set(delayed3);
        for (let k = out.length - 1; k >= 0; k--) {
          if (toDelete.has(out[k])) out.splice(k, 1);
        }
        out.push(...delayed3);
      }

      return out.join('\n');
    }

    async _processQuickMode(chars, map, seen, out, separator, originalCount) {
      for (const han of chars) {
        const code = map[han];
        if (!code) continue;
        
        const newCode = this.pickQuick(code);
        if (!newCode) continue;
        
        const key = han + '\u0001' + newCode;
        if (seen.has(key)) continue;
        
        seen.add(key);
        out.push(`${han}${separator}${newCode}${originalCount}`);
      }
    }

    async _processFCJMode(phrase, chars, map, line, append3AtEnd, 
                         pushImmediate, delayed3, separator, originalCount) {
      if (chars.length === 1) {
        const han = chars[0];
        const code = map[han];
        if (!code) return;
        
        const mainCode = this.pickFCJ(code);
        if (!mainCode) return;
        
        let freq = 0;
        const freqMatch = line.slice(phrase.length).match(/\s+(\d+)/);
        if (freqMatch) {
          const parsed = parseInt(freqMatch[1], 10);
          if (Number.isFinite(parsed)) freq = parsed;
        }

        if (freq > 1000 && mainCode.length === 3 && append3AtEnd) {
          delayed3.push(`${han}${separator}${mainCode}${originalCount}`);
          pushImmediate(`${han}${separator}${mainCode[0]}${mainCode[mainCode.length-1]}${originalCount}`);
        } else {
          pushImmediate(`${han}${separator}${mainCode}${originalCount}`);
        }
      } else {
        // 多字詞處理
        let composed = '';
        let allOk = true;
        
        for (const han of chars) {
          const code = map[han];
          if (!code) {
            allOk = false;
            break;
          }
          const piece = this.pickQuick(code);
          if (!piece) {
            allOk = false;
            break;
          }
          composed += piece;
        }
        
        if (allOk && composed) {
          pushImmediate(`${phrase}${separator}${composed}${originalCount}`);
        }
      }
    }

    // 獲取單個字符編碼
    async getCharCode(char) {
      const map = await this.loadDict();
      return map[char] || null;
    }

    // 批量獲取字符編碼
    async getCharCodes(chars) {
      const map = await this.loadDict();
      const result = {};
      for (const char of chars) {
        result[char] = map[char] || null;
      }
      return result;
    }

    // 檢查字符是否有編碼
    async hasCode(char) {
      const map = await this.loadDict();
      return char in map;
    }

    // 獲取統計資訊
    async getStats() {
      const map = await this.loadDict();
      return {
        totalChars: Object.keys(map).length,
        loaded: this.initialized
      };
    }
  }

  // 建立全域統一實例
  const unifiedCangjie = new UnifiedCangjieProcessor();

  // 向後相容的全域函數 - 優先使用 cangjieProcessor（避免重複定義）
  // 注意：如果 cangjieProcessor.js 已載入，則使用其實現；否則使用本地實現
  if (!global.loadCangjieDict) {
    global.loadCangjieDict = () => {
      if (global.cangjieProcessor && typeof global.cangjieProcessor.loadCangjieDict === 'function') {
        return global.cangjieProcessor.loadCangjieDict();
      }
      return unifiedCangjie.loadDict();
    };
  }
  
  if (!global.pickQuick) {
    global.pickQuick = (code) => {
      if (global.cangjieProcessor && typeof global.cangjieProcessor.pickQuick === 'function') {
        return global.cangjieProcessor.pickQuick(code);
      }
      return unifiedCangjie.pickQuick(code);
    };
  }
  
  if (!global.pickFCJ) {
    global.pickFCJ = (code) => {
      if (global.cangjieProcessor && typeof global.cangjieProcessor.pickFCJ === 'function') {
        return global.cangjieProcessor.pickFCJ(code);
      }
      return unifiedCangjie.pickFCJ(code);
    };
  }

  // FcjUtils 命名空間整合
  if (!global.FcjUtils) global.FcjUtils = {};
  global.FcjUtils.loadCangjieDict = global.loadCangjieDict;
  global.FcjUtils.pickQuick = global.pickQuick;
  global.FcjUtils.pickFCJ = global.pickFCJ;
  global.FcjUtils.cjMakeFromText = (text, mode, opts) => unifiedCangjie.generateCodes(text, mode, opts);

  // 新的統一API
  global.unifiedCangjie = unifiedCangjie;
  global.UnifiedCangjieProcessor = UnifiedCangjieProcessor;

  // 預載字典（如果配置允許）
  $(async function() {
    try {
      // 檢查是否啟用預載
      const preload = (global.unifiedConfig && global.unifiedConfig.get('common.preloadCangjie', true)) !== false;
      if (preload) {
        console.log('開始預載倉頡字典...');
        await unifiedCangjie.loadDict();
        console.log('倉頡字典預載完成');
      }
    } catch (error) {
      console.warn('倉頡字典預載失敗:', error.message);
    }
  });

})(window);