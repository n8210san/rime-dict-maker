// 倉頡編碼模組 - 現代化重構版
(function(global) {
  'use strict';

  // 註冊倉頡編碼模組
  ModuleSystem.register('cangjie', async function(deps) {
    
    class CangjieModule extends ModuleSystem.BaseModule {
      constructor(config) {
        super('cangjie', { config });
        this._dictMap = null;
        this._loadPromise = null;
        this._stats = {
          totalChars: 0,
          loadTime: 0,
          cacheHits: 0,
          cacheMisses: 0
        };
        this.version = '2.0.0';
      }

      async _doInit() {
        console.log('🔧 初始化倉頡編碼模組...');
        
        // 檢查是否啟用預載
        const preload = this.dep('config').get('cangjie.preload', true);
        if (preload) {
          await this.loadDict();
        }

        this.bindEvents();
      }

      bindEvents() {
        // 監聽配置變更
        this.dep('config').watch('cangjie.preload', (enabled) => {
          if (enabled && !this._dictMap) {
            this.loadDict();
          }
        });
      }

      // 載入倉頡字典
      async loadDict() {
        if (this._dictMap) return this._dictMap;
        if (this._loadPromise) return this._loadPromise;

        this._loadPromise = this._loadDictInternal();
        
        try {
          this._dictMap = await this._loadPromise;
          this.emit('dictLoaded', {
            charCount: this._stats.totalChars,
            loadTime: this._stats.loadTime
          });
          console.log(`✅ 倉頡字典載入完成: ${this._stats.totalChars} 字符, ${this._stats.loadTime}ms`);
          return this._dictMap;
        } catch (error) {
          this._loadPromise = null;
          this.emit('dictLoadError', error);
          throw error;
        }
      }

      async _loadDictInternal() {
        const startTime = performance.now();
        
        try {
          const dictUrl = this.dep('config').get('cangjie.dictUrl', 'data/cangjie5.dict.yaml');
          const resp = await fetch(dictUrl);
          
          if (!resp.ok) {
            throw new Error(`載入字典失敗: ${resp.status} ${resp.statusText}`);
          }
          
          const text = await resp.text();
          const dict = this._parseDict(text);
          
          this._stats.loadTime = Math.round(performance.now() - startTime);
          this._stats.totalChars = Object.keys(dict).length;
          
          return dict;
        } catch (error) {
          console.error('載入倉頡字典失敗:', error);
          throw error;
        }
      }

      _parseDict(text) {
        const lines = text.split(/\r?\n/);
        const dict = Object.create(null);
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
          if (!(han in dict)) {
            dict[han] = code + (code2 ? ' ' + code2 : '');
            processedCount++;
          }
        }
        
        if (processedCount === 0) {
          throw new Error('字典檔案格式錯誤或無有效數據');
        }
        
        return dict;
      }

      // 獲取字符編碼（帶快取）
      async getCode(char) {
        const dict = await this.loadDict();
        
        if (char in dict) {
          this._stats.cacheHits++;
          return dict[char];
        } else {
          this._stats.cacheMisses++;
          return null;
        }
      }

      // 批量獲取字符編碼
      async getCodes(chars) {
        const dict = await this.loadDict();
        const result = {};
        
        for (const char of chars) {
          result[char] = dict[char] || null;
        }
        
        return result;
      }

      // 檢查字符是否有編碼
      async hasCode(char) {
        const dict = await this.loadDict();
        return char in dict;
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

      // 智能編碼生成器
      async generateCodes(text, mode = 'fcj', options = {}) {
        const {
          append3AtEnd = false,
          charLengthFilter = () => true,
          showCount = false,
          separator = ' ',
          preserveSpacing = false,
          errorHandling = 'skip' // 'skip', 'placeholder', 'error'
        } = options;

        const dict = await this.loadDict();
        const lines = String(text || '').split(/\r?\n/);
        const processor = new CodeProcessor(dict, this);
        
        return processor.process(lines, mode, {
          append3AtEnd,
          charLengthFilter,
          showCount,
          separator,
          preserveSpacing,
          errorHandling
        });
      }

      // 獲取統計信息
      getStats() {
        return {
          ...this._stats,
          dictLoaded: !!this._dictMap,
          version: this.version
        };
      }

      // 清理資源
      async destroy() {
        this._dictMap = null;
        this._loadPromise = null;
        await super.destroy();
      }
    }

    // 編碼處理器類
    class CodeProcessor {
      constructor(dict, module) {
        this.dict = dict;
        this.module = module;
      }

      async process(lines, mode, options) {
        const out = [];
        const seen = new Set();
        const seenFCJ = new Set();
        const delayed3 = [];
        const errors = [];

        const pushImmediate = (line) => {
          if (!seenFCJ.has(line)) {
            out.push(line);
            seenFCJ.add(line);
          }
        };

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          const line = lines[lineIndex];
          
          try {
            await this._processLine(line, lineIndex, mode, options, {
              out, seen, seenFCJ, delayed3, pushImmediate
            });
          } catch (error) {
            errors.push({ line: lineIndex + 1, error: error.message });
            
            if (options.errorHandling === 'error') {
              throw new Error(`第 ${lineIndex + 1} 行處理失敗: ${error.message}`);
            }
          }
        }

        // 處理延後的3碼
        if (options.append3AtEnd && delayed3.length) {
          this._handleDelayed3(out, delayed3);
        }

        const result = {
          output: out.join('\n'),
          stats: {
            totalLines: lines.length,
            processedLines: out.length,
            errors: errors.length
          }
        };

        if (errors.length > 0) {
          result.errors = errors;
        }

        return result;
      }

      async _processLine(line, lineIndex, mode, options, context) {
        const trimmed = line.trim();
        if (!trimmed) {
          if (options.preserveSpacing) {
            context.out.push('');
          }
          return;
        }
        
        const match = trimmed.match(/^[\u4e00-\u9fff]+/);
        if (!match) return;
        
        const phrase = match[0];
        const chars = phrase.split('');
        
        // 使用字數過濾器
        if (!options.charLengthFilter(chars.length)) return;

        // 提取原始計數
        let originalCount = '';
        if (options.showCount) {
          const countMatch = trimmed.slice(phrase.length).match(/\s+(\d+)/);
          originalCount = options.separator + (countMatch ? countMatch[1] : '3');
        }

        if (mode === 'quick') {
          await this._processQuickMode(chars, options, context, originalCount);
        } else if (mode === 'fcj') {
          await this._processFCJMode(phrase, chars, trimmed, options, context, originalCount);
        }
      }

      async _processQuickMode(chars, options, context, originalCount) {
        for (const han of chars) {
          const code = this.dict[han];
          if (!code) {
            this._handleMissingCode(han, options);
            continue;
          }
          
          const newCode = this.module.pickQuick(code);
          if (!newCode) continue;
          
          const key = han + '\u0001' + newCode;
          if (context.seen.has(key)) continue;
          
          context.seen.add(key);
          context.out.push(`${han}${options.separator}${newCode}${originalCount}`);
        }
      }

      async _processFCJMode(phrase, chars, line, options, context, originalCount) {
        if (chars.length === 1) {
          await this._processSingleChar(chars[0], line, phrase, options, context, originalCount);
        } else {
          await this._processMultiChar(phrase, chars, options, context, originalCount);
        }
      }

      async _processSingleChar(han, line, phrase, options, context, originalCount) {
        const code = this.dict[han];
        if (!code) {
          this._handleMissingCode(han, options);
          return;
        }
        
        const mainCode = this.module.pickFCJ(code);
        if (!mainCode) return;
        
        let freq = 0;
        const freqMatch = line.slice(phrase.length).match(/\s+(\d+)/);
        if (freqMatch) {
          const parsed = parseInt(freqMatch[1], 10);
          if (Number.isFinite(parsed)) freq = parsed;
        }

        if (freq > 1000 && mainCode.length === 3 && options.append3AtEnd) {
          context.delayed3.push(`${han}${options.separator}${mainCode}${originalCount}`);
          context.pushImmediate(`${han}${options.separator}${mainCode[0]}${mainCode[mainCode.length-1]}${originalCount}`);
        } else {
          context.pushImmediate(`${han}${options.separator}${mainCode}${originalCount}`);
        }
      }

      async _processMultiChar(phrase, chars, options, context, originalCount) {
        let composed = '';
        let allOk = true;
        
        for (const han of chars) {
          const code = this.dict[han];
          if (!code) {
            this._handleMissingCode(han, options);
            allOk = false;
            break;
          }
          const piece = this.module.pickQuick(code);
          if (!piece) {
            allOk = false;
            break;
          }
          composed += piece;
        }
        
        if (allOk && composed) {
          context.pushImmediate(`${phrase}${options.separator}${composed}${originalCount}`);
        }
      }

      _handleMissingCode(char, options) {
        if (options.errorHandling === 'error') {
          throw new Error(`字符 "${char}" 無對應編碼`);
        } else if (options.errorHandling === 'placeholder') {
          return '?';
        }
        // 'skip' - 什麼都不做
      }

      _handleDelayed3(out, delayed3) {
        const toDelete = new Set(delayed3);
        for (let k = out.length - 1; k >= 0; k--) {
          if (toDelete.has(out[k])) {
            out.splice(k, 1);
          }
        }
        out.push(...delayed3);
      }
    }

    const cangjieModule = new CangjieModule(deps.config);
    await cangjieModule.init();

    return cangjieModule;
    
  }, ['config']); // 依賴配置模組

})(window);