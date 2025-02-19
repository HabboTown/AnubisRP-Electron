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
  onExternalTabCreated: (callback: (tab: any) => void) => {
    const handler = (_event: any, tab: any) => callback(tab);
    ipcRenderer.on('external-tab-created', handler);
    return () => ipcRenderer.removeListener('external-tab-created', handler);
  },
  onExternalTabUpdated: (callback: (tab: any) => void) => {
    const handler = (_event: any, tab: any) => callback(tab);
    ipcRenderer.on('external-tab-updated', handler);
    return () => ipcRenderer.removeListener('external-tab-updated', handler);
  },
  onExternalTabClosed: (callback: (tabId: number) => void) => {
    const handler = (_event: any, tabId: number) => callback(tabId);
    ipcRenderer.on('external-tab-closed', handler);
    return () => ipcRenderer.removeListener('external-tab-closed', handler);
  },
  closeExternalTab: (tabId: number) => ipcRenderer.send('close-external-tab', tabId),
  switchToTab: (tabId: string | number) => ipcRenderer.send('switch-to-tab', tabId),
  onFullscreenChanged: (callback: (isFullscreen: boolean) => void) => {
    const handler = (_event: any, isFullscreen: boolean) => callback(isFullscreen);
    ipcRenderer.on('fullscreen-changed', handler);
    return () => ipcRenderer.removeListener('fullscreen-changed', handler);
  },
  zoomIn: () => ipcRenderer.send('zoom-in'),
  zoomOut: () => ipcRenderer.send('zoom-out'),
  zoomReset: () => ipcRenderer.send('zoom-reset'),
  onZoomChanged: (callback: (zoomFactor: number) => void) => {
    const handler = (_event: any, zoomFactor: number) => callback(zoomFactor);
    ipcRenderer.on('zoom-changed', handler);
    return () => ipcRenderer.removeListener('zoom-changed', handler);
  },
  toggleFullscreen: (isFullscreen: boolean) => ipcRenderer.send('toggle-fullscreen', isFullscreen)
}); 