// 應用程式主控制器 - 現代化重構版
(function(global) {
  'use strict';

  // 註冊應用程式模組
  ModuleSystem.register('app', async function(deps) {
    
    class AppModule extends ModuleSystem.BaseModule {
      constructor(config, ui, cangjie, charFilter) {
        super('app', { config, ui, cangjie, charFilter });
        this.pageType = this.detectPageType();
        this.initialized = false;
        this.version = '2.0.0';
      }

      async _doInit() {
        console.log(`🚀 初始化應用程式 (${this.pageType})...`);
        
        await this.setupPage();
        this.bindAppEvents();
        this.setupCompatibilityLayer();
        
        this.initialized = true;
        this.emit('appReady', { pageType: this.pageType });
      }

      detectPageType() {
        if ($('#dictMakerCharOptions').length || $('#sortDictBtn').length) {
          return 'dictMaker';
        } else if ($('#wordsCharOptions').length || $('#jiebaBtn').length) {
          return 'words';
        }
        return 'unknown';
      }

      async setupPage() {
        if (this.pageType === 'dictMaker') {
          await this.setupDictMakerPage();
        } else if (this.pageType === 'words') {
          await this.setupWordsPage();
        }
      }

      async setupDictMakerPage() {
        console.log('🎯 設置字典整理器頁面...');
        
        // 設置字數過濾器
        this.setupCharFilter('dictMaker');
        
        // 綁定字典相關按鈕
        this.bindDictMakerButtons();
        
        // 設置配置綁定
        this.setupDictMakerConfig();
      }

      async setupWordsPage() {
        console.log('🎯 設置斷詞整理器頁面...');
        
        // 設置字數過濾器
        this.setupCharFilter('words');
        
        // 綁定斷詞相關按鈕
        this.bindWordsButtons();
        
        // 設置配置綁定
        this.setupWordsConfig();
      }

      setupCharFilter(filterName) {
        try {
          const charFilter = this.dep('charFilter');
          
          // 檢查是否有對應的容器
          const containerId = `#${filterName}CharOptions`;
          if ($(containerId).length) {
            charFilter.createUI(containerId, filterName);
          }
          
        } catch (error) {
          console.warn('字數過濾器設置失敗:', error);
        }
      }

      bindDictMakerButtons() {
        // 速成按鈕
        $('#quickBtn').on('click', async () => {
          await this.runMake('quick');
        });

        // 快倉按鈕
        $('#fcjBtn').on('click', async () => {
          await this.runMake('fcj');
        });

        // 去重按鈕
        $('#dedupeWithCommentsBtn').on('click', async () => {
          await this.dedupeWithComments();
        });

        // 下載按鈕
        $('#downloadBtn').on('click', () => {
          this.dep('ui').downloadOutput();
        });
      }

      bindWordsButtons() {
        // 斷詞按鈕
        $('#jiebaBtn').on('click', () => {
          this.performJiebaCut();
        });

        // 自訂斷詞按鈕
        $('#jiebaCustomBtn').on('click', () => {
          this.openCustomDictModal();
        });

        // freeCj 按鈕
        $('#freeCjBtn').on('click', async () => {
          await this.performFreeCj();
        });

        // Rime 格式按鈕
        $('#RimeBtn').on('click', () => {
          this.performRimeFormat();
        });
      }

      async runMake(mode) {
        try {
          const raw = $('#inputTextarea').val() || '';
          if (!raw.trim()) {
            this.dep('ui').showStatus('請先輸入文字', 'warning');
            return;
          }

          const config = this.dep('config');
          const charFilter = this.dep('charFilter');
          const cangjie = this.dep('cangjie');
          const base = typeof RimeBaseManager !== 'undefined'
            ? RimeBaseManager.getBase()
            : (() => {
                const parsed = parseInt($('#rimeBaseInput').val(), 10);
                return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
              })();
          const baseEnabled = base > 0;

          const defaultLimitAttr = parseInt($('#freeCjLimitSelect').data('default-limit'), 10);
          const freeCjLimit = (typeof getDictMakerFreeCjLimit === 'function')
            ? getDictMakerFreeCjLimit(Number.isFinite(defaultLimitAttr) ? defaultLimitAttr : 0)
            : 0;

          const options = {
            append3AtEnd: (mode === 'fcj') && config.get('dictMaker.fcjOpt_freq1000_code3_to_code2', false),
            charLengthFilter: charFilter.getFilter('dictMaker'),
            showCount: baseEnabled,
            separator: (config.get('dictMaker.separatorOpt', ' ') || ' ').replace(/\\t/g, '\t'),
            freeCjMaxLength: freeCjLimit
          };

          const payloadInfo = typeof transformTextForRimeBase === 'function'
            ? transformTextForRimeBase(raw, base)
            : { text: raw };
          const payload = payloadInfo.text;

          if (typeof config.set === 'function') {
            try { config.set('dictMaker.countOpt', baseEnabled); } catch (_) {}
          }

          const result = await cangjie.generateCodes(payload, mode, options);
          
          if (result.output) {
            this.dep('ui').setOutput(result.output, mode === 'quick' ? '速成編碼' : '快倉編碼');
            
            if (result.errors && result.errors.length > 0) {
              this.dep('ui').showStatus(`處理完成，但有 ${result.errors.length} 個錯誤`, 'warning');
            }
          }
          
        } catch (error) {
          this.dep('ui').showStatus('處理失敗: ' + error.message, 'error');
        }
      }

      performJiebaCut() {
        if (!this.checkJieba()) return;
        
        const text = $('#inputTextarea').val() || '';
        if (!text.trim()) {
          this.dep('ui').showStatus('請先輸入文字', 'warning');
          return;
        }

        call_jieba_cut(text, (result) => {
          this.dep('ui').setOutput(result.join(' '), 'jieba斷詞');
        });
      }

      checkJieba() {
        const ok = typeof call_jieba_cut !== 'undefined';
        if (!ok) {
          this.dep('ui').showStatus('Jieba 斷詞函式未載入，請稍候。', 'warning');
        }
        return ok;
      }

      async performFreeCj() {
        try {
          if (!this.validateFreeCjOptions()) return;

          let text = this.prepareText('dedup');
          
          // 若 jieba 可用先斷詞
          if (this.checkJieba()) {
            text = await new Promise(resolve => {
              call_jieba_cut(text, tokens => resolve(tokens.join('\n')));
            });
          }

          const cangjie = this.dep('cangjie');
          const charFilter = this.dep('charFilter');
          
          const defaultLimitAttr = parseInt($('#freeCjLimitSelect').data('default-limit'), 10);
          const freeCjLimit = (typeof getDictMakerFreeCjLimit === 'function')
            ? getDictMakerFreeCjLimit(Number.isFinite(defaultLimitAttr) ? defaultLimitAttr : 0)
            : 0;

          const result = await cangjie.generateCodes(text, 'fcj', {
            append3AtEnd: true,
            charLengthFilter: charFilter.getFilter('words'),
            freeCjMaxLength: freeCjLimit
          });

          if (result.output) {
            let processed = result.output.replace(/(.+) ([a-z]+)/g, '$2 $1');
            
            // �ˬd�r�ڽX�h�s�ﶵ
            if (freeCjLimit > 0) {
              const limitRegex = new RegExp(`^([a-z]{${freeCjLimit}})[a-z]+`, 'gm');
              processed = processed.replace(limitRegex, '$1');
            }

            this.dep('ui').setOutput(processed, 'freeCj編碼');
          }

        } catch (error) {
          this.dep('ui').showStatus('freeCj 處理失敗: ' + error.message, 'error');
        }
      }

      validateFreeCjOptions() {
        const hasAnyChecked = [
          '#freeCjSingleCharCheckbox',
          '#freeCj2charCheckbox', 
          '#freeCj3charCheckbox',
          '#freeCj4charCheckbox',
          '#freeCj5pluscharCheckbox'
        ].some(id => $(id).is(':checked'));
        
        if (!hasAnyChecked) {
          this.dep('ui').showStatus('警告：至少要選擇一個字數選項', 'error');
          return false;
        }
        return true;
      }

      prepareText(mode) {
        const text = $('#inputTextarea').val() || '';
        if (!text.trim()) return '';

        // 語言過濾邏輯
        return this.langFiltering(text);
      }

      langFiltering(txt) {
        const filterType = $('#langFilterSelect').val() || 'zhen';
        const zh = '\u4e00-\u9fff';
        const jp = '\u3040-\u309f\u30a0-\u30ff';
        const kr = '\uac00-\ud7af';
        const en = 'a-zA-Z';
        
        let pattern;
        switch (filterType) {
          case 'all':
            pattern = `${zh}${jp}${kr}${en}`;
            break;
          case 'cjk':
            pattern = `${zh}${jp}${kr}`;
            break;
          case 'zh':
            pattern = zh;
            break;
          case 'en':
            pattern = en;
            break;
          default:
            pattern = `${zh}${en}`;
        }
        
        const regex = new RegExp(`[^${pattern}]`, 'g');
        return txt.replace(regex, ' ');
      }

      async dedupeWithComments() {
        const raw = $('#inputTextarea').val() || '';
        if (!raw.trim()) {
          this.dep('ui').showStatus('請先輸入文字', 'warning');
          return;
        }

        try {
          // 簡化的去重邏輯
          const lines = raw.split(/\r?\n/);
          const seen = new Map();
          const result = [];

          for (const line of lines) {
            const trimmed = line.trim();
            
            if (!trimmed || trimmed.startsWith('#')) {
              result.push(line);
              continue;
            }

            const parts = trimmed.split(/\s+/);
            if (parts.length < 2) {
              result.push(line);
              continue;
            }

            let word = '', root = '', count = 1;
            
            if (/^[a-z]+$/.test(parts[0])) {
              root = parts[0];
              word = parts[1];
              if (parts[2] && /^\d+$/.test(parts[2])) count = parseInt(parts[2]);
            } else if (/^[a-z]+$/.test(parts[1])) {
              word = parts[0];
              root = parts[1];
              if (parts[2] && /^\d+$/.test(parts[2])) count = parseInt(parts[2]);
            } else {
              result.push(line);
              continue;
            }

            const key = `${word}|${root}`;
            if (seen.has(key)) {
              seen.get(key).count += count;
            } else {
              const entry = { word, root, count, index: result.length };
              seen.set(key, entry);
              result.push(null); // 佔位符
            }
          }

          // 填入去重後的結果
          const separator = (this.dep('config').get('dictMaker.separatorOpt', ' ') || ' ').replace(/\\t/g, '\t');
          
          for (const entry of seen.values()) {
            result[entry.index] = `${entry.word}${separator}${entry.root}${separator}${entry.count}`;
          }

          const finalResult = result.filter(line => line !== null);
          this.dep('ui').setOutput(finalResult.join('\n'), '去重處理');

        } catch (error) {
          this.dep('ui').showStatus('去重處理失敗: ' + error.message, 'error');
        }
      }

      setupDictMakerConfig() {
        const config = this.dep('config');
        const bindings = {
          '#fcjOpt_freq1000_code3_to_code2': 'freq1000Option',
          '#countOpt': 'showCount',
          '#separatorOpt': 'separator',
          '#rangeInput': 'range'
        };

        config.bindElements(bindings, 'dictMaker');
      }

      setupWordsConfig() {
        const config = this.dep('config');
        const bindings = {
          '#freeCjLimitSelect': 'limitChars',
          '#rimeBaseInput': 'rimeBase',
          '#langFilterSelect': 'langFilter',
          '#sortOrderSelect': 'sortOrder'
        };

        config.bindElements(bindings, 'words');
      }

      bindAppEvents() {
        // 監聽模組事件
        this.dep('cangjie').on('dictLoaded', (data) => {
          console.log(`📚 倉頡字典已載入: ${data.charCount} 字符`);
        });

        this.dep('ui').on('statusChanged', (data) => {
          this.emit('statusUpdate', data);
        });
      }

      setupCompatibilityLayer() {
        // 提供向後相容的全域函數
        global.runMake = this.runMake.bind(this);
        global.setInput = this.dep('ui').setInput.bind(this.dep('ui'));
        global.setOutput = this.dep('ui').setOutput.bind(this.dep('ui'));
        global.setIO = this.dep('ui').setInputOutput.bind(this.dep('ui'));
        
        // FcjUtils 相容層
        if (!global.FcjUtils) global.FcjUtils = {};
        global.FcjUtils.cjMakeFromText = this.dep('cangjie').generateCodes.bind(this.dep('cangjie'));
        global.FcjUtils.updateOptionStatus = this.dep('ui').showStatus.bind(this.dep('ui'));
      }

      getAppStatus() {
        return {
          pageType: this.pageType,
          initialized: this.initialized,
          version: this.version,
          modules: {
            config: this.dep('config').getStats(),
            ui: this.dep('ui').getStats(),
            cangjie: this.dep('cangjie').getStats(),
            charFilter: this.dep('charFilter').getStats()
          }
        };
      }

      async destroy() {
        // 清理全域函數
        delete global.runMake;
        delete global.setInput;
        delete global.setOutput;
        delete global.setIO;
        
        await super.destroy();
      }
    }

    const appModule = new AppModule(deps.config, deps.ui, deps.cangjie, deps.charFilter);
    await appModule.init();

    return appModule;
    
  }, ['config', 'ui', 'cangjie', 'charFilter']); // 依賴所有核心模組

})(window);
