// 從 utils.js 提取的進階功能模組
(function(global) {
  'use strict';

  // === 配置管理功能 (從 utils.js 提取) ===
  class ExtractedConfigManager {
    constructor() {
      this._configCache = null;
      this._serverSupport = null;
    }

    async loadWordConfig() {
      if (this._configCache) return this._configCache;
      
      let serverConfig = null;
      let localConfigData = this._loadConfigFromLocalStorage();
      
      // 嘗試從伺服器載入
      try {
        const resp = await fetch('config/word_config.json');
        if (resp.ok) {
          serverConfig = await resp.json();
        }
      } catch (error) {
        console.warn('載入伺服器配置失敗:', error.message);
      }
      
      // 決定使用哪個配置
      if (serverConfig && localConfigData) {
        const serverTime = new Date(serverConfig.lastModified || 0).getTime();
        const localTime = localConfigData.timestamp || 0;
        
        this._configCache = localTime > serverTime ? localConfigData.config : serverConfig;
      } else if (serverConfig) {
        this._configCache = serverConfig;
        this._saveConfigToLocalStorage();
      } else if (localConfigData) {
        this._configCache = localConfigData.config;
      } else {
        this._configCache = this._getDefaultConfig();
        this._saveConfigToLocalStorage();
      }
      
      return this._configCache;
    }

    _getDefaultConfig() {
      return {
        encoding: { default: "utf-8" },
        sortOrder: { default: "count" },
        freeCj: { 
          limitChars: 5,
          includeSingleChar: true,
          includeWordGroup: true
        }
      };
    }

    _loadConfigFromLocalStorage() {
      try {
        const configStr = localStorage.getItem('rovodev_word_config');
        if (!configStr) return null;
        
        const config = JSON.parse(configStr);
        const timestamp = localStorage.getItem('rovodev_word_config_version');
        
        return {
          config,
          timestamp: timestamp ? parseInt(timestamp) : 0
        };
      } catch (error) {
        return null;
      }
    }

    _saveConfigToLocalStorage() {
      if (!this._configCache) return false;
      
      try {
        localStorage.setItem('rovodev_word_config', JSON.stringify(this._configCache));
        localStorage.setItem('rovodev_word_config_version', Date.now().toString());
        return true;
      } catch (error) {
        return false;
      }
    }
  }

  // === 倉頡編碼功能 (引用 cangjieProcessor.js 避免重複定義) ===
  class ExtractedCangjieManager {
    constructor() {
      // 不再維護自己的快取，直接使用 cangjieProcessor
    }

    async loadCangjieDict() {
      // 優先使用 cangjieProcessor 的實現
      if (global.cangjieProcessor && typeof global.cangjieProcessor.loadCangjieDict === 'function') {
        return await global.cangjieProcessor.loadCangjieDict();
      }
      
      // 降級方案：直接實現（向後相容）
      console.warn('⚠️ cangjieProcessor 未載入，ExtractedCangjieManager 使用降級實現');
      if (this._cjMap) return this._cjMap;
      
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
      
      this._cjMap = map;
      return map;
    }

    pickQuick(codeStr) {
      // 引用 cangjieProcessor 的實現
      if (global.cangjieProcessor && typeof global.cangjieProcessor.pickQuick === 'function') {
        return global.cangjieProcessor.pickQuick(codeStr);
      }
      // 降級實現
      const main = (codeStr.split(/\s+/)[0] || '').trim();
      const n = main.length;
      if (!n) return '';
      if (n === 1) return main;
      return main[0] + main[n - 1];
    }

    pickFCJ(codeStr) {
      // 引用 cangjieProcessor 的實現
      if (global.cangjieProcessor && typeof global.cangjieProcessor.pickFCJ === 'function') {
        return global.cangjieProcessor.pickFCJ(codeStr);
      }
      // 降級實現
      const main = (codeStr.split(/\s+/)[0] || '').trim();
      const n = main.length;
      if (!n) return '';
      if (n === 1) return main;
      if (n === 2) return main;
      return main.slice(0, 2) + main[n - 1];
    }

    async cjMakeFromText(text, mode = 'fcj', opts = {}) {
      const map = await this.loadCangjieDict();
      const lines = String(text || '').split(/\r?\n/);
      const out = [];
      const seen = new Set();
      const seenFCJ = new Set();
      
      const {
        append3AtEnd = false,
        charLengthFilter = () => true,
        showCount = false,
        separator = ' ',
        rootOrder = 'after',
        freeCjMaxLength = 0
      } = opts;

      const pushImmediate = (line) => {
        if (!seenFCJ.has(line)) {
          out.push(line);
          seenFCJ.add(line);
        }
      };

      const delayed3 = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        const match = trimmed.match(/^[\u4e00-\u9fff]+/);
        if (!match) continue;
        
        const phrase = match[0];
        const chars = phrase.split('');
        
        if (!charLengthFilter(chars.length)) continue;

        let originalCount = '';
        if (showCount) {
          const countMatch = trimmed.slice(phrase.length).match(/\s+(\d+)/);
          originalCount = separator + (countMatch ? countMatch[1] : '3');
        }

        if (mode === 'quick') {
          for (const han of chars) {
            const code = map[han];
            if (!code) continue;
            
            const newCode = this.pickQuick(code);
            if (!newCode) continue;
            
            const key = han + '\u0001' + newCode;
            if (seen.has(key)) continue;
            
            seen.add(key);
            
            // Quick 模式本來就是2碼，不需要5碼限制
            const outputLine = rootOrder === 'before' 
              ? `${newCode}${separator}${han}${originalCount}`
              : `${han}${separator}${newCode}${originalCount}`;
            out.push(outputLine);
          }
        } else if (mode === 'fcj') {
          if (chars.length === 1) {
            const han = chars[0];
            const code = map[han];
            if (!code) continue;
            
            const mainCode = this.pickFCJ(code);
            if (!mainCode) continue;
            
            let freq = 0;
            const freqMatch = trimmed.slice(phrase.length).match(/\s+(\d+)/);
            if (freqMatch) {
              const parsed = parseInt(freqMatch[1], 10);
              if (Number.isFinite(parsed)) freq = parsed;
            }

            // 如果啟用5碼限制，截斷字根
            let finalMainCode = mainCode;
            if (freeCjMaxLength > 0 && finalMainCode.length > freeCjMaxLength) {
              finalMainCode = finalMainCode.substring(0, freeCjMaxLength);
            }
            
            if (freq > 1000 && mainCode.length === 3 && append3AtEnd) {
              const delayed3Line = rootOrder === 'before' 
                ? `${finalMainCode}${separator}${han}${originalCount}`
                : `${han}${separator}${finalMainCode}${originalCount}`;
              delayed3.push(delayed3Line);
              
              let shortCode = mainCode[0] + mainCode[mainCode.length-1];
              if (freeCjMaxLength > 0 && shortCode.length > freeCjMaxLength) {
                shortCode = shortCode.substring(0, freeCjMaxLength);
              }
              
              const immediateLine = rootOrder === 'before'
                ? `${shortCode}${separator}${han}${originalCount}`
                : `${han}${separator}${shortCode}${originalCount}`;
              pushImmediate(immediateLine);
            } else {
              const outputLine = rootOrder === 'before'
                ? `${finalMainCode}${separator}${han}${originalCount}`
                : `${han}${separator}${finalMainCode}${originalCount}`;
              pushImmediate(outputLine);
            }
          } else {
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
              // 如果啟用5碼限制，截斷詞組字根
              let finalComposed = composed;
              if (freeCjMaxLength > 0 && finalComposed.length > freeCjMaxLength) {
                finalComposed = finalComposed.substring(0, freeCjMaxLength);
              }
              
              const outputLine = rootOrder === 'before'
                ? `${finalComposed}${separator}${phrase}${originalCount}`
                : `${phrase}${separator}${finalComposed}${originalCount}`;
              pushImmediate(outputLine);
            }
          }
        }
      }

      if (append3AtEnd && delayed3.length) {
        const toDelete = new Set(delayed3);
        for (let k = out.length - 1; k >= 0; k--) {
          if (toDelete.has(out[k])) out.splice(k, 1);
        }
        out.push(...delayed3);
      }

      return out.join('\n');
    }
  }

  // === 狀態管理功能 ===
  class ExtractedStatusManager {
    updateOptionStatus(message, type = 'info', timeout = 5000) {
      const $status = $('#option_status, #excuted_result');
      const colors = {
        success: 'green',
        warning: 'orange', 
        error: 'red',
        info: 'blue'
      };
      
      $status.text(message).css('color', colors[type] || 'black');
      
      if (timeout > 0 && type !== 'error') {
        setTimeout(() => {
          if ($status.text() === message) {
            $status.text('').css('color', '');
          }
        }, timeout);
      }
    }

    ensureJiebaReady() {
      let tries = 100;
      const tick = () => {
        if (typeof global.jieba_cut === 'function') {
          $('#pageTitle').css({ borderColor: '#0F0' });
          if (typeof global.resume_jieba_cut === 'function') {
            try { 
              global.resume_jieba_cut(); 
            } catch (e) { 
              console.warn('resume error', e); 
            }
          }
        } else if (tries-- > 0) {
          setTimeout(tick, 100);
        } else {
          console.warn('Jieba not ready after waiting');
        }
      };
      tick();
    }
  }

  // 建立管理器實例
  const configManager = new ExtractedConfigManager();
  const cangjieManager = new ExtractedCangjieManager();
  const statusManager = new ExtractedStatusManager();

  // 暴露API
  const ExtractedFeatures = {
    configManager,
    cangjieManager, 
    statusManager,
    
    // 便利函數
    loadWordConfig: () => configManager.loadWordConfig(),
    loadCangjieDict: () => cangjieManager.loadCangjieDict(),
    pickQuick: (code) => cangjieManager.pickQuick(code),
    pickFCJ: (code) => cangjieManager.pickFCJ(code),
    cjMakeFromText: (text, mode, opts) => cangjieManager.cjMakeFromText(text, mode, opts),
    updateOptionStatus: (msg, type, timeout) => statusManager.updateOptionStatus(msg, type, timeout),
    ensureJiebaReady: () => statusManager.ensureJiebaReady()
  };

  global.ExtractedFeatures = ExtractedFeatures;

  // 向後相容性
  global.FcjUtils = ExtractedFeatures;

})(window);
