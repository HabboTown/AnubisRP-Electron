import { app, BrowserWindow, globalShortcut, ipcMain, nativeTheme, BrowserView, screen, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import { WebContents, Event as ElectronEvent } from 'electron/main';
import { UpdateInfo } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let anubisView: BrowserView | null = null;
let externalLinkWindow: BrowserWindow | null = null;
let externalTabs: Map<number, BrowserView> = new Map();
let activeExternalTab: number | null = null;

const settingsPath = path.join(app.getPath('userData'), 'settings.json');
let settings = {
    theme: 'system',
    titleBarColor: '#1a1a1a',
    startFullscreen: false,
    fps: 60,
    gameUrl: 'https://anubisrp.com'
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

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webgl: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments: [
        '--js-flags="--max-old-space-size=8192"',
        '--enable-gpu-rasterization',
        '--enable-zero-copy',
        '--ignore-gpu-blacklist',
        '--disable-gpu-vsync',
        '--enable-webgl',
        '--enable-accelerated-2d-canvas',
        '--disable-software-rasterizer',
        '--enable-hardware-overlays="single-fullscreen,single-video"',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-features=OutOfBlinkCors',
        '--disable-site-isolation-trials',
        '--autoplay-policy=no-user-gesture-required'
      ]
    },
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 10, y: 16 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#202020' : '#ffffff',
    show: false,
    icon: process.platform === 'darwin' ? path.join(__dirname, '../images/icon.icns'): process.platform === 'win32' ? path.join(__dirname, '../images/icon.ico') : path.join(__dirname, '../images/icon.png'),
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true
  });

  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
  app.commandLine.appendSwitch('disable-site-isolation-trials');
  app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer,NetworkServiceInProcess,QuicForceEnabled,BackForwardCache,NetworkQualityEstimator');
  app.commandLine.appendSwitch('ignore-certificate-errors');
  app.commandLine.appendSwitch('enable-gpu-memory-buffer-compositor-resources');
  app.commandLine.appendSwitch('enable-hardware-overlays');
  app.commandLine.appendSwitch('enable-zero-copy');
  app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');
  app.commandLine.appendSwitch('force-gpu-mem-available-mb', '2048');
  app.commandLine.appendSwitch('enable-unsafe-webgpu');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  app.commandLine.appendSwitch('enable-oop-rasterization');
  app.commandLine.appendSwitch('enable-raw-draw');
  app.commandLine.appendSwitch('enable-quic');
  app.commandLine.appendSwitch('enable-parallel-downloading');
  app.commandLine.appendSwitch('enable-tcp-fast-open');
  app.commandLine.appendSwitch('enable-websocket-multiplexing');
  app.commandLine.appendSwitch('disk-cache-size', '104857600');
  app.commandLine.appendSwitch('enable-gpu-shader-disk-cache');
  app.commandLine.appendSwitch('enable-gpu-shader-cache-for-drivers');
  app.commandLine.appendSwitch('enable-gpu-program-cache');
  app.commandLine.appendSwitch('use-angle', 'gl');
  app.commandLine.appendSwitch('enable-accelerated-video-decode');
  app.commandLine.appendSwitch('enable-accelerated-mjpeg-decode');
  app.commandLine.appendSwitch('enable-accelerated-video');
  app.commandLine.appendSwitch('disable-gpu-process-crash-limit');
  app.commandLine.appendSwitch('disable-gpu-vsync');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('max-active-webgl-contexts', '100');

  const anubisView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webgl: true,
      webSecurity: true,
      partition: 'persist:anubisView',
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
      enablePreferredSizeMode: true,
      spellcheck: false,
      enableWebSQL: false,
      v8CacheOptions: 'none',
      javascript: true,
      webviewTag: false,
      images: true,
      textAreasAreResizable: false,
      defaultEncoding: 'UTF-8',
      offscreen: false
    }
  });

  const session = anubisView.webContents.session;

  const cachePath = path.join(app.getPath('userData'), 'Cache');
  if (!fs.existsSync(cachePath)) {
    try {
      fs.mkdirSync(cachePath, { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  session.setSpellCheckerEnabled(false);
  session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'fullscreen'];
    callback(allowedPermissions.includes(permission));
  });
  
  try {
    session.clearStorageData({
      storages: ['shadercache'],
      quotas: ['temporary']
    });
  } catch (error) {
    console.error('Failed to clear shader cache:', error);
  }

  session.setSSLConfig({
    minVersion: 'tls1.2',
    maxVersion: 'tls1.3'
  });
  
  session.setProxy({ mode: 'direct' });
  
  anubisView.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(settings.gameUrl)) {
      showExternalLinkPrompt(url);
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });

  anubisView.webContents.setAudioMuted(false);
  
  anubisView.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(settings.gameUrl)) {
      event.preventDefault();
      showExternalLinkPrompt(url);
    }
  });

  anubisView.webContents.setFrameRate(settings.fps || 60);
  anubisView.webContents.setBackgroundThrottling(false);

  const optimizeMemory = () => {
    if (anubisView && anubisView.webContents) {
      if (!isLoading) {
        anubisView.webContents.send('optimize-memory');
      }
    }
  };

  setInterval(optimizeMemory, 60000);
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
      await anubisView?.webContents.loadURL(settings.gameUrl, {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36', //idk random
        httpReferrer: settings.gameUrl
      });
    } catch (error: unknown) {
      console.error('Load failed:', error);
      try {
        await anubisView?.webContents.loadURL(settings.gameUrl);
      } catch (retryError) {
        console.error('Retry failed:', retryError);
        setTimeout(loadContent, 2000);
      }
    }
  };

  mainWindow.setBrowserView(anubisView);
  mainWindow.loadFile(path.join(__dirname, '../src/titlebar.html'));
  mainWindow.webContents.on('did-finish-load', () => {
    const isDark = nativeTheme.shouldUseDarkColors;
    const initialColor = settings.titleBarColor || (isDark ? '#1a1a1a' : '#f8f8f8');
    mainWindow?.webContents.send('update-colors', initialColor);
    loadContent();
  });

  let crashRecoveryAttempts = 0;
  const MAX_RECOVERY_ATTEMPTS = 3;

  const handleCrash = async () => {
    if (crashRecoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
      if (mainWindow) {
        const choice = await mainWindow.webContents.executeJavaScript(`
          confirm('The game has crashed repeatedly. Would you like to try clearing cache and reloading?')
        `);
        
        if (choice) {
          crashRecoveryAttempts = 0;
          const session = anubisView.webContents.session;
          await session.clearCache();
          await session.clearStorageData({
            storages: ['serviceworkers', 'shadercache']
          });
          anubisView.webContents.reload();
        }
      }
      return;
    }

    crashRecoveryAttempts++;
    console.log(`Attempting crash recovery (${crashRecoveryAttempts}/${MAX_RECOVERY_ATTEMPTS})`);
    
    if (!isLoading) {
      anubisView.webContents.reload();
    }
  };

  anubisView.webContents.addListener('render-process-gone', (event, details) => {
    console.log('Render process gone:', details.reason);
    handleCrash();
  });

  anubisView.webContents.addListener('did-fail-load', (event, errorCode, errorDescription) => {
    console.log('Failed to load:', errorDescription);
    handleCrash();
  });

  anubisView.webContents.addListener('did-finish-load', () => {
    crashRecoveryAttempts = 0;
    isLoading = false;
  });

  const memoryManager = setInterval(() => {
    const memInfo = process.getSystemMemoryInfo();
    if (memInfo.free < 512 * 1024) {
      if (!isLoading) {
        console.log('Critical memory pressure, performing minimal cleanup...');
        if (global.gc) {
          global.gc();
        }
        session.clearStorageData({
          storages: ['cachestorage'],
          quotas: ['temporary']
        });
      }
    }
  }, 30000);

  mainWindow.on('minimize', () => {
    if (global.gc) {
      global.gc();
    }
    session.clearStorageData({
      storages: ['shadercache'],
      quotas: ['temporary']
    });
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

    const currentView = activeExternalTab ? externalTabs.get(activeExternalTab) : anubisView;
    if (!currentView) return;

    if (isFullScreen) {
      currentView.setBounds({
        x: 0,
        y: 32,
        width: bounds.width,
        height: bounds.height - 32
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
        y: 32,
        width: availableWidth,
        height: availableHeight - 32
      });
    } else {
      const windowBounds = mainWindow.getBounds();
      currentView.setBounds({
        x: 0,
        y: 32,
        width: windowBounds.width,
        height: windowBounds.height - 32
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
  });

  mainWindow.on('focus', () => {
    if (!mainWindow) return;
    mainWindow.webContents.setZoomFactor(1);
    mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
    updateViewBounds();
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

  mainWindow.webContents.addListener('render-process-gone', (event, details) => {
    if (details.reason === 'crashed' || details.reason === 'oom') {
      app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192');
      mainWindow?.reload();
    }
  });

  ipcMain.on('minimize-window', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('maximize-window', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
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
        storages: [
          'shadercache',
          'serviceworkers',
          'cachestorage',
          'websql',
          'indexdb',
          'filesystem',
          'localstorage'
        ],
        quotas: ['temporary']
      });
      
      await session.clearCodeCaches({ urls: ['*://*/*'] });
      
      if (global.gc) {
        global.gc();
      }
      
      anubisView.webContents.reload();
    } catch (error) {
      console.error('Error clearing cache:', error);

      try {
        await session.clearCache();
        anubisView.webContents.reload();
      } catch (retryError) {
        console.error('Retry error clearing cache:', retryError);
      }
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
    }
  });

  globalShortcut.register('CommandOrControl+R', () => {
    anubisView.webContents.reload();
  });

  globalShortcut.register('F5', () => {
    anubisView.webContents.reload();
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

    settingsWindow.loadFile(path.join(__dirname, '../src/settings.html'));
    
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

      app.commandLine.appendSwitch('force-max-fps', (settings.fps || 60).toString());
    }
  };

  ipcMain.on('close-settings', () => {
    if (settingsWindow) {
      revertSettings();
      settingsWindow.close();
      settingsWindow = null;
    }
  });

  app.commandLine.appendSwitch('force-max-fps', (settings.fps || 60).toString());
  anubisView.setBackgroundColor('#00000000');

  ipcMain.on('update-settings', (_event, newSettings) => {
    const oldGameUrl = settings.gameUrl;
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

      app.commandLine.appendSwitch('force-max-fps', (settings.fps || 60).toString());
    }

    if (anubisView && settings.gameUrl !== oldGameUrl) anubisView.webContents.loadURL(settings.gameUrl);
  });

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

    externalLinkWindow.loadFile(path.join(__dirname, '../src/external-link-prompt.html'));
    
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

  globalShortcut.register('Escape', () => {
    if (mainWindow?.isFullScreen()) {
      mainWindow.setFullScreen(false);
      mainWindow.setAutoHideMenuBar(false);
      updateViewBounds();
      mainWindow.webContents.send('fullscreen-changed', false);
    }
  });

  anubisView.webContents.addListener('destroyed', () => {
    console.log('WebContents destroyed, attempting recovery...');
    try {
      app.commandLine.appendSwitch('gpu-rasterization-reset');
      app.commandLine.appendSwitch('ignore-gpu-blocklist');
      app.commandLine.appendSwitch('disable-gpu-process-crash-limit');
      
      setTimeout(() => {
        anubisView?.webContents.reload();
      }, 1000);
    } catch (error) {
      console.error('Failed to recover from crash:', error);
    }
  });

  let updateDownloaded = false;
  let isCheckingForUpdates = false;

  const checkForUpdates = async () => {
    if (!mainWindow) return;
    if (isCheckingForUpdates) {
      console.log('Update check already in progress, skipping');
      return;
    }
    
    try {
      isCheckingForUpdates = true;
      mainWindow.webContents.send('checking-for-update');
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('Development mode - sending update-not-available');
        setTimeout(() => {
          if (mainWindow) {
            mainWindow.webContents.send('update-not-available');
            isCheckingForUpdates = false;
          }
        }, 500);
        return;
      }

      const result = await autoUpdater.checkForUpdates();
      if (!result) {
        console.log('No update check result, assuming latest version');
        mainWindow.webContents.send('update-not-available');
        isCheckingForUpdates = false;
        return;
      }
    } catch (error: any) {
      console.error('Update check error:', error);
      isCheckingForUpdates = false;
      if (mainWindow) {
        mainWindow.webContents.send('update-error', error.message || 'Unknown error occurred');
      }
    }
  };

  if (process.env.NODE_ENV === 'production') {
    autoUpdater.autoDownload = true;
    autoUpdater.allowDowngrade = false;
    const log = require('electron-log');
    autoUpdater.logger = log;
    log.transports.file.level = 'debug';
    
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: process.env.GITHUB_USERNAME || 'Hxmada',
      repo: 'AnubisRP-Electron',
      token: process.env.GH_TOKEN
    });
    
    autoUpdater.on('checking-for-update', () => {
      isCheckingForUpdates = true;
      if (mainWindow) {
        mainWindow.webContents.send('checking-for-update');
      }
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      isCheckingForUpdates = false;
      if (mainWindow) {
        mainWindow.webContents.send('update-available', info);
      }
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      isCheckingForUpdates = false;
      if (mainWindow) {
        mainWindow.webContents.send('update-not-available');
      }
    });

    autoUpdater.on('error', (err: Error) => {
      isCheckingForUpdates = false;
      if (mainWindow) {
        mainWindow.webContents.send('update-error', err.message);
      }
    });

    autoUpdater.on('download-progress', (progressObj) => {
      if (mainWindow) {
        mainWindow.webContents.send('update-progress', progressObj);
      }
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      isCheckingForUpdates = false;
      updateDownloaded = true;
      if (mainWindow) {
        mainWindow.webContents.send('update-downloaded', info);
      }
    });

    setTimeout(() => {
      if (!isCheckingForUpdates) {
        void checkForUpdates();
      }
    }, 5000);

    const updateCheckInterval = setInterval(() => {
      if (!isCheckingForUpdates) {
        void checkForUpdates();
      }
    }, 30 * 60 * 1000);

    mainWindow.on('closed', () => {
      clearInterval(updateCheckInterval);
    });
  }

  ipcMain.on('check-for-updates', () => {
    void checkForUpdates();
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('get-update-status', () => {
    return process.env.NODE_ENV === 'production' ? updateDownloaded : false;
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