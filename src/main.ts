import { app, BrowserWindow, globalShortcut, ipcMain, nativeTheme, BrowserView, screen, shell } from 'electron';
import { WebContents } from 'electron/main';
import { autoUpdater } from 'electron-updater';
import * as log from 'electron-log';
import * as path from 'path';
import * as fs from 'fs';

interface GPUMemoryInfo {
  currentUsage?: number;
  limitInBytes?: number;
  availableInBytes?: number;
}

interface GPUInfo {
  auxAttributes?: {
    gpuMemorySize?: number;
    glRenderer?: string;
    glVendor?: string;
  };
  gpuMemoryBuffersMemoryInfo?: GPUMemoryInfo;
  featureStatus?: Record<string, string>;
  driverBugWorkarounds?: string[];
  videoDecoding?: Record<string, string>;
  videoEncoding?: Record<string, string>;
}

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let anubisView: BrowserView | null = null;
let externalLinkWindow: BrowserWindow | null = null;
let externalTabs: Map<number, BrowserView> = new Map();
let activeExternalTab: number | null = null;
let initialWindowBounds = { width: 1280, height: 720 };

const settingsPath = path.join(app.getPath('userData'), 'settings.json');
let settings = {
    theme: 'system',
    titleBarColor: '#1a1a1a',
    startFullscreen: false,
    gameUrl: 'https://anubisrp.com',
    performanceMode: 'optimal'
};

const getRandomUserAgent = (): string => {
  const platform = process.platform;
  
  if (platform === 'win32') {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
  } else if (platform === 'darwin') {
    return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
  } else {
    return 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
  }
};

const applyPerformanceSettings = (mode: string) => {
    const totalMemory = process.getSystemMemoryInfo().total;
    const totalMemoryMB = Math.floor(totalMemory / 1024);
    const isLowEnd = totalMemoryMB < 8192;
    const isMidRange = totalMemoryMB >= 8192 && totalMemoryMB < 16384;
    const isHighEnd = totalMemoryMB >= 16384;
    
    app.commandLine.appendSwitch('disable-background-timer-throttling');
    app.commandLine.appendSwitch('disable-renderer-backgrounding');
    app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
    app.commandLine.appendSwitch('disable-background-media-suspend');
    app.commandLine.appendSwitch('disable-crash-reporter');
    app.commandLine.appendSwitch('disable-breakpad');
    
    if (isLowEnd) {
        app.commandLine.appendSwitch('disable-gpu-sandbox');
        app.commandLine.appendSwitch('disable-software-rasterizer');
        app.commandLine.appendSwitch('disable-gpu-vsync');
        app.commandLine.appendSwitch('max-active-webgl-contexts', '8');
        app.commandLine.appendSwitch('force-gpu-mem-available-mb', '1024');
        app.commandLine.appendSwitch('max-unused-resource-memory-usage-percentage', '5');
        app.commandLine.appendSwitch('memory-pressure-off');
    } else if (isMidRange || mode === 'optimal') {
        app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
        app.commandLine.appendSwitch('enable-webgl');
        app.commandLine.appendSwitch('enable-gpu-rasterization');
        app.commandLine.appendSwitch('enable-hardware-acceleration');
        app.commandLine.appendSwitch('max-active-webgl-contexts', '32');
        app.commandLine.appendSwitch('force-gpu-mem-available-mb', '3072');
        app.commandLine.appendSwitch('max-unused-resource-memory-usage-percentage', '8');
    } else if (isHighEnd || mode === 'maximum') {
        app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
        app.commandLine.appendSwitch('enable-webgl');
        app.commandLine.appendSwitch('enable-webgl2');
        app.commandLine.appendSwitch('enable-gpu-rasterization');
        app.commandLine.appendSwitch('ignore-gpu-blocklist');
        app.commandLine.appendSwitch('enable-hardware-acceleration');
        app.commandLine.appendSwitch('enable-webgl-draft-extensions');
        app.commandLine.appendSwitch('enable-unsafe-webgpu');
        app.commandLine.appendSwitch('max-active-webgl-contexts', '64');
        app.commandLine.appendSwitch('webgl-max-texture-size', '16384');
        app.commandLine.appendSwitch('force-gpu-mem-available-mb', Math.min(Math.floor(totalMemoryMB * 0.3), 6144).toString());
        app.commandLine.appendSwitch('max-unused-resource-memory-usage-percentage', '10');
    }
    
    if (process.platform === 'win32') {
        app.commandLine.appendSwitch('use-angle', 'd3d11');
        app.commandLine.appendSwitch('disable-d3d11-debug-layer');
    } else if (process.platform === 'darwin') {
        app.commandLine.appendSwitch('enable-metal');
    }
    
    app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
    app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,CanvasOopRasterization');
    app.commandLine.appendSwitch('force-device-scale-factor', '1');
};

