// 向後相容性保證層 - 確保現有代碼無縫運行
(function(global) {
  'use strict';

  // 等待所有整合模組載入完成
  $(function() {
    console.log('🔄 檢查向後相容性...');

    // 1. 確保 dictMaker.js 中的函數可用
    if (typeof global.buildRangeFilter !== 'function') {
      console.warn('buildRangeFilter 未定義，可能影響範圍篩選功能');
    }

    // 2. 確保 getCharLengthFilter 函數統一
    if (typeof global.getCharLengthFilter !== 'function') {
      global.getCharLengthFilter = () => {
        console.warn('使用相容性 getCharLengthFilter');
        return () => true;
      };
    }

    // 3. 確保 runMake 函數可用（dictMaker.js 需要）
    if (typeof global.runMake !== 'function') {
      global.runMake = async function(mode) {
        console.log('使用統一的 runMake 實現:', mode);
        const raw = $('#inputTextarea').val() || '';
        const append3AtEnd = (mode === 'fcj') && $('#fcjOpt_freq1000_code3_to_code2').is(':checked');
        const charLengthFilter = global.unifiedCharFilter ? 
          global.unifiedCharFilter.getFilter('dictMaker') : (() => true);
        const base = typeof global.RimeBaseManager !== 'undefined'
          ? global.RimeBaseManager.getBase()
          : (() => {
              const parsed = parseInt($('#rimeBaseInput').val(), 10);
              return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
            })();
        const baseEnabled = base > 0;
        const separator = ($('#separatorOpt').val() || ' ').replace(/\\t/g, '\t');

        try {
          const payloadInfo = typeof global.transformTextForRimeBase === 'function'
            ? global.transformTextForRimeBase(raw, base)
            : { text: raw };
          const payload = payloadInfo.text;

          const finalText = await global.unifiedCangjie.generateCodes(payload, mode, { 
            append3AtEnd, 
            charLengthFilter, 
            showCount: baseEnabled, 
            separator 
          });
          
          $('#outputTextarea').val(finalText);
          
          const $outCount = $('#outputCount');
          if ($outCount.length) {
            const n = finalText ? finalText.split(/\n/).filter(Boolean).length : 0;
            $outCount.text(`總計 ${n} 行`);
          }
          
          const $meta = $('#outputMeta');
          if ($meta.length) {
            const modeTitle = mode === 'quick' ? '速成流程' : '快倉流程';
            $meta.text(`本次使用：${modeTitle}`);
            $('#flowQuick, #flowFCJ').css({ borderColor: '#ccc' });
            if (mode === 'quick') $('#flowQuick').css({ borderColor: 'green' });
            else $('#flowFCJ').css({ borderColor: 'green' });
          }
        } catch (e) {
          alert(e && e.message ? e.message : '轉碼失敗');
        }
      };
    }

    // 4. 確保 FcjUtils 命名空間完整
    if (!global.FcjUtils) {
      global.FcjUtils = {};
    }

    // 整合統一的 cjMakeFromText
    if (!global.FcjUtils.cjMakeFromText && global.unifiedCangjie) {
      global.FcjUtils.cjMakeFromText = (text, mode, opts) => 
        global.unifiedCangjie.generateCodes(text, mode, opts);
    }

    // 整合統一的字數過濾器
    if (!global.FcjUtils.getCharLengthFilter && global.unifiedCharFilter) {
      global.FcjUtils.getCharLengthFilter = (filterName) => 
        global.unifiedCharFilter.getFilter(filterName || 'default');
    }

    // 5. 確保 words.js 需要的函數可用
    if (typeof global.checkJieba !== 'function') {
      global.checkJieba = function() {
        const ok = typeof global.call_jieba_cut !== 'undefined';
        if (!ok && global.FcjUtils && global.FcjUtils.updateOptionStatus) {
          global.FcjUtils.updateOptionStatus('Jieba 斷詞函式未載入，請稍候。', 'warning');
        }
        return ok;
      };
    }

    // 6. 檢查統一模組的就緒狀態
    const moduleStatus = {
      configManager: !!global.unifiedConfig,
      cangjieProcessor: !!global.unifiedCangjie,
      charFilterManager: !!global.unifiedCharFilter
    };

    console.log('📊 模組狀態:', moduleStatus);

    // 7. 等待倉頡字典預載完成
    if (global.unifiedCangjie && global.unifiedCangjie.initialized === false) {
      console.log('⏳ 等待倉頡字典載入...');
      global.unifiedCangjie.loadDict().then(() => {
        console.log('✅ 倉頡字典已就緒');
      }).catch(error => {
        console.warn('⚠️ 倉頡字典載入失敗:', error.message);
      });
    }

    // 8. 整合配置自動保存
    if (global.unifiedConfig) {
      // 為各種 UI 元素綁定自動配置保存
      const commonBindings = {
        '#encodingSelect': 'encoding',
        '#sortOrderSelect': 'sortOrder',
        '#langFilterSelect': 'langFilter',
        '#rimeBaseInput': 'rimeBase'
      };

      const dictMakerBindings = {
        '#fcjOpt_freq1000_code3_to_code2': 'freq1000Option',
        '#countOpt': 'showCount',
        '#separatorOpt': 'separator',
        '#rangeInput': 'range'
      };

      const wordsBindings = {
        '#freeCjLimitSelect': 'limitChars',
        '#freeCjSingleCharCheckbox': 'includeSingleChar',
        '#freeCjWordGroupCheckbox': 'includeWordGroup'
      };

      // 延遲綁定確保 DOM 元素存在
      setTimeout(() => {
        global.unifiedConfig.bindElements(commonBindings, 'common');
        global.unifiedConfig.bindElements(dictMakerBindings, 'dictMaker');
        global.unifiedConfig.bindElements(wordsBindings, 'words');
      }, 100);
    }

    // 9. 字數過濾器與現有 UI 的整合
    if (global.unifiedCharFilter) {
      // 延遲初始化確保所有元素都已載入
      setTimeout(() => {
        try {
          // 檢測當前頁面類型並設置適當的過濾器
          if ($('#dictMakerCharOptions').length) {
            console.log('🎯 檢測到 dictMaker 頁面，設置對應過濾器');
            // dictMaker 頁面已有 CharLengthOptions 組件，無需額外處理
          } else if ($('#wordsCharOptions').length) {
            console.log('🎯 檢測到 words 頁面，設置對應過濾器');
            // words 頁面已有 CharLengthOptions 組件，無需額外處理
          }
        } catch (error) {
          console.warn('字數過濾器整合警告:', error);
        }
      }, 200);
    }

    console.log('✅ 向後相容性檢查完成');
  });

  // 提供模組狀態檢查函數
  global.checkModuleIntegration = function() {
    const status = {
      timestamp: new Date().toISOString(),
      modules: {
        configManager: {
          loaded: !!global.unifiedConfig,
          initialized: global.unifiedConfig?.initialized || false
        },
        cangjieProcessor: {
          loaded: !!global.unifiedCangjie,
          initialized: global.unifiedCangjie?.initialized || false,
          dictSize: global.unifiedCangjie?._cjMap ? Object.keys(global.unifiedCangjie._cjMap).length : 0
        },
        charFilterManager: {
          loaded: !!global.unifiedCharFilter,
          initialized: global.unifiedCharFilter?.initialized || false,
          filterCount: global.unifiedCharFilter?.filters?.size || 0
        }
      },
      compatibility: {
        prefs: typeof global.prefs === 'object',
        FcjUtils: typeof global.FcjUtils === 'object',
        runMake: typeof global.runMake === 'function',
        getCharLengthFilter: typeof global.getCharLengthFilter === 'function'
      }
    };

    console.table(status.modules);
    console.table(status.compatibility);
    return status;
  };

})(window);
