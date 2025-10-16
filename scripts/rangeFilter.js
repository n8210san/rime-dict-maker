// 範圍過濾器模組
(function(global) {
  'use strict';

  // range parser: supports ">N", ">=N", "<N", "<=N", "A-B" (order-insensitive), or single number (equals)
  function buildRangeFilter(rangeStr) {
    const s = String(rangeStr || '').trim();
    if (!s) throw new Error('請輸入範圍條件，例如 ">300" 或 "10-30"');
    
    const m1 = s.match(/^([<>]=?)\s*(\d+)$/);
    if (m1) {
      const op = m1[1];
      const n = parseInt(m1[2], 10);
      if (op === '>') return (x) => x > n;
      if (op === '>=') return (x) => x >= n;
      if (op === '<') return (x) => x < n;
      if (op === '<=') return (x) => x <= n;
    }
    
    const m2 = s.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m2) {
      let a = parseInt(m2[1], 10);
      let b = parseInt(m2[2], 10);
      if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error('範圍需為數字');
      const lo = Math.min(a, b), hi = Math.max(a, b);
      return (x) => x >= lo && x <= hi;
    }
    
    const m3 = s.match(/^(\d+)$/);
    if (m3) {
      const n = parseInt(m3[1], 10);
      return (x) => x === n;
    }
    
    throw new Error('不支援的範圍格式，請用 ">300"、"<=20"、"10-30" 或單一數字');
  }

  async function streamFilterDict(rangeStr, onProgress) { 
    // 串流逐塊處理，並回報進度
    const predicate = buildRangeFilter(rangeStr);
    const charLengthFilter = getCharLengthFilter();
    const encoding = $('#encodingSelect').val() || 'utf-8';
    
    const resp = await fetch('data/dict.txt');
    if (!resp.ok) throw new Error('無法讀取 data/dict.txt');
    
    const total = parseInt(resp.headers.get('Content-Length') || '0', 10) || 0;
    
    if (!resp.body || !resp.body.getReader) {
      // 環境不支援串流，以一次讀取退而求其次
      const all = await resp.text();
      const results = [];
      let matched = 0, processed = 0;
      
      all.split(/\r?\n/).forEach(line => {
        const t = line.trim(); 
        if (!t) return; 
        processed++;
        
        const parts = t.split(/\s+/); 
        if (parts.length < 3) return;
        
        const f = parseInt(parts[1], 10); 
        if (!Number.isFinite(f)) return;
        
        const charLength = parts[0].length;
        if (predicate(f) && charLengthFilter(charLength)) { 
          results.push([parts[0], f, parts[2]]); 
          matched++; 
        }
      });
      
      results.sort((a,b)=>b[1]-a[1]);
      if (onProgress) onProgress({ percent: 100, processed, matched, total });
      return results.map(x=>`${x[0]} ${x[1]} ${x[2]}`).join('\n');
    }
    
    const reader = resp.body.getReader();
    const decoder = new TextDecoder(encoding);
    const results = [];
    let bytesRead = 0, processed = 0, matched = 0, remainder = '';
    
    const pump = async () => {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        bytesRead += value.byteLength;
        const chunk = decoder.decode(value, { stream: true });
        const text = remainder + chunk;
        const lines = text.split(/\r?\n/);
        remainder = lines.pop() || '';
        
        for (let i=0; i<lines.length; i++) {
          const t = lines[i].trim(); 
          if (!t) continue; 
          processed++;
          
          const parts = t.split(/\s+/); 
          if (parts.length < 3) continue;
          
          const f = parseInt(parts[1], 10); 
          if (!Number.isFinite(f)) continue;
          
          const charLength = parts[0].length;
          if (predicate(f) && charLengthFilter(charLength)) { 
            results.push([parts[0], f, parts[2]]); 
            matched++; 
          }
        }
        
        if (onProgress) {
          const percent = total ? Math.min(99, Math.floor(bytesRead * 100 / total)) : 0;
          onProgress({ percent, processed, matched });
        }
      }
      
      // flush remainder
      const last = remainder.trim();
      if (last) {
        processed++;
        const parts = last.split(/\s+/);
        if (parts.length >= 3) {
          const f = parseInt(parts[1], 10);
          const charLength = parts[0].length;
          if (Number.isFinite(f) && predicate(f) && charLengthFilter(charLength)) { 
            results.push([parts[0], f, parts[2]]); 
            matched++; 
          }
        }
      }
    };
    
    await pump();
    results.sort((a,b)=> b[1]-a[1]);
    if (onProgress) onProgress({ percent: 100, processed, matched, total });
    return results.map(x=> `${x[0]} ${x[1]} ${x[2]}`).join('\n');
  }

  // 暴露到全域
  global.RangeFilter = {
    buildRangeFilter,
    streamFilterDict
  };
  
  // 向後相容
  global.buildRangeFilter = buildRangeFilter;
  global.streamFilterDict = streamFilterDict;

})(window);