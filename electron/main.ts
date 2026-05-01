import { app, BrowserWindow, shell, ipcMain } from "electron";
import { join } from "path";
import { spawn, execSync, ChildProcess } from "child_process";
import { existsSync, writeFileSync, appendFileSync, mkdirSync } from "fs";
import { autoUpdater, UpdateInfo, ProgressInfo } from "electron-updater";

// Handle EPIPE errors gracefully (happens when stdout pipe is closed, e.g., head command)
process.stdout.on("error", (err) => {
  if (err.code === "EPIPE") return; // Ignore EPIPE
  console.error("stdout error:", err);
});
process.stderr.on("error", (err) => {
  if (err.code === "EPIPE") return; // Ignore EPIPE  
  console.error("stderr error:", err);
});

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;
let nextServer: ChildProcess | null = null;
const isDev = process.env.NODE_ENV === "development";
const PORT = 3456;

// =============================================================================
// Update Logger - Persistent logging for debugging auto-updates
// =============================================================================
const logDir = app.isPackaged ? join(app.getPath("userData"), "logs") : join(__dirname, "..", "logs");
const logFile = join(logDir, `update-${new Date().toISOString().split("T")[0]}.log`);

function ensureLogDir() {
  try {
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
  } catch {
    // Ignore errors creating log directory
  }
}

function updateLog(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log("[AutoUpdater]", message);
  try {
    ensureLogDir();
    appendFileSync(logFile, logMessage);
  } catch {
    // Ignore logging errors
  }
}

// =============================================================================
// Auto-Updater Configuration
// =============================================================================
function setupAutoUpdater() {
  // Configure logging
  autoUpdater.logger = {
    info: (message: string) => updateLog(`INFO: ${message}`),
    warn: (message: string) => updateLog(`WARN: ${message}`),
    error: (message: string) => updateLog(`ERROR: ${message}`),
    debug: (message: string) => updateLog(`DEBUG: ${message}`),
  };

  // Enable differential (delta) updates for faster downloads
  autoUpdater.autoDownload = false; // Let user decide when to download
  autoUpdater.autoInstallOnAppQuit = true; // Install when user quits
  autoUpdater.allowDowngrade = false; // Don't allow downgrading to older versions
  
  // Event handlers - forward to renderer
  autoUpdater.on("checking-for-update", () => {
    updateLog("Checking for updates...");
    sendUpdateStatus("checking");
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    updateLog(`Update available: ${info.version}`);
    sendUpdateStatus("available", {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on("update-not-available", (info: UpdateInfo) => {
    updateLog(`No update available. Current version: ${app.getVersion()}, Latest: ${info.version}`);
    sendUpdateStatus("not-available", {
      version: info.version,
    });
  });

  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    updateLog(`Download progress: ${progress.percent.toFixed(1)}% (${(progress.transferred / 1024 / 1024).toFixed(2)}MB / ${(progress.total / 1024 / 1024).toFixed(2)}MB)`);
    sendUpdateStatus("downloading", {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    updateLog(`Update downloaded: ${info.version}`);
    sendUpdateStatus("downloaded", {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on("error", (error: Error) => {
    updateLog(`Update error: ${error.message}\n${error.stack}`);
    sendUpdateStatus("error", {
      message: error.message,
    });
  });

  updateLog("AutoUpdater initialized");
}

function sendUpdateStatus(status: string, data?: Record<string, unknown>) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-status", { status, ...data });
  }
}

// =============================================================================
// Update IPC Handlers
// =============================================================================
function setupUpdateIPC() {
  // Check for updates manually
  ipcMain.handle("check-for-updates", async () => {
    updateLog("Manual update check triggered");
    if (isDev) {
      updateLog("Skipping update check in development mode");
      return { status: "dev-mode", message: "Updates are disabled in development mode" };
    }
    
    // Check if publish config exists (autoUpdater will fail without it)
    try {
      const result = await autoUpdater.checkForUpdates();
      return { status: "checking", updateInfo: result?.updateInfo };
    } catch (error) {
      const err = error as Error;
      updateLog(`Check for updates failed: ${err.message}`);
      
      // Check for missing app-update.yml (old builds)
      if (err.message.includes("ENOENT") && err.message.includes("app-update.yml")) {
        return { 
          status: "not-configured", 
          message: "This version doesn't support auto-updates. Please download the latest version from https://himoacs.github.io/postmaster/" 
        };
      }
      
      // Check for common configuration issues
      if (err.message.includes("404") || err.message.includes("No published versions")) {
        return { 
          status: "not-configured", 
          message: "Auto-updates are not configured. No release repository has been set up." 
        };
      }
      
      return { status: "error", message: err.message };
    }
  });

  // Download available update
  ipcMain.handle("download-update", async () => {
    updateLog("Download update triggered");
    try {
      await autoUpdater.downloadUpdate();
      return { status: "downloading" };
    } catch (error) {
      const err = error as Error;
      updateLog(`Download update failed: ${err.message}`);
      return { status: "error", message: err.message };
    }
  });

  // Install downloaded update (quit and install)
  ipcMain.handle("install-update", () => {
    updateLog("Install update triggered - quitting and installing");
    autoUpdater.quitAndInstall(false, true);
  });

  // Get update settings
  ipcMain.handle("get-update-settings", () => {
    return {
      autoCheck: autoUpdater.autoDownload === false, // We check but don't auto-download
      autoInstall: autoUpdater.autoInstallOnAppQuit,
    };
  });

  // Get app info for update UI
  ipcMain.handle("get-app-info", () => {
    return {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      isPackaged: app.isPackaged,
    };
  });

  updateLog("Update IPC handlers registered");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "PostMaster",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for better-sqlite3
    },
    backgroundColor: "#0a0a0a",
    show: false,
  });

  // Show window when ready to avoid visual flash
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Load the app
  const loadUrl = `http://localhost:${PORT}/dashboard`;
  
  const loadApp = () => {
    mainWindow?.loadURL(loadUrl).catch((err) => {
      console.error("Failed to load app:", err);
      // Retry after a delay
      setTimeout(loadApp, 1000);
    });
  };

  loadApp();

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function startNextServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isDev) {
      // In development, assume Next.js dev server is running externally
      console.log("Development mode: expecting external Next.js server");
      resolve();
      return;
    }

    // Kill any zombie process still holding the port from a previous session
    try {
      if (process.platform === "darwin" || process.platform === "linux") {
        execSync(`lsof -ti :${PORT} | xargs kill -9 2>/dev/null`, { stdio: "ignore" });
        console.log(`Cleaned up any existing process on port ${PORT}`);
      }
    } catch {
      // Ignore - no process on port (expected case)
    }

    // In production, start the Next.js standalone server
    const serverPath = join(process.resourcesPath, "server", "server.js");
    
    if (!existsSync(serverPath)) {
      console.error("Server not found at:", serverPath);
      reject(new Error("Server not found"));
      return;
    }

    console.log("Starting Next.js server from:", serverPath);

    // User data path for database and encryption key
    const userDataPath = app.getPath("userData");
    
    // Set environment variables
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "production" as const,
      // Set database path to user data directory
      DATABASE_URL: `file:${join(userDataPath, "postmaster.db")}`,
      // CRITICAL: Make Electron run as Node.js to avoid recursive spawning
      ELECTRON_RUN_AS_NODE: "1",
    };

    // Find a Node.js binary that won't show in the dock
    // On macOS, using process.execPath (Electron) with ELECTRON_RUN_AS_NODE still shows in dock
    // So we look for a standalone node binary first
    let nodeBinary = process.execPath; // fallback to Electron's node
    
    // Check for bundled node binary first, then system node
    const bundledNode = join(process.resourcesPath, "node");
    const systemNodes = ["/usr/local/bin/node", "/opt/homebrew/bin/node", "/usr/bin/node"];
    
    if (existsSync(bundledNode)) {
      nodeBinary = bundledNode;
      // Don't need ELECTRON_RUN_AS_NODE for a real node binary
      delete env.ELECTRON_RUN_AS_NODE;
    } else {
      for (const nodePath of systemNodes) {
        if (existsSync(nodePath)) {
          nodeBinary = nodePath;
          delete env.ELECTRON_RUN_AS_NODE;
          break;
        }
      }
    }
    
    console.log("Using Node binary:", nodeBinary);

    nextServer = spawn(nodeBinary, [serverPath], {
      env,
      cwd: join(process.resourcesPath, "server"),
      stdio: "pipe",
    });

    nextServer.stdout?.on("data", (data) => {
      console.log("[Next.js]", data.toString());
      // Resolve when server is ready
      if (data.toString().includes("Ready") || data.toString().includes("started")) {
        resolve();
      }
    });

    nextServer.stderr?.on("data", (data) => {
      console.error("[Next.js Error]", data.toString());
    });

    nextServer.on("error", (err) => {
      console.error("Failed to start Next.js server:", err);
      reject(err);
    });

    nextServer.on("close", (code) => {
      console.log("Next.js server exited with code:", code);
      nextServer = null;
    });

    // Give server time to start, then resolve anyway
    setTimeout(() => resolve(), 3000);
  });
}