const loadSettings = () => {
    try {
        if (fs.existsSync(settingsPath)) {
            settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
};

const saveSettings = () => {
  try {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (error) {
      console.error('Error saving settings:', error);
  }
};

loadSettings();
applyPerformanceSettings(settings.performanceMode);

autoUpdater.logger = log;
log.transports.file.level = 'info';
log.info('App starting...');
autoUpdater.autoDownload = false;

function sendUpdateEvent(channel: string, ...args: any[]) {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send(channel, ...args);
  }
}

autoUpdater.on('checking-for-update', () => {
  log.info('Checking for update...');
  sendUpdateEvent('update-checking');
});

autoUpdater.on('update-available', (info) => {
  log.info('Update available.', info);
  sendUpdateEvent('update-available', info);
});

autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available.', info);
  sendUpdateEvent('no-update-available');
});

autoUpdater.on('error', (err) => {
  log.error('Error in auto-updater.', err);
  sendUpdateEvent('update-error', err.message);
});

autoUpdater.on('download-progress', (progressObj) => {
  const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
  log.info(logMessage);
  sendUpdateEvent('update-download-progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded.', info);
  sendUpdateEvent('update-downloaded', info);
});

ipcMain.on('check-for-updates', () => {
  log.info('Manual update check requested.');
  autoUpdater.checkForUpdates().catch(err => {
    log.error('Error during manual update check:', err);
    sendUpdateEvent('update-error', err.message);
  });
});

ipcMain.on('download-update', () => {
  log.info('Download update requested.');
  autoUpdater.downloadUpdate().catch(err => {
    log.error('Error during update download:', err);
    sendUpdateEvent('update-error', err.message);
  });
});

ipcMain.on('install-update', () => {
  log.info('Install and restart requested.');
  autoUpdater.quitAndInstall();
});

ipcMain.handle('get-version', () => {
  return app.getVersion();
});


