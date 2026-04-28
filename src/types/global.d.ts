// Global type declarations

interface ElectronAppInfo {
  version: string;
  name?: string;
  platform: string;
  arch: string;
  isPackaged: boolean;
}

interface ElectronAPI {
  isElectron: boolean;
  getAppInfo: () => Promise<ElectronAppInfo>;
  onUpdateStatus: (callback: (event: {
    status: string;
    version?: string;
    releaseDate?: string;
    releaseNotes?: string | unknown[];
    percent?: number;
    transferred?: number;
    total?: number;
    bytesPerSecond?: number;
    message?: string;
  }) => void) => () => void;
  checkForUpdates: () => Promise<{ status: string; message?: string }>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  openExternal: (url: string) => void;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
