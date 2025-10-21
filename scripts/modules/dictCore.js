/**
 * dictCore.js - 字典處理核心模組（純函式層）
 * 
 * 職責：
 * - 提供字典格式檢測、正規化、去重的核心純函式
 * - 不直接操作 DOM，所有 DOM 操作由 Wrapper 層處理
 * - 支援依賴注入（separator、cjProvider）
 * 
 * 設計原則：
 * - Pure Functions：輸入 → 輸出，無副作用
 * - 依賴注入：外部傳入 separator、cjProvider
 * - 向後相容：透過全域 shim 保持舊 API 可用
 * 
 * API（核心純函式）：
 * - needsNormalizationCore(lines): boolean
 * - performDeduplicationCore(lines, opts): string[]
 * - normalizeDictionaryCore(lines, opts): Promise<string[]>
 * - dedupeWithCommentsCore(lines, opts): Promise<string[]>
 * 
 * 向後相容 API（全域掛載）：
 * - window.needsNormalizationCore
 * - window.performDeduplicationCore
 * - window.normalizeDictionaryCore
 * - window.dedupeWithCommentsCore
 */

(function(global) {
  'use strict';

  // 確保 Modules 命名空間存在
  global.Modules = global.Modules || {};

  // ============================================================
  // 核心純函式 - 格式檢測
  // ============================================================

  /**
   * 檢查字典內容是否需要正規化
   * 
   * 判斷邏輯：
   * - 檢查是否有非註解、非空行的內容行
   * - 檢查分隔符位置是否符合標準格式
   * - 忽略以 # 開頭的註解行和空白行
   * 
   * @param {string[]} lines - 字典內容的行陣列
   * @returns {boolean} - true 表示需要正規化，false 表示格式正確
   * 
   * @example
   * const lines = ['word\tcode', '詞\taa'];
   * needsNormalizationCore(lines); // 檢查格式
   */
  function needsNormalizationCore(lines) {
    if (!Array.isArray(lines)) return false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) continue;
      
      // 檢查是否有 詞組\t計數 格式（需要補字根）
      if (parts.length === 2 && !isNaN(parts[1])) {
        return true;
      }
      
      // 檢查是否有無字根的不規範格式
      if (parts.length >= 2) {
        const p0 = parts[0], p1 = parts[1];
        const hasRoot = /^[a-z]+$/.test(p0) || /^[a-z]+$/.test(p1);
        if (!hasRoot) {
          return true;
        }
      }
    }
    return false;
  }

  // ============================================================
  // 核心純函式 - 去重處理
  // ============================================================

  /**
   * 執行字典去重的核心邏輯（純函式）
   * 
   * 功能說明：
   * - 合併重複的詞條（相同詞+編碼）
   * - 保留註解行和空白行的位置
   * - 累加重複詞條的計數（如果有）
   * - 使用指定的分隔符處理詞條
   * - 支援 rootOrder 參數控制字根輸出順序
   * 
   * @param {string[]} lines - 字典內容的行陣列
   * @param {Object} opts - 選項物件
   * @param {string} opts.separator - 分隔符（如 '\t' 或 ' '）
   * @param {string} [opts.rootOrder='after'] - 字根順序：'after' (詞 字根) 或 'before' (字根 詞)
   * @returns {string[]} - 去重後的行陣列
   * 
   * @example
   * const lines = ['word\tcode\t100', 'word\tcode\t50', '# comment'];
   * const result = performDeduplicationCore(lines, { separator: '\t', rootOrder: 'after' });
   * // 結果: ['word\tcode\t150', '# comment']
   */
  function performDeduplicationCore(lines, opts) {
    // 驗證參數
    if (!Array.isArray(lines)) {
      throw new Error('performDeduplicationCore: lines 必須是陣列');
    }
    if (!opts || typeof opts.separator !== 'string') {
      throw new Error('performDeduplicationCore: opts.separator 必須是字串');
    }
    
    const { separator, rootOrder = 'after' } = opts;
    const result = new Array(lines.length);
    const seen = Object.create(null);

    // 一次遍歷完成：標記 + 去重
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // 保留空白與註解
      if (!trimmed || trimmed.startsWith('#')) {
        result[i] = line; // 原樣保留
        continue;
      }

      // 快速切割
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) continue;

      // 根據簡單規則判斷 root/word/count (巢狀判斷，全小寫優先為字根)
      let root = '', word = '', count = 1;
      const p0 = parts[0], p1 = parts[1], p2 = parts[2];

      if (/^[a-z]+$/.test(p0)) {
        // p0 是全小寫
        if (!/^[a-z]+$/.test(p1)) {
          // p1 不是全小寫 → p0 是字根
          root = p0;
          word = p1;
          if (p2 && /^\d+$/.test(p2)) count = +p2;
        } else {
          // p0 p1 都是小寫 → 保持原順序，p0 當字根
          root = p0;
          word = p1;
          if (p2 && /^\d+$/.test(p2)) count = +p2;
        }
      } else {
        // p0 不是全小寫
        if (/^[a-z]+$/.test(p1)) {
          // p1 是全小寫 → p1 是字根
          word = p0;
          root = p1;
          if (p2 && /^\d+$/.test(p2)) count = +p2;
        } else {
          // 都不是標準字根格式，跳過
          continue;
        }
      }

      const key = root + '|' + word;
      const existing = seen[key];

      if (existing) {
        existing.count += count;
        // 記錄為已處理，原位置留 null
        result[i] = null;
      } else {
        seen[key] = { root, word, count, index: i };
      }
    }

    // 第二階段：將 seen 結果回填到原始順序
    for (const key in seen) {
      const { index, root, word, count } = seen[key];
      // 根據 rootOrder 決定輸出順序
      if (rootOrder === 'before') {
        result[index] = `${root}${separator}${word}${separator}${count}`;
      } else {
        result[index] = `${word}${separator}${root}${separator}${count}`;
      }
    }

    // 輸出結果（過濾掉 null）
    return result.filter(line => line !== null);
  }

  // ============================================================
  // 核心純函式 - 字典正規化
  // ============================================================

  /**
   * 執行字典正規化的核心邏輯（純函式，非同步）
   * 
   * 功能說明：
   * - 將字典內容轉換為標準格式：詞 + 分隔符 + 編碼 + 分隔符 + 計數
   * - 透過 cjProvider 獲取每個詞的倉頡編碼
   * - 保留註解行和空白行
   * - 自動檢測格式並標準化順序
   * - 支援記憶化與併發控制
   * - 支援 rootOrder 參數控制字根輸出順序
   * 
   * @param {string[]} lines - 字典內容的行陣列
   * @param {Object} opts - 選項物件
   * @param {string} opts.separator - 分隔符（如 '\t' 或 ' '）
   * @param {Function} opts.cjProvider - 倉頡編碼提供函式 (word: string) => Promise<string>
   * @param {number} [opts.concurrency=8] - 最大併發數
   * @param {string} [opts.rootOrder='after'] - 字根順序：'after' (詞 字根) 或 'before' (字根 詞)
   * @returns {Promise<string[]>} - 正規化後的行陣列
   * 
   * @example
   * const lines = ['word', '詞\t5'];
   * const cjProvider = async (word) => getCangjieCode(word);
   * const result = await normalizeDictionaryCore(lines, { 
   *   separator: '\t',
   *   cjProvider,
   *   rootOrder: 'after'
   * });
   * // 結果: ['word\tword\t1', '詞\tcjcode\t5']
   */
  async function normalizeDictionaryCore(lines, opts) {
    // 驗證參數
    if (!Array.isArray(lines)) {
      throw new Error('normalizeDictionaryCore: lines 必須是陣列');
    }
    if (!opts || typeof opts.separator !== 'string') {
      throw new Error('normalizeDictionaryCore: opts.separator 必須是字串');
    }
    if (!opts.cjProvider || typeof opts.cjProvider !== 'function') {
      throw new Error('normalizeDictionaryCore: opts.cjProvider 必須是函式');
    }

    const { separator, cjProvider, concurrency = 8, rootOrder = 'after' } = opts;
    
    // 記憶化快取（避免重複呼叫 cjProvider）
    const cjCache = new Map();
    
    // 帶記憶化的 cjProvider wrapper
    const getCachedCJ = async (word) => {
      if (cjCache.has(word)) {
        return cjCache.get(word);
      }
      
      // 建立 Promise 並快取（避免同時多個請求同一個詞）
      const promise = (async () => {
        try {
          const result = await cjProvider(word);
          return result || word; // 如果失敗或空值，回退到原詞
        } catch (e) {
          console.warn(`normalizeDictionaryCore: cjProvider 失敗於 "${word}":`, e.message || e);
          return word; // 錯誤時回退
        }
      })();
      
      cjCache.set(word, promise);
      return promise;
    };
    
    // 第一階段：解析所有行，收集需要查詢的詞
    const parsedLines = [];
    const wordsToFetch = new Set();
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // 保留空行和註解行（原樣）
      if (!trimmed || trimmed.startsWith('#')) {
        parsedLines.push({ type: 'preserve', content: line });
        continue;
      }
      
      // 解析資料行
      const parts = trimmed.split(/\s+/);
      if (parts.length < 1) {
        parsedLines.push({ type: 'preserve', content: line });
        continue;
      }
      
      // 判斷格式並解析
      let word = '', root = '', count = 1;
      let needsRoot = false;
      
      if (parts.length === 1) {
        // 格式 A1: 單欄「詞」→ 補 root + count
        word = parts[0];
        needsRoot = true;
      } else if (parts.length === 2 && !isNaN(parts[1])) {
        // 格式 A2: 雙欄「詞 計數」→ 補 root
        word = parts[0];
        count = parseInt(parts[1], 10);
        needsRoot = true;
      } else if (parts.length >= 2) {
        // 格式 B: 三欄或以上
        const p0 = parts[0], p1 = parts[1], p2 = parts[2];
        
        // 判斷哪個是字根（全小寫英文）
        if (/^[a-z]+$/.test(p0)) {
          // p0 是字根
          root = p0;
          word = p1;
          if (p2 && /^\d+$/.test(p2)) {
            count = parseInt(p2, 10);
          }
        } else if (/^[a-z]+$/.test(p1)) {
          // p1 是字根
          word = p0;
          root = p1;
          if (p2 && /^\d+$/.test(p2)) {
            count = parseInt(p2, 10);
          }
        } else {
          // 都不是標準字根格式，保持原樣
          parsedLines.push({ type: 'preserve', content: line });
          continue;
        }
      } else {
        parsedLines.push({ type: 'preserve', content: line });
        continue;
      }
      
      // 如果需要生成 root
      if (needsRoot) {
        if (/^[a-zA-Z]+$/.test(word)) {
          // 英文：root = word.toLowerCase()
          root = word.toLowerCase();
        } else if (/^[\u4e00-\u9fff]+$/.test(word)) {
          // 純中文：需要查詢 cjProvider
          wordsToFetch.add(word);
          root = null; // 標記為需要查詢
        } else {
          // 混合或其他：回退到原詞
          root = word;
        }
      }
      
      parsedLines.push({ type: 'data', word, root, count });
    }
    
    // 第二階段：批次並行查詢（併發控制）
    if (wordsToFetch.size > 0) {
      const wordsArray = Array.from(wordsToFetch);
      const batches = [];
      
      // 將查詢任務分批，每批最多 concurrency 個
      for (let i = 0; i < wordsArray.length; i += concurrency) {
        batches.push(wordsArray.slice(i, i + concurrency));
      }
      
      // 依序執行每批（批內並行，批間順序）
      for (const batch of batches) {
        await Promise.all(batch.map(word => getCachedCJ(word)));
      }
    }
    
    // 第三階段：組裝結果
    const result = [];
    for (const parsed of parsedLines) {
      if (parsed.type === 'preserve') {
        result.push(parsed.content);
      } else {
        let { word, root, count } = parsed;
        
        // 如果 root 為 null，表示需要從快取取得
        if (root === null) {
          root = await getCachedCJ(word);
        }
        
        // 根據 rootOrder 決定輸出順序
        if (rootOrder === 'before') {
          // 字根在前：root + separator + word + separator + count
          result.push(`${root}${separator}${word}${separator}${count}`);
        } else {
          // 字根在後（預設）：word + separator + root + separator + count
          result.push(`${word}${separator}${root}${separator}${count}`);
        }
      }
    }
    
    return result;
  }

  // ============================================================
  // 核心純函式 - 帶註解去重流程
  // ============================================================

  /**
   * 執行帶註解的去重完整流程（純函式，非同步）
   * 
   * 功能說明：
   * - 完整的去重流程：檢測 → 正規化（如需要）→ 去重
   * - 保留所有註解和空白行
   * - 自動判斷是否需要正規化
   * - 組合 needsNormalizationCore、normalizeDictionaryCore、performDeduplicationCore
   * - 支援 rootOrder 參數控制字根輸出順序
   * 
   * @param {string[]} lines - 字典內容的行陣列
   * @param {Object} opts - 選項物件
   * @param {string} opts.separator - 分隔符（如 '\t' 或 ' '）
   * @param {Function} opts.cjProvider - 倉頡編碼提供函式 (word: string) => Promise<string>
   * @param {string} [opts.rootOrder='after'] - 字根順序：'after' (詞 字根) 或 'before' (字根 詞)
   * @returns {Promise<string[]>} - 處理後的行陣列
   * 
   * @example
   * const lines = ['word', 'word', '# comment'];
   * const cjProvider = async (word) => getCangjieCode(word);
   * const result = await dedupeWithCommentsCore(lines, {
   *   separator: '\t',
   *   cjProvider,
   *   rootOrder: 'after'
   * });
   * // 結果: ['word\tcode\t1', '# comment'] （已正規化並去重）
   */
  async function dedupeWithCommentsCore(lines, opts) {
    // 驗證參數
    if (!Array.isArray(lines)) {
      throw new Error('dedupeWithCommentsCore: lines 必須是陣列');
    }
    if (!opts || typeof opts.separator !== 'string') {
      throw new Error('dedupeWithCommentsCore: opts.separator 必須是字串');
    }
    if (!opts.cjProvider || typeof opts.cjProvider !== 'function') {
      throw new Error('dedupeWithCommentsCore: opts.cjProvider 必須是函式');
    }
    
    // 完整的去重流程：檢測 → 正規化（如需要）→ 去重
    let processedLines = lines;
    
    // 第一步：檢查是否需要正規化
    if (needsNormalizationCore(lines)) {
      // 需要正規化，執行 normalizeDictionaryCore（會自動傳遞 rootOrder）
      processedLines = await normalizeDictionaryCore(lines, opts);
    }
    
    // 第二步：執行去重（會自動傳遞 rootOrder）
    const finalLines = performDeduplicationCore(processedLines, opts);
    
    return finalLines;
  }

  // ============================================================
  // 模組物件封裝
  // ============================================================

  const DictCore = {
    // 核心純函式
    needsNormalizationCore,
    performDeduplicationCore,
    normalizeDictionaryCore,
    dedupeWithCommentsCore,

    // 模組資訊
    version: '1.0.0',
    description: '字典處理核心模組（純函式層）'
  };

  // ============================================================
  // 模組註冊與向後相容
  // ============================================================

  // 註冊到 Modules 命名空間
  global.Modules.DictCore = DictCore;

  // 向後相容：直接掛載核心函式到全域
  global.needsNormalizationCore = DictCore.needsNormalizationCore;
  global.performDeduplicationCore = DictCore.performDeduplicationCore;
  global.normalizeDictionaryCore = DictCore.normalizeDictionaryCore;
  global.dedupeWithCommentsCore = DictCore.dedupeWithCommentsCore;

  // 開發模式標記
  if (typeof console !== 'undefined' && console.info) {
    console.info('✅ dictCore.js 模組已載入（所有核心函數已完整實作）');
  }

})(window);
