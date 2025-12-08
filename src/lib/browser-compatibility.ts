/**
 * 浏览器兼容性检查和修复工具
 * 用于处理浏览器扩展API和全局变量访问问题
 */

// 扩展API类型定义
interface SafariExtension {
  extension?: {
    baseURI?: string;
  };
}

interface ChromeExtension {
  extension?: {
    getURL?: (path?: string) => string;
  };
}

interface BrowserExtension {
  extension?: {
    getURL?: (path?: string) => string;
  };
}

// 全局变量检查和修复
declare global {
  var safari: SafariExtension | undefined;
  var chrome: ChromeExtension | undefined;
  var browser: BrowserExtension | undefined;
}

// 安全的全局变量访问函数
export const safeGlobalAccess = {
  /**
   * 安全地访问safari扩展API
   */
  get safari(): SafariExtension | undefined {
    return typeof (globalThis as any).safari !== 'undefined' ? (globalThis as any).safari : undefined;
  },
  
  /**
   * 安全地访问chrome扩展API
   */
  get chrome(): ChromeExtension | undefined {
    return typeof (globalThis as any).chrome !== 'undefined' ? (globalThis as any).chrome : undefined;
  },
  
  /**
   * 安全地访问browser扩展API
   */
  get browser(): BrowserExtension | undefined {
    return typeof (globalThis as any).browser !== 'undefined' ? (globalThis as any).browser : undefined;
  },
  
  /**
   * 检测是否在浏览器扩展环境中
   */
  isExtensionContext(): boolean {
    return typeof (globalThis as any).safari !== 'undefined'
        || typeof (globalThis as any).chrome !== 'undefined'
        || typeof (globalThis as any).browser !== 'undefined';
  },
  
  /**
   * 安全地获取扩展baseURI
   */
  getExtensionBaseURI(): string {
    try {
      const safari = safeGlobalAccess.safari;
      if (typeof safari !== 'undefined' && safari.extension && safari.extension.baseURI) {
        return safari.extension.baseURI;
      }
      
      const chrome = safeGlobalAccess.chrome;
      if (typeof chrome !== 'undefined' && chrome.extension && chrome.extension.getURL) {
        return chrome.extension.getURL('');
      }
      
      const browser = safeGlobalAccess.browser;
      if (typeof browser !== 'undefined' && browser.extension && browser.extension.getURL) {
        return browser.extension.getURL('');
      }
      
      return '';
    } catch (error) {
      console.warn('无法获取扩展baseURI:', error);
      return '';
    }
  }
};

// 浏览器检测工具
export const browserDetection = {
  /**
   * 检测Safari浏览器
   */
  isSafari(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  },
  
  /**
   * 检测Chrome浏览器
   */
  isChrome(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /Chrome/.test(navigator.userAgent);
  },
  
  /**
   * 检测Firefox浏览器
   */
  isFirefox(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /Firefox/.test(navigator.userAgent);
  },
  
  /**
   * 获取浏览器信息
   */
  getBrowserInfo(): { name: string; version: string; userAgent: string } {
    if (typeof navigator === 'undefined') {
      return {
        name: 'unknown',
        version: 'unknown',
        userAgent: 'unknown'
      };
    }
    
    const userAgent = navigator.userAgent;
    let name = 'unknown';
    let version = 'unknown';
    
    if (browserDetection.isSafari()) {
      name = 'safari';
      const match = userAgent.match(/Version\/(\d+\.\d+)/);
      if (match && match[1]) {
        version = match[1];
      }
    } else if (browserDetection.isChrome()) {
      name = 'chrome';
      const match = userAgent.match(/Chrome\/(\d+\.\d+)/);
      if (match && match[1]) {
        version = match[1];
      }
    } else if (browserDetection.isFirefox()) {
      name = 'firefox';
      const match = userAgent.match(/Firefox\/(\d+\.\d+)/);
      if (match && match[1]) {
        version = match[1];
      }
    }
    
    return { name, version, userAgent };
  }
};

// 错误处理工具
export const errorHandler = {
  /**
   * 处理扩展API错误
   */
  handleExtensionError(error: Error, context: string): void {
    console.error(`浏览器扩展API错误 [${context}]:`, error);
    
    // 如果是safari未定义错误，提供友好的错误信息
    if (error.message.includes('safari is not defined')) {
      console.warn('检测到safari扩展API访问问题，这通常发生在非Safari浏览器中尝试访问Safari扩展API时。');
      console.warn('建议：检查代码中的浏览器兼容性检查。');
    }
  },
  
  /**
   * 创建安全的扩展API调用包装器
   */
  createSafeExtensionCall: <T extends (...args: any[]) => any>(
    apiCall: T,
    fallback: () => any,
    context: string = 'extension API'
  ) => {
    return (...args: Parameters<T>): any => {
      try {
        if (safeGlobalAccess.isExtensionContext()) {
          return apiCall(...args);
        } else {
          console.warn(`尝试在非扩展环境中调用${context}，使用fallback函数`);
          return fallback();
        }
      } catch (error) {
        errorHandler.handleExtensionError(error as Error, context);
        return fallback();
      }
    };
  }
};

// 初始化兼容性检查
export const initializeCompatibility = (): void => {
  // 检查并修复常见的全局变量问题
  if (typeof globalThis.window !== 'undefined') {
    // 确保safari变量存在（即使是undefined）
    if (!(globalThis.window as any).hasOwnProperty('safari')) {
      Object.defineProperty(globalThis.window, 'safari', {
        value: undefined,
        writable: false,
        enumerable: false,
        configurable: false
      });
    }
    
    // 确保chrome变量存在
    if (!(globalThis.window as any).hasOwnProperty('chrome')) {
      Object.defineProperty(globalThis.window, 'chrome', {
        value: undefined,
        writable: false,
        enumerable: false,
        configurable: false
      });
    }
    
    // 确保browser变量存在
    if (!(globalThis.window as any).hasOwnProperty('browser')) {
      Object.defineProperty(globalThis.window, 'browser', {
        value: undefined,
        writable: false,
        enumerable: false,
        configurable: false
      });
    }
  }
  
  // 添加全局错误处理
  if (typeof globalThis.window !== 'undefined') {
    (globalThis.window as any).addEventListener('error', (event: ErrorEvent) => {
      if (event.error && event.error.message && event.error.message.includes('safari is not defined')) {
        console.warn('捕获到safari未定义错误，应用兼容性修复');
        event.preventDefault();
      }
    });
  }
};

// 导出默认配置
const browserCompatibility = {
  safeGlobalAccess,
  browserDetection,
  errorHandler,
  initializeCompatibility
};

export default browserCompatibility;