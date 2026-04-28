import { contextBridge, ipcRenderer } from "electron";

// Type definitions for update status
export type UpdateStatus = 
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error"
  | "dev-mode";

export interface UpdateStatusEvent {
  status: UpdateStatus;
  version?: string;
  releaseDate?: string;
  releaseNotes?: string | { body?: string } | Array<{ body?: string }>;
  percent?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
  message?: string;
}

export interface AppInfo {
  version: string;
  platform: NodeJS.Platform;
  arch: string;
  isPackaged: boolean;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  // App info
  getVersion: () => ipcRenderer.invoke("get-app-version"),
  getPath: (name: string) => ipcRenderer.invoke("get-app-path", name),
  getAppInfo: () => ipcRenderer.invoke("get-app-info") as Promise<AppInfo>,
  
  // External links
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
  
  // Platform detection
  platform: process.platform,
  isElectron: true,

  // Auto-update functionality
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  getUpdateSettings: () => ipcRenderer.invoke("get-update-settings"),

  // Update event listeners
  onUpdateStatus: (callback: (event: UpdateStatusEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: UpdateStatusEvent) => callback(data);
    ipcRenderer.on("update-status", handler);
    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener("update-status", handler);
    };
  },
});

// Type declarations for TypeScript
declare global {
  interface Window {
    electron: {
      getVersion: () => Promise<string>;
      getPath: (name: string) => Promise<string>;
      getAppInfo: () => Promise<AppInfo>;
      openExternal: (url: string) => Promise<void>;
      platform: NodeJS.Platform;
      isElectron: boolean;
      // Auto-update
      checkForUpdates: () => Promise<{ status: string; updateInfo?: unknown; message?: string }>;
      downloadUpdate: () => Promise<{ status: string; message?: string }>;
      installUpdate: () => Promise<void>;
      getUpdateSettings: () => Promise<{ autoCheck: boolean; autoInstall: boolean }>;
      onUpdateStatus: (callback: (event: UpdateStatusEvent) => void) => () => void;
    };
  }
}
