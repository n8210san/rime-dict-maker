(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MockCjProvider = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  const defaultMap = {
    '字': 'zi',
    '詞': 'ci',
    '測試': 'ceshi',
    '中文': 'zhongwen',
    '單字': 'danzi',
    '雙字': 'shuangzi'
  };
  function create(mapping) {
    const map = Object.assign({}, defaultMap, mapping || {});
    return async function (word) {
      return map[word] || String(word).toLowerCase();
    };
  }
  return { create, defaultMap };
}));