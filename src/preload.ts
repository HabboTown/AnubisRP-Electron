import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  refreshPage: () => ipcRenderer.send('refresh-page'),
  clearCache: () => ipcRenderer.send('clear-cache'),
  clearCookies: () => ipcRenderer.send('clear-cookies'),
  openSettings: () => ipcRenderer.send('open-settings'),
  goBack: () => ipcRenderer.send('go-back'),
  onLoadingProgress: (callback: (progress: number) => void) => ipcRenderer.on('loading-progress', (_event, progress) => callback(progress)),
  onSettingsLoad: (callback: (settings: any) => void) => ipcRenderer.on('settings-load', (_event, settings) => callback(settings)),
  updateSettings: (settings: any) => ipcRenderer.send('update-settings', settings),
  previewSettings: (settings: any) => ipcRenderer.send('preview-settings', settings),
  onUpdateColors: (callback: (color: string) => void) => ipcRenderer.on('update-colors', (_event, color) => callback(color)),
  onExternalLinkData: (callback: (data: { url: string }) => void) => { ipcRenderer.on('external-link-data', (_event, data) => callback(data)); },
  openExternalLink: (url: string) => { ipcRenderer.send('open-external-link', url); },
  toggleFullscreen: (isFullscreen: boolean) => ipcRenderer.send('toggle-fullscreen', isFullscreen),
  onFullscreenChanged: (callback: (isFullscreen: boolean) => void) => ipcRenderer.on('fullscreen-changed', (_event, isFullscreen) => callback(isFullscreen)),
  onExternalTabCreated: (callback: (data: { id: number, title: string }) => void) => { ipcRenderer.on('external-tab-created', (_event, data) => callback(data)); },
  onExternalTabUpdated: (callback: (data: { id: number, title: string }) => void) => { ipcRenderer.on('external-tab-updated', (_event, data) => callback(data)); },
  onExternalTabClosed: (callback: (tabId: number) => void) => { ipcRenderer.on('external-tab-closed', (_event, tabId) => callback(tabId)); },
  closeExternalTab: (tabId: number) => { ipcRenderer.send('close-external-tab', tabId); },
  switchToTab: (tabId: number | 'main') => {  ipcRenderer.send('switch-to-tab', tabId); }
}); 