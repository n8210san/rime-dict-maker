(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TestHarness = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  function createHarness() {
    const results = [];
    function add(name, passed, message = '') {
      results.push({ name, passed: !!passed, message: message || '' });
    }
    function summary() {
      const total = results.length;
      const passed = results.filter(r => r.passed).length;
      return { total, passed, failed: total - passed, results: results.slice() };
    }
    function render(containerOrId) {
      const container = typeof containerOrId === 'string' ? (typeof document !== 'undefined' && document.getElementById(containerOrId)) : containerOrId;
      if (!container) return summary();
      let html = '<ul>';
      for (const r of results) {
        const icon = r.passed ? '✅' : '❌';
        html += '<li>' + icon + ' ' + r.name + (r.message ? ' - ' + r.message : '') + '</li>';
      }
      html += '</ul>';
      container.innerHTML = html;
      return summary();
    }
    return { add, render, summary };
  }
  return { createHarness };
}));