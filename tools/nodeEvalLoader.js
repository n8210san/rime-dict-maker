(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('fs'));
  } else {
    root.NodeEvalLoader = factory();
  }
}(typeof self !== 'undefined' ? self : this, function (fs) {
  fs = fs || (typeof require === 'function' ? require('fs') : null);
  function loadToGlobal(filePath, target) {
    if (!fs) throw new Error('fs not available');
    const code = fs.readFileSync(filePath, 'utf8');
    const ctx = target || (typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : {}));
    if (!ctx.window) ctx.window = ctx;
    // eslint-disable-next-line no-eval
    (function(evalCtx){ with(evalCtx){ eval(code); } })(ctx);
    return ctx;
  }
  return { loadToGlobal };
}));