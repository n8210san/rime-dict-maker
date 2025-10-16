// 核心模組系統 - 現代化模組架構
(function(global) {
  'use strict';

  // 模組註冊表
  const modules = new Map();
  const dependencies = new Map();
  const instances = new Map();
  
  // 事件系統
  class EventEmitter {
    constructor() {
      this.events = new Map();
    }

    on(event, listener) {
      if (!this.events.has(event)) {
        this.events.set(event, []);
      }
      this.events.get(event).push(listener);
      return this;
    }

    emit(event, ...args) {
      if (this.events.has(event)) {
        this.events.get(event).forEach(listener => {
          try {
            listener(...args);
          } catch (error) {
            console.error(`事件處理器錯誤 [${event}]:`, error);
          }
        });
      }
      return this;
    }

    off(event, listener) {
      if (this.events.has(event)) {
        const listeners = this.events.get(event);
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
      return this;
    }
  }

  // 核心模組系統
  class ModuleSystem extends EventEmitter {
    constructor() {
      super();
      this.initialized = false;
      this.initPromise = null;
    }

    // 註冊模組
    register(name, factory, deps = []) {
      if (modules.has(name)) {
        throw new Error(`模組 ${name} 已存在`);
      }

      modules.set(name, factory);
      dependencies.set(name, deps);
      this.emit('moduleRegistered', name, deps);
      
      console.log(`📦 註冊模組: ${name}`, deps.length ? `(依賴: ${deps.join(', ')})` : '');
      return this;
    }

    // 獲取模組實例
    async get(name) {
      if (!modules.has(name)) {
        throw new Error(`模組 ${name} 不存在`);
      }

      if (instances.has(name)) {
        return instances.get(name);
      }

      return await this._createInstance(name);
    }

    // 創建模組實例
    async _createInstance(name) {
      console.log(`🔧 創建模組實例: ${name}`);

      // 檢查循環依賴
      const visited = new Set();
      this._checkCircularDependency(name, visited, new Set());

      // 解析依賴
      const deps = dependencies.get(name) || [];
      const resolvedDeps = {};

      for (const dep of deps) {
        resolvedDeps[dep] = await this.get(dep);
      }

      // 創建實例
      const factory = modules.get(name);
      let instance;

      if (typeof factory === 'function') {
        instance = await factory(resolvedDeps, this);
      } else {
        instance = factory;
      }

      instances.set(name, instance);
      this.emit('moduleCreated', name, instance);
      
      console.log(`✅ 模組已創建: ${name}`);
      return instance;
    }

    // 檢查循環依賴
    _checkCircularDependency(name, visited, path) {
      if (path.has(name)) {
        throw new Error(`檢測到循環依賴: ${Array.from(path).join(' → ')} → ${name}`);
      }

      if (visited.has(name)) return;

      visited.add(name);
      path.add(name);

      const deps = dependencies.get(name) || [];
      for (const dep of deps) {
        this._checkCircularDependency(dep, visited, path);
      }

      path.delete(name);
    }

    // 初始化所有模組
    async initAll(moduleNames = []) {
      if (this.initPromise) return this.initPromise;

      this.initPromise = this._initAllInternal(moduleNames);
      return this.initPromise;
    }

    async _initAllInternal(moduleNames) {
      const targets = moduleNames.length ? moduleNames : Array.from(modules.keys());
      
      console.log('🚀 開始初始化模組系統...');
      this.emit('initStart', targets);

      const initPromises = targets.map(name => this.get(name));
      const results = await Promise.allSettled(initPromises);

      const success = [];
      const failed = [];

      results.forEach((result, index) => {
        const moduleName = targets[index];
        if (result.status === 'fulfilled') {
          success.push(moduleName);
        } else {
          failed.push({ name: moduleName, error: result.reason });
          console.error(`❌ 模組初始化失敗: ${moduleName}`, result.reason);
        }
      });

      this.initialized = true;
      this.emit('initComplete', { success, failed });
      
      console.log(`🎉 模組系統初始化完成: ${success.length} 成功, ${failed.length} 失敗`);
      return { success, failed };
    }

    // 獲取系統狀態
    getStatus() {
      return {
        initialized: this.initialized,
        totalModules: modules.size,
        loadedInstances: instances.size,
        modules: Array.from(modules.keys()),
        loadedModules: Array.from(instances.keys())
      };
    }

    // 重載模組
    async reload(name) {
      if (instances.has(name)) {
        const instance = instances.get(name);
        if (instance && typeof instance.destroy === 'function') {
          await instance.destroy();
        }
        instances.delete(name);
      }
      return await this.get(name);
    }

    // 銷毀模組系統
    async destroy() {
      console.log('🧹 銷毀模組系統...');
      
      for (const [name, instance] of instances) {
        if (instance && typeof instance.destroy === 'function') {
          try {
            await instance.destroy();
          } catch (error) {
            console.error(`銷毀模組失敗: ${name}`, error);
          }
        }
      }

      instances.clear();
      this.events.clear();
      this.initialized = false;
      this.initPromise = null;
    }
  }

  // 基礎模組類
  class BaseModule extends EventEmitter {
    constructor(name, dependencies = {}) {
      super();
      this.name = name;
      this.dependencies = dependencies;
      this.initialized = false;
      console.log(`🎯 創建模組: ${name}`);
    }

    async init() {
      if (this.initialized) return;
      
      console.log(`⚡ 初始化模組: ${this.name}`);
      await this._doInit();
      this.initialized = true;
      this.emit('initialized');
    }

    async _doInit() {
      // 子類覆寫此方法
    }

    async destroy() {
      console.log(`💥 銷毀模組: ${this.name}`);
      this.initialized = false;
      this.events.clear();
    }

    // 便利方法：獲取依賴
    dep(name) {
      return this.dependencies[name];
    }

    // 便利方法：檢查依賴是否存在
    hasDep(name) {
      return name in this.dependencies;
    }
  }

  // 配置管理助手
  class ConfigHelper {
    static createNamespace(config, namespace) {
      return {
        get: (key, defaultValue) => config.get(`${namespace}.${key}`, defaultValue),
        set: (key, value) => config.set(`${namespace}.${key}`, value),
        remove: (key) => config.remove(`${namespace}.${key}`),
        bindElements: (bindings) => config.bindElements(bindings, namespace)
      };
    }
  }

  // 工具函數
  const utils = {
    // 延遲執行
    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    // 重試機制
    async retry(fn, attempts = 3, delay = 1000) {
      for (let i = 0; i < attempts; i++) {
        try {
          return await fn();
        } catch (error) {
          if (i === attempts - 1) throw error;
          await utils.delay(delay);
          console.warn(`重試 ${i + 1}/${attempts}:`, error.message);
        }
      }
    },

    // 防抖動
    debounce(fn, delay) {
      let timeoutId;
      return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
      };
    },

    // 節流
    throttle(fn, delay) {
      let lastCall = 0;
      return function(...args) {
        const now = Date.now();
        if (now - lastCall >= delay) {
          lastCall = now;
          return fn.apply(this, args);
        }
      };
    }
  };

  // 建立全域實例
  const moduleSystem = new ModuleSystem();

  // 暴露 API
  global.ModuleSystem = {
    core: moduleSystem,
    BaseModule,
    EventEmitter,
    ConfigHelper,
    utils,

    // 便利方法
    register: (name, factory, deps) => moduleSystem.register(name, factory, deps),
    get: (name) => moduleSystem.get(name),
    init: (modules) => moduleSystem.initAll(modules),
    status: () => moduleSystem.getStatus()
  };

  console.log('🌟 核心模組系統已載入');

})(window);