const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      enableWebSQL: false,
      webgl: true,
      webSecurity: true,
      backgroundThrottling: false,
      offscreen: false
    },
    frame: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#202020' : '#ffffff',
    show: false,
    icon: process.platform === 'darwin' ? path.join(__dirname, '../images/icon.icns'): process.platform === 'win32' ? path.join(__dirname, '../images/icon.ico') : path.join(__dirname, '../images/icon.png'),
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true
  });

  const anubisView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webgl: true,
      webSecurity: true,
      partition: 'persist:anubisView',
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
      spellcheck: false,
      javascript: true,
      images: true,
      allowRunningInsecureContent: false
    }
  });

  const session = anubisView.webContents.session;

  try {
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
  } catch (error) {
    console.log('Cache setup info:', error);
  }

  session.setSpellCheckerEnabled(false);
  session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });
  
  session.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    if (responseHeaders['X-Frame-Options']) {
      delete responseHeaders['X-Frame-Options'];
    }
    if (responseHeaders['x-frame-options']) {
      delete responseHeaders['x-frame-options'];
    }
    if (responseHeaders['Content-Security-Policy']) {
      const cspValue = responseHeaders['Content-Security-Policy'];
      const csp = Array.isArray(cspValue) ? cspValue.join(' ') : String(cspValue);
      if (csp.includes('frame-ancestors')) {
        const modified = csp.replace(/frame-ancestors[^;]*;?\s*/g, '');
        responseHeaders['Content-Security-Policy'] = [modified];
      }
    }
    if (responseHeaders['content-security-policy']) {
      const cspValue = responseHeaders['content-security-policy'];
      const csp = Array.isArray(cspValue) ? cspValue.join(' ') : String(cspValue);
      if (csp.includes('frame-ancestors')) {
        const modified = csp.replace(/frame-ancestors[^;]*;?\s*/g, '');
        responseHeaders['content-security-policy'] = [modified];
      }
    }
    callback({ responseHeaders });
  });
  
  session.setSSLConfig({
    minVersion: 'tls1.2',
    maxVersion: 'tls1.3'
  });
  
  session.setProxy({ mode: 'direct' });

  session.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = details.requestHeaders;
    
    if (headers['User-Agent'] && headers['User-Agent'].includes('Electron')) {
      headers['User-Agent'] = getRandomUserAgent();
    }
    
    callback({ requestHeaders: headers });
  });

  session.setPreloads([]);
  session.setUserAgent(getRandomUserAgent());
  
  anubisView.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') || url.startsWith('https')) {
      return { action: 'allow' };
    }
    return { action: 'deny' };
  });

  anubisView.webContents.setAudioMuted(false);
  
  anubisView.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(settings.gameUrl) && !url.startsWith('http')) {
      event.preventDefault();
      showExternalLinkPrompt(url);
    }
  });

  anubisView.webContents.setFrameRate(60);
  anubisView.webContents.setBackgroundThrottling(false);

  const optimizeMemory = () => {
    if (anubisView && anubisView.webContents && !isLoading) {
      const memInfo = process.getSystemMemoryInfo();
      const totalMemoryMB = Math.floor(memInfo.total / 1024);
      const isLowEnd = totalMemoryMB < 8192;
      const threshold = isLowEnd ? 512 : 1024;
      
      anubisView.webContents.executeJavaScript(`
        if (window.performance && window.performance.memory && 
            window.performance.memory.usedJSHeapSize > ${threshold} * 1024 * 1024) {
          if (window.gc) window.gc();
          const images = document.querySelectorAll('img');
          images.forEach(img => {
            if (!img.getBoundingClientRect().width) {
              img.src = '';
            }
          });
        }
      `, true).catch(() => {});
    }
  };

  const memInfo = process.getSystemMemoryInfo();
  const totalMemoryMB = Math.floor(memInfo.total / 1024);
  const isLowEnd = totalMemoryMB < 8192;
  const optimizeInterval = isLowEnd ? 300000 : 600000;
  setInterval(optimizeMemory, optimizeInterval);
  let isLoading = false;
  
  anubisView.webContents.on('did-start-loading', () => {
    isLoading = true;
    mainWindow?.webContents.send('loading-progress', 0.1);
  });

  anubisView.webContents.on('did-stop-loading', () => {
    isLoading = false;
    mainWindow?.webContents.send('loading-progress', 1);
    optimizeMemory();
  });

  const loadContent = async () => {
    try {
      const userAgent = getRandomUserAgent();
      session.setUserAgent(userAgent);

      await anubisView?.webContents.loadURL(settings.gameUrl, {
        userAgent: userAgent
      });
    } catch (error: unknown) {
      console.error('Load failed:', error);
      handleCrash();
    }
  };

  mainWindow.setBrowserView(anubisView);
  const titlebarPath = app.isPackaged 
    ? path.join(__dirname, 'titlebar.html')
    : path.join(__dirname, '../src/titlebar.html');
  mainWindow.loadFile(titlebarPath);
  mainWindow.webContents.on('did-finish-load', () => {
    const isDark = nativeTheme.shouldUseDarkColors;
    const initialColor = settings.titleBarColor || (isDark ? '#1a1a1a' : '#f8f8f8');
    mainWindow?.webContents.send('update-colors', initialColor);
    loadContent();
  });

  let crashRecoveryAttempts = 0;
  const MAX_RECOVERY_ATTEMPTS = 2;

  const handleCrash = async () => {
    if (crashRecoveryAttempts >= MAX_RECOVERY_ATTEMPTS) return;
    crashRecoveryAttempts++;
    setTimeout(() => {
      if (!isLoading && anubisView && !anubisView.webContents.isDestroyed()) {
        anubisView.webContents.reload();
      }
    }, 3000);
  };

  const optimizePerformance = () => {
    const memInfo = process.getSystemMemoryInfo();
    const totalMemoryMB = Math.floor(memInfo.total / 1024);
    const isLowEnd = totalMemoryMB < 8192;
    const emergencyThreshold = isLowEnd ? 128 * 1024 : 64 * 1024;
    const warningThreshold = isLowEnd ? 256 * 1024 : 128 * 1024;

    if (memInfo.free < emergencyThreshold) {
        for (const [id, view] of externalTabs.entries()) {
            if (id !== activeExternalTab) {
                try {
                  view.webContents.close();
                  externalTabs.delete(id);
                } catch (err) {}
            }
        }
        if (global.gc) global.gc();
    } else if (memInfo.free < warningThreshold && isLowEnd) {
        anubisView?.webContents.session.clearCache().catch(() => {});
    }
  };

  const preventWebGLContextLoss = () => {
    app.on('child-process-gone', (event, details) => {
        if (details.type === 'GPU') {
            console.warn('GPU process crashed, preventing restart to avoid context loss');
            if (anubisView && !anubisView.webContents.isDestroyed()) {
                anubisView.webContents.reload();
            }
        }
    });

    anubisView.webContents.on('dom-ready', () => {
      anubisView.webContents.executeJavaScript(`
        if (typeof navigator.webdriver !== 'undefined') {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        }

        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, attributes) {
          if (type === 'webgl' || type === 'webgl2') {
            const preventLossAttributes = {
              ...attributes,
              powerPreference: 'high-performance',
              antialias: false,
              alpha: false,
              depth: true,
              stencil: false,
              preserveDrawingBuffer: true,
              premultipliedAlpha: true,
              failIfMajorPerformanceCaveat: false,
              desynchronized: true
            };
            const context = originalGetContext.call(this, type, preventLossAttributes);
            
            if (context) {
              this.addEventListener('webglcontextlost', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('WebGL context loss prevented');
                return false;
              }, true);

              this.addEventListener('webglcontextrestored', (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
              }, true);
            }
            
            return context;
          }
          return originalGetContext.call(this, type, attributes);
        };

        if (window.WebGLRenderingContext) {
          const originalIsContextLost = WebGLRenderingContext.prototype.isContextLost;
          WebGLRenderingContext.prototype.isContextLost = function() {
            return false;
          };
        }
        
        if (window.WebGL2RenderingContext) {
          const originalIsContextLost = WebGL2RenderingContext.prototype.isContextLost;
          WebGL2RenderingContext.prototype.isContextLost = function() {
            return false;
          };
        }
      `, true).catch(() => {});
    });
  };

  const adjustSettingsForPerformance = () => {
    const memInfo = process.getSystemMemoryInfo();
    const totalMemoryMB = Math.floor(memInfo.total / 1024);
    const isLowEnd = totalMemoryMB < 8192;
    const isMidRange = totalMemoryMB >= 8192 && totalMemoryMB < 16384;
    
    if (isLowEnd) {
      app.commandLine.appendSwitch('disable-gpu-vsync');
      app.commandLine.appendSwitch('disable-background-timer-throttling');
      app.commandLine.appendSwitch('memory-pressure-off');
      anubisView?.webContents.setFrameRate(30);
    } else if (isMidRange) {
      app.commandLine.appendSwitch('enable-gpu-rasterization');
      anubisView?.webContents.setFrameRate(60);
    } else {
      app.commandLine.appendSwitch('enable-gpu-rasterization');
      app.commandLine.appendSwitch('ignore-gpu-blocklist');
      anubisView?.webContents.setFrameRate(60);
    }
  };

  adjustSettingsForPerformance();
  preventWebGLContextLoss();
  setInterval(optimizePerformance, 600000);

  anubisView.webContents.on('render-process-gone', (event, details) => {
    console.error('Render process gone:', details.reason);
    if (details.reason === 'crashed' || details.reason === 'oom') {
      handleCrash();
    }
  });

  anubisView.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame && errorCode < -100) handleCrash();
  });

  anubisView.webContents.addListener('did-finish-load', () => {
    crashRecoveryAttempts = 0;
    isLoading = false;
    updateFPS(anubisView.webContents);
  });

  const memoryManager = setInterval(() => {
    const memInfo = process.getSystemMemoryInfo();
    const totalMemoryMB = Math.floor(memInfo.total / 1024);
    const isLowEnd = totalMemoryMB < 8192;
    const cleanupThreshold = isLowEnd ? 64 * 1024 : 32 * 1024;
    
    if (memInfo.free < cleanupThreshold) {
      if (!isLoading) {
        if (global.gc) global.gc();
        anubisView?.webContents.session.clearStorageData({
          storages: isLowEnd ? ['serviceworkers', 'cachestorage'] : ['serviceworkers']
        }).catch(() => {});
      }
    }
  }, 300000);

  mainWindow.on('minimize', () => {
    if (global.gc) {
      global.gc();
    }
  });

  mainWindow.on('closed', () => {
    clearInterval(memoryManager);
    mainWindow = null;
  });

  const updateViewBounds = () => {
    if (!mainWindow) return;
    
    const bounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const workArea = display.workArea;
    const isMaximized = mainWindow.isMaximized();
    const isFullScreen = mainWindow.isFullScreen();
    const titleBarHeight = 32;

    const currentView = activeExternalTab ? externalTabs.get(activeExternalTab) : anubisView;
    if (!currentView) return;

    if (isFullScreen) {
      currentView.setBounds({
        x: 0,
        y: titleBarHeight,
        width: bounds.width,
        height: bounds.height - titleBarHeight
      });
    } else if (isMaximized) {
      const availableWidth = workArea.width;
      const availableHeight = workArea.height;
      
      mainWindow.setBounds({
        x: workArea.x,
        y: workArea.y,
        width: availableWidth,
        height: availableHeight
      });

      currentView.setBounds({
        x: 0,
        y: titleBarHeight,
        width: availableWidth,
        height: availableHeight - titleBarHeight
      });

    } else {
      const windowBounds = mainWindow.getBounds();
      currentView.setBounds({
        x: 0,
        y: titleBarHeight,
        width: windowBounds.width,
        height: windowBounds.height - titleBarHeight
      });
    }
  };

  mainWindow.on('resize', updateViewBounds);
  mainWindow.on('maximize', updateViewBounds);
  mainWindow.on('unmaximize', updateViewBounds);
  mainWindow.on('move', updateViewBounds);
  mainWindow.on('enter-full-screen', updateViewBounds);
  mainWindow.on('leave-full-screen', updateViewBounds);

  mainWindow.once('ready-to-show', () => {
    updateViewBounds();
    if (settings.startFullscreen) {
      mainWindow?.maximize();
    }
    mainWindow?.show();
    mainWindow?.focus();

    if (app.isPackaged) {
      log.info('checking for updates on startup.');
      autoUpdater.checkForUpdatesAndNotify();
    } else {
      log.info('skipping update check on startup.');
    }
  });

  mainWindow.on('focus', () => {
    if (!mainWindow) return;
    mainWindow.webContents.setZoomFactor(1);
    mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
    updateViewBounds();
    
    const currentView = activeExternalTab ? externalTabs.get(activeExternalTab) : anubisView;
    if (currentView) {
      currentView.webContents.focus();
    }
  });

  nativeTheme.on('updated', () => {
    if (!mainWindow) return;
    const isDark = nativeTheme.shouldUseDarkColors;
    mainWindow.setBackgroundColor(isDark ? '#202020' : '#ffffff');
    updateViewBounds();
  });

  let isQuitting = false;
  app.on('before-quit', () => {
    isQuitting = true;
  });

  mainWindow.on('close', (event) => {
    if (settingsWindow) {
      settingsWindow.destroy();
      settingsWindow = null;
    }
    if (externalLinkWindow) {
      externalLinkWindow.destroy();
      externalLinkWindow = null;
    }
    for (const [id, view] of externalTabs.entries()) {
      view.webContents.removeAllListeners();
      view.webContents.close();
      externalTabs.delete(id);
    }
    if (anubisView) {
      anubisView.webContents.removeAllListeners();
      anubisView.webContents.close();
    }
    app.exit(0);
  });

  mainWindow.webContents.addListener('render-process-gone', async (event, details) => {
    if (details.reason === 'crashed') {
      console.error('Process crashed, attempting GPU recovery');
      try {
        await loadContent();
      } catch (error) {
        console.error('Failed to reload after crash:', error);
      }
    }
  });

  ipcMain.on('minimize-window', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('maximize-window', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      if (process.platform === 'darwin') {
        const display = screen.getDisplayMatching(mainWindow.getBounds());
        const centerX = display.bounds.x + (display.bounds.width - initialWindowBounds.width) / 2;
        const centerY = display.bounds.y + (display.bounds.height - initialWindowBounds.height) / 2;
        mainWindow.setBounds({ x: centerX, y: centerY, width: initialWindowBounds.width, height: initialWindowBounds.height }, true);
      } else {
        mainWindow.unmaximize();
      }
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on('close-window', () => {
    mainWindow?.close();
  });

  ipcMain.on('toggle-fullscreen', (_event, isFullscreen) => {
    if (!mainWindow) return;
    
    if (isFullscreen) {
      mainWindow.setFullScreen(true);
      mainWindow.setAutoHideMenuBar(true);
      
      const currentView = activeExternalTab ? externalTabs.get(activeExternalTab) : anubisView;
      if (currentView) {
        const bounds = mainWindow.getBounds();
        currentView.setBounds({
          x: 0,
          y: 32,
          width: bounds.width,
          height: bounds.height - 32
        });
      }
    } else {
      mainWindow.setFullScreen(false);
      mainWindow.setAutoHideMenuBar(false);
      updateViewBounds();
    }
  });

  ipcMain.on('refresh-page', () => {
    anubisView.webContents.reload();
  });

  ipcMain.on('clear-cache', async () => {
    const session = anubisView.webContents.session;
    try {
      await session.clearCache();
      await session.clearStorageData({
        storages: ['serviceworkers', 'cachestorage', 'shadercache'],
        quotas: ['temporary']
      });
      
      if (global.gc) {
        global.gc();
      }
      
      anubisView.webContents.reload();
    } catch (error) {
      console.error('Error clearing cache:', error);
      anubisView.webContents.reload();
    }
  });

  ipcMain.on('clear-cookies', async () => {
    const session = anubisView.webContents.session;
    try {
      await session.clearStorageData({
        storages: ['cookies']
      });
      anubisView.webContents.reload();
    } catch (error) {
      console.error('Error clearing cookies:', error);
      anubisView.webContents.reload();
    }
  });

  globalShortcut.register('CommandOrControl+R', () => {
    anubisView.webContents.reload();
  });

  globalShortcut.register('F5', () => {
    anubisView.webContents.reload();
  });

  globalShortcut.register('CommandOrControl+Shift+I', () => {
    mainWindow?.webContents.openDevTools({ mode: 'detach' });
  });

  ipcMain.on('open-settings', () => {
    if (settingsWindow) {
      settingsWindow.focus();
      return;
    }

    settingsWindow = new BrowserWindow({
      width: 360,
      height: 500,
      parent: mainWindow!,
      modal: false,
      frame: false,
      resizable: false,
      maximizable: false,
      minimizable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1a1a' : '#f8f8f8'
    });

    settingsWindow.setMaxListeners(20);

    if (mainWindow) {
      const parentBounds = mainWindow.getBounds();
      const settingsBounds = settingsWindow.getBounds();
      settingsWindow.setPosition(
        Math.round(parentBounds.x + (parentBounds.width - settingsBounds.width) / 2),
        Math.round(parentBounds.y + (parentBounds.height - settingsBounds.height) / 2)
      );
    }

    const settingsPath = app.isPackaged 
      ? path.join(__dirname, 'settings.html')
      : path.join(__dirname, '../src/settings.html');
    settingsWindow.loadFile(settingsPath);
    
    settingsWindow.once('ready-to-show', () => {
      settingsWindow?.webContents.send('settings-load', settings);
      settingsWindow?.show();
    });

    settingsWindow.on('closed', () => {
      revertSettings();
      settingsWindow = null;
    });
  });

  ipcMain.on('go-back', () => {
    if (externalLinkWindow) {
      externalLinkWindow.close();
      externalLinkWindow = null;
    }
    if (settingsWindow) {
      settingsWindow.close();
      settingsWindow = null;
    }
  });

  ipcMain.on('preview-settings', (_event, previewSettings) => {
    if (mainWindow) {
      mainWindow.setAutoHideMenuBar(!previewSettings.showTitleBar);
      
      let titleBarColor = previewSettings.titleBarColor;
      if (!titleBarColor || titleBarColor === '#1a1a1a' || titleBarColor === '#f8f8f8') {
        titleBarColor = previewSettings.theme === 'dark' || 
          (previewSettings.theme === 'system' && nativeTheme.shouldUseDarkColors) 
          ? '#1a1a1a' : '#f8f8f8';
      }
      
      mainWindow.setBackgroundColor(titleBarColor);
      mainWindow.webContents.send('update-colors', titleBarColor);
      if (settingsWindow) {
        settingsWindow.setBackgroundColor(titleBarColor);
        settingsWindow.webContents.send('update-colors', titleBarColor);
      }
      
      if (previewSettings.theme === 'dark') {
        nativeTheme.themeSource = 'dark';
      } else if (previewSettings.theme === 'light') {
        nativeTheme.themeSource = 'light';
      } else {
        nativeTheme.themeSource = 'system';
      }
    }
  });

  const revertSettings = () => {
    if (mainWindow) {
      let titleBarColor = settings.titleBarColor;
      if (!titleBarColor || titleBarColor === '#1a1a1a' || titleBarColor === '#f8f8f8') {
        titleBarColor = settings.theme === 'dark' || 
          (settings.theme === 'system' && nativeTheme.shouldUseDarkColors) 
          ? '#1a1a1a' : '#f8f8f8';
      }
      
      mainWindow.setBackgroundColor(titleBarColor);
      mainWindow.webContents.send('update-colors', titleBarColor);

      if (settings.theme === 'dark') { nativeTheme.themeSource = 'dark'; }
      else if (settings.theme === 'light') { nativeTheme.themeSource = 'light'; } 
      else { nativeTheme.themeSource = 'system'; }
    }
  };

  ipcMain.on('close-settings', () => {
    if (settingsWindow) {
      revertSettings();
      settingsWindow.close();
      settingsWindow = null;
    }
  });

  anubisView.setBackgroundColor('#00000000');

  ipcMain.on('update-settings', (_event, newSettings) => {
    const oldGameUrl = settings.gameUrl;
    const oldPerformanceMode = settings.performanceMode;
    settings = { ...settings, ...newSettings };
    saveSettings();

    if (mainWindow) {
      let titleBarColor = settings.titleBarColor;
      if (!titleBarColor || titleBarColor === '#1a1a1a' || titleBarColor === '#f8f8f8') {
        titleBarColor = settings.theme === 'dark' || 
          (settings.theme === 'system' && nativeTheme.shouldUseDarkColors) 
          ? '#1a1a1a' : '#f8f8f8';
      }
      
      mainWindow.setBackgroundColor(titleBarColor);
      mainWindow.webContents.send('update-colors', titleBarColor);

      if (settingsWindow) {
        settingsWindow.setBackgroundColor(titleBarColor);
        settingsWindow.webContents.send('update-colors', titleBarColor);
      }

      if (settings.theme === 'dark') { nativeTheme.themeSource = 'dark'; }
      else if (settings.theme === 'light') { nativeTheme.themeSource = 'light'; } 
      else { nativeTheme.themeSource = 'system'; }
    }

    if (anubisView && settings.gameUrl !== oldGameUrl) {
      anubisView.webContents.loadURL(settings.gameUrl);
    }

    if (settings.performanceMode !== oldPerformanceMode) {
      app.relaunch();
      app.exit(0);
    }
  });

  const updateFPS = (webContents: WebContents) => {
    webContents.setBackgroundThrottling(false);
    webContents.setZoomFactor(1);
    webContents.setVisualZoomLevelLimits(1, 1);
    webContents.invalidate();
  };

  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    const currentView = activeExternalTab ? externalTabs.get(activeExternalTab) : anubisView;
    if (!currentView) return;

    const currentZoom = currentView.webContents.getZoomFactor();
    let newZoom = currentZoom;

    switch (direction) {
      case 'in':
        newZoom = Math.min(currentZoom + 0.1, 3.0);
        break;
      case 'out':
        newZoom = Math.max(currentZoom - 0.1, 0.3);
        break;
      case 'reset':
        newZoom = 1.0;
        break;
    }

      currentView.webContents.setZoomFactor(newZoom);
    mainWindow?.webContents.send('zoom-changed', newZoom);
  };

  ipcMain.on('zoom-in', () => handleZoom('in'));
  ipcMain.on('zoom-out', () => handleZoom('out'));
  ipcMain.on('zoom-reset', () => handleZoom('reset'));

  const createExternalTab = (url: string) => {
    const tabId = Date.now();
    const externalView = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        scrollBounce: true
      }
    });

    externalTabs.set(tabId, externalView);
    activeExternalTab = tabId;

    mainWindow?.addBrowserView(externalView);
    updateViewBounds();
    updateFPS(externalView.webContents);

    externalView.webContents.insertCSS(`
      ::-webkit-scrollbar {
        width: initial;
        height: initial;
      }
      ::-webkit-scrollbar-track {
        background: initial;
      }
      ::-webkit-scrollbar-thumb {
        background: initial;
      }
    `);

    externalView.webContents.loadURL(url);

    mainWindow?.webContents.send('external-tab-created', {
      id: tabId,
      title: url
    });

    externalView.webContents.on('page-title-updated', (event, title) => {
      mainWindow?.webContents.send('external-tab-updated', {
        id: tabId,
        title
      });
    });

    return tabId;
  };

  const showExternalLinkPrompt = (url: string) => {
    if (externalLinkWindow) {
      externalLinkWindow.focus();
      return;
    }

    if (settingsWindow) {
      settingsWindow.close();
    }

    externalLinkWindow = new BrowserWindow({
      width: 360,
      height: 200,
      parent: mainWindow!,
      modal: true,
      frame: false,
      resizable: false,
      maximizable: false,
      minimizable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1a1a' : '#f8f8f8'
    });

    if (mainWindow) {
      const parentBounds = mainWindow.getBounds();
      const promptBounds = externalLinkWindow.getBounds();
      externalLinkWindow.setPosition(
        Math.round(parentBounds.x + (parentBounds.width - promptBounds.width) / 2),
        Math.round(parentBounds.y + (parentBounds.height - promptBounds.height) / 2)
      );
    }

    const externalLinkPath = app.isPackaged 
      ? path.join(__dirname, 'external-link-prompt.html')
      : path.join(__dirname, '../src/external-link-prompt.html');
    externalLinkWindow.loadFile(externalLinkPath);
    
    externalLinkWindow.once('ready-to-show', () => {
      externalLinkWindow?.webContents.send('external-link-data', { url });
      setTimeout(() => {
        const contentHeight = externalLinkWindow?.webContents.executeJavaScript(`
          document.body.scrollHeight;
        `);
        if (contentHeight) {
          contentHeight.then((height) => {
            if (externalLinkWindow) {
              const newHeight = Math.min(Math.max(height, 200), 300);
              const bounds = externalLinkWindow.getBounds();
              externalLinkWindow.setBounds({ ...bounds, height: newHeight });
            }
          });
        }
      }, 100);
      externalLinkWindow?.show();
    });

    externalLinkWindow.on('closed', () => {
      externalLinkWindow = null;
    });
  };

  ipcMain.on('open-external-link', (_event, url) => {
    if (externalLinkWindow) {
      externalLinkWindow.close();
      externalLinkWindow = null;
    }

    if (url.startsWith('https://discord.com') || url.startsWith('https://discordapp.com')) {
      handleDiscordLink(url);
    } else {
      createExternalTab(url);
    }
  });

  ipcMain.on('close-external-tab', (_event, tabId) => {
    const view = externalTabs.get(tabId);
    if (view) {
      mainWindow?.removeBrowserView(view);
      view.webContents.removeAllListeners();
      view.webContents.close();
      externalTabs.delete(tabId);
      activeExternalTab = null;
      mainWindow?.webContents.send('external-tab-closed', tabId);
      mainWindow?.setBrowserView(anubisView);
      updateViewBounds();
    }
  });

  ipcMain.on('switch-to-tab', (_event, tabId) => {
    if (tabId === 'main') {
      activeExternalTab = null;
      mainWindow?.setBrowserView(anubisView);
    } else {
      const view = externalTabs.get(tabId);
      if (view) {
        activeExternalTab = tabId;
        mainWindow?.setBrowserView(view);
      }
    }
    updateViewBounds();
  });

  const handleDiscordLink = (url: string) => {
    shell.openExternal(url).catch((error: Error) => {
      console.error('Failed to open URL:', error);
    });
  };

  mainWindow.on('enter-full-screen', () => {
    mainWindow?.webContents.send('fullscreen-changed', true);
  });

  mainWindow.on('leave-full-screen', () => {
    mainWindow?.webContents.send('fullscreen-changed', false);
  });
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  for (const [id, view] of externalTabs.entries()) {
    view.webContents.removeAllListeners();
    view.webContents.close();
    externalTabs.delete(id);
  }
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
}); 