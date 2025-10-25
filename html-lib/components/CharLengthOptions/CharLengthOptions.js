// 字數選項共用組件
const CharLengthOptions = {
  // 配置定義
  config: {
    options: [
      { id: 'charOpt_1char', label: '單字', length: 1, default: true },
      { id: 'charOpt_2char', label: '2字', length: 2, default: true },
      { id: 'charOpt_3char', label: '3字', length: 3, default: true },
      { id: 'charOpt_4char', label: '4字', length: 4, default: true },
      { id: 'charOpt_5pluschar', label: '5字以上', length: '5+', default: true }
    ],
    containerClass: 'char-length-options',
    labelStyle: 'margin-right: 10px; font-size: 13px;'
  },

  // 生成 HTML
  generateHTML(customConfig = {}) {
    const config = { ...this.config, ...customConfig };
    const optionsHTML = config.options.map(opt => 
      `<label style="${config.labelStyle}" title="只輸出${opt.label}的行">
        <input type="checkbox" id="${opt.id}" ${opt.default ? 'checked' : ''}> ${opt.label}
      </label>`
    ).join('');
    
    return `<span class="${config.containerClass}" style="display: inline-flex; gap: 10px; align-items: center;">
      ${optionsHTML}
    </span>`;
  },

  // 注入到指定容器
  inject(targetSelector, customConfig = {}) {
    const html = this.generateHTML(customConfig);
    $(targetSelector).append(html);
    this.bindEvents();
    this.restoreSettings();
  },

  // 替換現有元素
  replace(targetSelector, customConfig = {}) {
    const html = this.generateHTML(customConfig);
    $(targetSelector).replaceWith(html);
    this.bindEvents();
    this.restoreSettings();
  },

  // 獲取字數過濾函數
  getFilter() {
    const checkElement = (id, defaultValue = true) => {
      const $el = $(id);
      return $el.length ? $el.is(':checked') : defaultValue;
    };
    
    // 檢查是否完全沒有UI（檢查所有可能的字數選項ID）
    const uiElements = [
      '#fcjOpt_singleChar', '#fcjOpt_2char', '#fcjOpt_3char', '#fcjOpt_4char', '#fcjOpt_5pluschar',
      '#charOpt_1char', '#charOpt_2char', '#charOpt_3char', '#charOpt_4char', '#charOpt_5pluschar',
      '#freeCjSingleCharCheckbox', '#freeCj2charCheckbox', '#freeCj3charCheckbox', '#freeCj4charCheckbox', '#freeCj5pluscharCheckbox',
      '#freeCjWordGroupCheckbox'
    ];
    const hasUI = uiElements.some(id => $(id).length > 0);
    const noUIDefault = !hasUI; // 沒有UI時預設為true（不受限）
    
    return function(charLength) {
      // 有UI時，任一對應的checkbox勾選就返回true；沒有UI時返回noUIDefault
      if (charLength === 1) {
        const result1 = checkElement('#fcjOpt_singleChar', false);
        const result2 = checkElement('#charOpt_1char', false);
        const result3 = checkElement('#freeCjSingleCharCheckbox', false);
        return hasUI ? (result1 || result2 || result3) : noUIDefault;
      }
      if (charLength === 2) {
        const result1 = checkElement('#fcjOpt_2char', false);
        const result2 = checkElement('#charOpt_2char', false);
        const result3 = checkElement('#freeCj2charCheckbox', false);
        const result4 = checkElement('#freeCjWordGroupCheckbox', false); // 向後相容
        return hasUI ? (result1 || result2 || result3 || result4) : noUIDefault;
      }
      if (charLength === 3) {
        const result1 = checkElement('#fcjOpt_3char', false);
        const result2 = checkElement('#charOpt_3char', false);
        const result3 = checkElement('#freeCj3charCheckbox', false);
        const result4 = checkElement('#freeCjWordGroupCheckbox', false); // 向後相容
        return hasUI ? (result1 || result2 || result3 || result4) : noUIDefault;
      }
      if (charLength === 4) {
        const result1 = checkElement('#fcjOpt_4char', false);
        const result2 = checkElement('#charOpt_4char', false);
        const result3 = checkElement('#freeCj4charCheckbox', false);
        const result4 = checkElement('#freeCjWordGroupCheckbox', false); // 向後相容
        return hasUI ? (result1 || result2 || result3 || result4) : noUIDefault;
      }
      if (charLength >= 5) {
        const result1 = checkElement('#fcjOpt_5pluschar', false);
        const result2 = checkElement('#charOpt_5pluschar', false);
        const result3 = checkElement('#freeCj5pluscharCheckbox', false);
        const result4 = checkElement('#freeCjWordGroupCheckbox', false); // 向後相容
        return hasUI ? (result1 || result2 || result3 || result4) : noUIDefault;
      }
      return noUIDefault;
    };
  },

  // 綁定事件
  bindEvents() {
    this.config.options.forEach(({ id }) => {
      $(`#${id}`).off('change.charLengthOptions').on('change.charLengthOptions', function() {
        CharLengthOptions.saveSettings();
      });
    });
  },

  // 恢復設定（使用統一的 prefs 系統）
  restoreSettings() {
    try {
      this.config.options.forEach(({ id, default: defaultValue }) => {
        // 使用全域的 prefs 系統（如果可用）
        let checked = defaultValue;
        if (typeof prefs !== 'undefined' && prefs.get) {
          const stored = prefs.get(id);
          checked = stored !== null ? (stored === true || stored === '1') : defaultValue;
        } else {
          // 回退到組件自己的 localStorage
          const key = `charLength_${id}`;
          const stored = localStorage.getItem(key);
          checked = stored !== null ? (stored === 'true') : defaultValue;
        }
        $(`#${id}`).prop('checked', checked);
      });
    } catch (e) {
      console.warn('恢復字數選項設定失敗:', e);
    }
  },

  // 保存設定（使用統一的 prefs 系統）
  saveSettings() {
    try {
      this.config.options.forEach(({ id }) => {
        const checked = $(`#${id}`).is(':checked');
        // 使用全域的 prefs 系統（如果可用）
        if (typeof prefs !== 'undefined' && prefs.set) {
          prefs.set(id, checked === true);
        } else {
          // 回退到組件自己的 localStorage
          const key = `charLength_${id}`;
          localStorage.setItem(key, checked.toString());
        }
      });
    } catch (e) {
      console.warn('保存字數選項設定失敗:', e);
    }
  },

  // 檢查是否有任何選項被勾選
  hasAnyChecked() {
    return this.config.options.some(({ id }) => $(`#${id}`).is(':checked'));
  },

  // 驗證至少要有一個選項勾選
  validate(showAlert = true) {
    if (!this.hasAnyChecked()) {
      if (showAlert) {
        alert('至少要選擇一個字數選項！');
      }
      return false;
    }
    return true;
  }
};