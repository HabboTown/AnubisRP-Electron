import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  refreshPage: () => ipcRenderer.send('refresh-page'),
  clearCache: () => ipcRenderer.send('clear-cache'),
  clearCookies: () => ipcRenderer.send('clear-cookies'),
  openSettings: () => ipcRenderer.send('open-settings'),
  closeSettings: () => ipcRenderer.send('close-settings'),
  goBack: () => ipcRenderer.send('go-back'),
  onLoadingProgress: (callback: (progress: number) => void) => {
    const handler = (_event: any, progress: number) => callback(progress);
    ipcRenderer.on('loading-progress', handler);
    return () => ipcRenderer.removeListener('loading-progress', handler);
  },
  onSettingsLoad: (callback: (settings: any) => void) => {
    const handler = (_event: any, settings: any) => callback(settings);
    ipcRenderer.on('settings-load', handler);
    return () => ipcRenderer.removeListener('settings-load', handler);
  },
  updateSettings: (settings: any) => ipcRenderer.send('update-settings', settings),
  previewSettings: (settings: any) => ipcRenderer.send('preview-settings', settings),
  onUpdateColors: (callback: (color: string) => void) => {
    const handler = (_event: any, color: string) => callback(color);
    ipcRenderer.on('update-colors', handler);
    return () => ipcRenderer.removeListener('update-colors', handler);
  },
  onExternalLinkData: (callback: (data: { url: string }) => void) => {
    const handler = (_event: any, data: { url: string }) => callback(data);
    ipcRenderer.on('external-link-data', handler);
    return () => ipcRenderer.removeListener('external-link-data', handler);
  },
  openExternalLink: (url: string) => ipcRenderer.send('open-external-link', url),
  toggleFullscreen: (isFullscreen: boolean) => ipcRenderer.send('toggle-fullscreen', isFullscreen),
  onFullscreenChanged: (callback: (isFullscreen: boolean) => void) => {
    const handler = (_event: any, isFullscreen: boolean) => callback(isFullscreen);
    ipcRenderer.on('fullscreen-changed', handler);
    return () => ipcRenderer.removeListener('fullscreen-changed', handler);
  },
  onExternalTabCreated: (callback: (data: { id: number, title: string }) => void) => {
    const handler = (_event: any, data: { id: number, title: string }) => callback(data);
    ipcRenderer.on('external-tab-created', handler);
    return () => ipcRenderer.removeListener('external-tab-created', handler);
  },
  onExternalTabUpdated: (callback: (data: { id: number, title: string }) => void) => {
    const handler = (_event: any, data: { id: number, title: string }) => callback(data);
    ipcRenderer.on('external-tab-updated', handler);
    return () => ipcRenderer.removeListener('external-tab-updated', handler);
  },
  onExternalTabClosed: (callback: (tabId: number) => void) => {
    const handler = (_event: any, tabId: number) => callback(tabId);
    ipcRenderer.on('external-tab-closed', handler);
    return () => ipcRenderer.removeListener('external-tab-closed', handler);
  },
  closeExternalTab: (tabId: number) => ipcRenderer.send('close-external-tab', tabId),
  switchToTab: (tabId: number | 'main') => ipcRenderer.send('switch-to-tab', tabId),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  onCheckingForUpdate: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('checking-for-update', handler);
    return () => ipcRenderer.removeListener('checking-for-update', handler);
  },
  onUpdateAvailable: (callback: (info: any) => void) => {
    const handler = (_event: any, info: any) => callback(info);
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  },
  onUpdateNotAvailable: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('update-not-available', handler);
    return () => ipcRenderer.removeListener('update-not-available', handler);
  },
  onUpdateError: (callback: (error: string) => void) => {
    const handler = (_event: any, error: string) => callback(error);
    ipcRenderer.on('update-error', handler);
    return () => ipcRenderer.removeListener('update-error', handler);
  },
  onUpdateProgress: (callback: (progressObj: any) => void) => {
    const handler = (_event: any, progressObj: any) => callback(progressObj);
    ipcRenderer.on('update-progress', handler);
    return () => ipcRenderer.removeListener('update-progress', handler);
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    const handler = (_event: any, info: any) => callback(info);
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  },
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  installUpdate: () => ipcRenderer.send('install-update'),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  removeListener: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, listener);
  }
}); 