function stopNextServer() {
  if (nextServer) {
    console.log("Stopping Next.js server...");
    nextServer.kill();
    nextServer = null;
  }
}

// Set app name and ID
app.name = "PostMaster";
app.setAppUserModelId("com.postmaster.app");

// Handle creating/removing shortcuts on Windows when installing/uninstalling via Squirrel
// This is only needed for Windows Squirrel installers (we use NSIS, so this is optional)
if (process.platform === "win32") {
  try {
    if (require("electron-squirrel-startup")) {
      app.quit();
    }
  } catch {
    // Module not available, skip
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  // Setup auto-updater (before window creation to catch early events)
  setupAutoUpdater();
  setupUpdateIPC();

  try {
    await startNextServer();
    createWindow();
    
    // Check for updates after window is created (non-blocking)
    if (!isDev) {
      setTimeout(() => {
        updateLog("Automatic update check on startup");
        autoUpdater.checkForUpdates().catch((err) => {
          updateLog(`Startup update check failed: ${err.message}`);
        });
      }, 3000); // Wait 3 seconds after app starts
    }
  } catch (err) {
    console.error("Failed to start app:", err);
    app.quit();
  }

  // On macOS, re-create window when dock icon is clicked
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on("window-all-closed", () => {
  // On macOS, apps typically stay active until explicit quit
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Clean up before quit
app.on("before-quit", () => {
  stopNextServer();
});

// IPC handlers for renderer communication
ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

ipcMain.handle("get-app-path", (_, name: string) => {
  return app.getPath(name as any);
});

ipcMain.handle("open-external", (_, url: string) => {
  return shell.openExternal(url);
});
