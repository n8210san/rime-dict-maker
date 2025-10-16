// 統一的倉頡編碼處理模組
(function(global) {
  'use strict';

  class CangjieProcessor {
    constructor() {
      this._cjMap = null;
      this._loadPromise = null;
    }

    // 載入倉頡字典
    async loadDict() {
      if (this._cjMap) return this._cjMap;
      if (this._loadPromise) return this._loadPromise;

      this._loadPromise = this._loadDictInternal();
      this._cjMap = await this._loadPromise;
      return this._cjMap;
    }

    async _loadDictInternal() {
      try {
        const resp = await fetch('data/cangjie5.dict.yaml');
        if (!resp.ok) throw new Error('無法讀取 data/cangjie5.dict.yaml');
        
        const text = await resp.text();
        const lines = text.split(/\r?\n/);
        const map = Object.create(null);
        
        for (const raw of lines) {
          if (!raw) continue;
          const trimmed = raw.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          
          const first = trimmed[0];
          if (first === '-' || /[A-Za-z]/.test(first)) continue;
          
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
        
        return map;
      } catch (error) {
        console.error('載入倉頡字典失敗:', error);
        throw error;
      }
    }

    // 速成取碼：左1+右1
    pickQuick(codeStr) {
      const main = (codeStr.split(/\s+/)[0] || '').trim();
      const n = main.length;
      if (!n) return '';
      if (n === 1) return main;
      return main[0] + main[n - 1];
    }

    // 快倉取碼：左2+右1
    pickFCJ(codeStr) {
      const main = (codeStr.split(/\s+/)[0] || '').trim();
      const n = main.length;
      if (!n) return '';
      if (n === 1) return main;
      if (n === 2) return main;
      return main.slice(0, 2) + main[n - 1];
    }

    // 統一的編碼生成方法
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
        
        const match = trimmed.match(/^[\u4e00-\u9fff]+/);
        if (!match) continue;
        
        const phrase = match[0];
        const chars = phrase.split('');
        
        // 提取原始計數
        let originalCount = '';
        if (showCount) {
          const countMatch = trimmed.slice(phrase.length).match(/\s+(\d+)/);
          originalCount = separator + (countMatch ? countMatch[1] : '3');
        }

        if (!charLengthFilter(chars.length)) continue;

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

    // 獲取字符編碼
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
  }

  // 建立全域實例
  global.CangjieProcessor = CangjieProcessor;
  global.cangjieProcessor = new CangjieProcessor();

  // 向後相容的全域函數
  global.loadCangjieDict = () => global.cangjieProcessor.loadDict();
  global.pickQuick = (code) => global.cangjieProcessor.pickQuick(code);
  global.pickFCJ = (code) => global.cangjieProcessor.pickFCJ(code);

})(window);