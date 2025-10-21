(function (global) {
  const DEFAULT_OPTIONS = [
    { value: '0', label: '不限字根' },
    { value: '5', label: '最多5碼' },
    { value: '10', label: '最多10碼' }
  ];

  function toNumber(value, fallback = 0) {
    if (value === true) return 5;
    if (value === false || value === null || value === undefined) return fallback;
    const num = parseInt(value, 10);
    return Number.isFinite(num) && num > 0 ? num : 0;
  }

  function ensureOptions($select, options) {
    if (!$select || !$select.length) return;
    if ($select.data('fcj-limit-ready')) return;
    const opts = Array.isArray(options) && options.length ? options : DEFAULT_OPTIONS;
    $select.empty();
    opts.forEach(opt => {
      const option = document.createElement('option');
      option.value = String(opt.value);
      option.textContent = opt.label;
      $select[0].appendChild(option);
    });
    $select.data('fcj-limit-ready', true);
  }

  function getValue(selectorOrElement, fallback = 0) {
    const $select = $(selectorOrElement);
    if (!$select.length) return fallback;
    ensureOptions($select);
    return toNumber($select.val(), fallback);
  }

  function setValue(selectorOrElement, value) {
    const $select = $(selectorOrElement);
    if (!$select.length) return;
    ensureOptions($select);
    const stringValue = String(toNumber(value));
    if ($select.val() !== stringValue) {
      $select.val(stringValue);
    }
  }

  function bind(selectorOrElement, opts = {}) {
    const $select = $(selectorOrElement);
    if (!$select.length) return null;
    ensureOptions($select, opts.options);
    const defaultValue = opts.defaultValue !== undefined
      ? opts.defaultValue
      : toNumber($select.data('default-limit'));
    if (defaultValue !== undefined) {
      setValue($select, defaultValue);
    }
    return {
      getValue: () => getValue($select, 0),
      setValue: (val) => setValue($select, val)
    };
  }

  global.FreeCjLimitSelector = {
    bind,
    ensureOptions,
    getValue,
    setValue,
    toNumber
  };
})(window);

