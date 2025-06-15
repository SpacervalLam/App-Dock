const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  desktopCapturer,
  nativeImage,
  dialog,
  clipboard,
  powerMonitor,
  shell,
} = require("electron");
const { exec, spawn } = require('child_process');
const path = require("path");
const fs = require("fs");
 
let mainWindow = null;
 
// 启用与窗口的交互
ipcMain.on("enable-interaction", () => {
  if (mainWindow) mainWindow.setIgnoreMouseEvents(false);
});
// 禁用与窗口的交互，并将事件转发给其他窗口
ipcMain.on("disable-interaction", () => {
  if (mainWindow) mainWindow.setIgnoreMouseEvents(true, { forward: true });
});
 
// 隐藏主窗口并进行屏幕捕获
ipcMain.on("hide-main-and-capture", async (event, data) => {
  const { x, y, width, height } = data;
  if (mainWindow) mainWindow.hide();
 
  setTimeout(async () => {
    const display = screen.getPrimaryDisplay();
    const displayWidth = display.size ? display.size.width : display.workAreaSize.width;
    const displayHeight = display.size ? display.size.height : display.workAreaSize.height;
    const scaleFactor = display.scaleFactor;
 
    const thumbSize = {
      width: Math.round(displayWidth * scaleFactor),
      height: Math.round(displayHeight * scaleFactor),
    };
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: thumbSize,
    });
 
    let screenSource = sources.find((src) => {
      const name = src.name.toLowerCase();
      return (
        name.includes("entire") ||
        name.includes("screen") ||
        name.includes("显示器") ||
        name.includes("desktop")
      );
    });
    if (!screenSource) screenSource = sources[0];
    const entireThumb = screenSource.thumbnail;
 
    const adjustedX = Math.round(x * scaleFactor);
    const adjustedY = Math.round(y * scaleFactor);
    const adjustedWidth = Math.round(width * scaleFactor);
    const adjustedHeight = Math.round(height * scaleFactor);
 
    const cropped = entireThumb.crop({
      x: adjustedX,
      y: adjustedY,
      width: adjustedWidth,
      height: adjustedHeight,
    });
 
    const dataURL = cropped.toDataURL();
    createViewerWindow(dataURL, width, height);
  }, 300);
});
 
// 保存图片到指定路径或通过对话框选择路径
ipcMain.handle("save-image", async (event, dataURL, savePath) => {
  const base64Data = dataURL.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
 
  if (savePath) {
    try {
      // 确保目录存在
      const dir = path.dirname(savePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
       
      const filename = `screenshot_${Date.now()}.png`;
      const fullPath = path.join(savePath, filename);
       
      fs.writeFileSync(fullPath, buffer);
      clipboard.writeImage(nativeImage.createFromBuffer(buffer));
      return fullPath;
    } catch (err) {
      console.error("保存文件失败：", err);
      return false;
    }
  }
 
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "保存截图",
    defaultPath: `screenshot-${Date.now()}.png`,
    filters: [{ name: "PNG 图像", extensions: ["png"] }],
  });
  if (canceled || !filePath) return false;
 
  try {
    fs.writeFileSync(filePath, buffer);
    clipboard.writeImage(nativeImage.createFromBuffer(buffer));
    return filePath;
  } catch (err) {
    console.error("保存文件失败：", err);
    return false;
  }
});
 
// 通过对话框保存图片
ipcMain.handle("saveImageWithDialog", async (event, dataURL) => {
  return await ipcMain.handle("save-image", event, dataURL);
});
 
// 创建图片查看器窗口
function createViewerWindow(dataURL, displayWidth, displayHeight) {
  if (mainWindow) mainWindow.setIgnoreMouseEvents(true, { forward: true });
 
  const viewer = new BrowserWindow({
    width: displayWidth > 800 ? displayWidth + 20 : 800,
    height: displayHeight > 600 ? displayHeight + 80 : 600,
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    frame: false,
    backgroundColor: "#333333",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
 
  const baseURL = app.isPackaged
    ? `file://${path.join(__dirname, "../dist/index.html")}`
    : `http://localhost:3506`;
  const url = `${baseURL}?viewer=true`;
  viewer.loadURL(url);
 
  // 等待渲染层"展示组件"就绪后，再发送图片
  ipcMain.once("viewer-ready", () => {
    viewer.webContents.send("init-image", { dataURL });
  });
 
  viewer.once("ready-to-show", () => {
    viewer.show();
    viewer.setAlwaysOnTop(true, "screen-saver");
  });
 
  // 关闭 viewer 时，恢复主窗口并立刻收回 Dock
  viewer.on("closed", () => {
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
        mainWindow.setAlwaysOnTop(true, "screen-saver");
        // 触发 Dock 收回
        mainWindow.webContents.executeJavaScript(
          `window.dispatchEvent(new Event('retract-dock'));`
        );
      }
    }, 50);
  });
}

function getWindowsDefaultBrowserPath() {
  return new Promise((resolve, reject) => {
    exec(
      'reg query "HKEY_CLASSES_ROOT\\http\\shell\\open\\command" /ve',
      (err, stdout, stderr) => {
        if (err) return reject(err);
        const m = stdout.match(/REG_[^ ]+\s+"?([^"]+\.exe)"/i);
        if (m && m[1]) resolve(m[1]);
        else reject(new Error('Failed to parse browser path from registry'));
      }
    );
  });
}

ipcMain.handle('open-default-browser', async (event, url) => {
  if (url) {
    await shell.openExternal(url);
  } else {
    if (process.platform === 'win32') {
      try {
        const exePath = await getWindowsDefaultBrowserPath();
        exec(`start "" "${exePath}"`);
      } catch (e) {
        console.error('Failed to launch default browser, fallback to about:blank:', e);
        await shell.openExternal('about:blank');
      }
    } else {
      await shell.openExternal('about:blank');
    }
  }
});
 
// 电池状态处理
let currentBatteryLevel = 100;
 
// 获取当前电池电量
function updateBatteryLevel() {
  if (!powerMonitor.isOnBatteryPower()) {
    currentBatteryLevel = 100;
    return;
  }
 
  const batteryLevel = powerMonitor.getSystemPowerState().batteryLevel;
  if (batteryLevel !== undefined) {
    currentBatteryLevel = Math.round(batteryLevel * 100);
  }
}
 
// 监听电池状态变化
powerMonitor.on('on-battery', () => updateBatteryLevel());
powerMonitor.on('on-ac', () => updateBatteryLevel());
powerMonitor.on('battery-status', () => updateBatteryLevel());
 
// 处理渲染进程的电池电量请求
ipcMain.handle('get-battery-level', () => {
  updateBatteryLevel();
  return currentBatteryLevel;
});
 
// 获取配置文件路径
// 壁纸存储目录
function getWallpaperDir() {
  const dir = path.join(app.getPath('userData'), 'wallpapers');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
 
function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}
 
// 初始化配置文件
function initConfig() {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
 
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
 
  let needInit = false;
  if (!fs.existsSync(configPath)) {
    needInit = true;
  } else {
    const raw = fs.readFileSync(configPath, 'utf-8');
    if (!raw.trim()) {
      // 文件存在但为空
      needInit = true;
    }
  }
 
  if (needInit) {
    const defaults = {
      screenshotPath: '',
      darkMode: false,
      language: 'zh',
      layoutMode: 'dense',
      isWhiteText: false,
      apps: [],
      bookmarks: []
    };
    fs.writeFileSync(configPath, JSON.stringify(defaults, null, 2), 'utf-8');
    console.log('⚙️ 已初始化默认配置:', configPath);
  } else {
    console.log('⚙️ 配置文件已存在，跳过初始化:', configPath);
  }
}
 
// 显示文件打开对话框
ipcMain.handle('show-open-dialog', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    ...options,
    modal: true
  });
  return result;
});
 
// 显示目录选择对话框
ipcMain.handle('open-directory-dialog', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: '选择截屏保存目录',
    modal: true
  });
  return { canceled, filePaths };
});
 
// 保存设置
ipcMain.handle('save-settings', async (_, settings) => {
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);
 
  try {
    // 确保目录存在
    fs.mkdirSync(configDir, { recursive: true });
 
    // 读取旧配置
    let finalConfig = {};
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      try {
        finalConfig = raw.trim() ? JSON.parse(raw) : {};
      } catch {
        finalConfig = {};
      }
    }
 
    // 合并并写回
    finalConfig = { ...finalConfig, ...settings };
    fs.writeFileSync(configPath, JSON.stringify(finalConfig, null, 2), 'utf-8');
 
    console.log('✅ 成功保存配置:', finalConfig);
    return { success: true };
  } catch (err) {
    console.error('❌ 保存配置失败:', err);
    return { success: false, error: err.message };
  }
});
 
// 同步加载设置
function loadSettingsSync() {
  const configPath = getConfigPath();
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    if (!raw.trim()) throw new Error('空文件');
    const loaded = JSON.parse(raw);
    return {
      darkMode: false,
      language: 'zh',
      layoutMode: 'dense',
      screenshotPath: '',
      isWhiteText: false,
      apps: [],
      ...loaded
    };
  } catch (err) {
    console.warn('❗ 加载配置失败或格式错误，重建默认配置:', err.message);
    const defaults = {
      darkMode: false,
      language: 'zh',
      layoutMode: 'dense',
      screenshotPath: '',
      isWhiteText: false,
      bookmarks: []
    };
    // 覆写文件
    fs.writeFileSync(configPath, JSON.stringify(defaults, null, 2), 'utf-8');
    return defaults;
  }
}
 
// 处理加载设置的请求
ipcMain.handle('load-settings', () => {
  return loadSettingsSync();
});
 
// 保存壁纸到本地
ipcMain.handle('save-wallpaper', async (_, fileBuffer) => {
  const wallpaperDir = getWallpaperDir();
  const wallpaperPath = path.join(wallpaperDir, `wallpaper_${Date.now()}.jpg`);
   
  try {
    await fs.promises.writeFile(wallpaperPath, fileBuffer);
    return wallpaperPath;
  } catch (err) {
    console.error('Failed to save wallpaper:', err);
    throw err;
  }
});
 
// 启动应用程序
ipcMain.handle('launch-app', async (_, appPath) => {
  try {
    const child = spawn(appPath, {
      detached: true,     // 与父进程分离
      stdio: 'ignore'     // 不关心它的输入输出
    });
    child.unref();        // 让子进程在父进程退出后也能继续运行

    // 立即 resolve，不等 child 退出
    return true;
  } catch (err) {
    console.error('启动应用失败:', err);
    throw new Error(`启动应用失败: ${err.message}`);
  }
});
 
// 获取应用程序图标
ipcMain.handle('get-app-icon', async (_, targetPath) => {
  try {
    const normalized = path.normalize(targetPath);
    if (!fs.existsSync(normalized)) {
      console.error('路径不存在:', normalized);
      return '';
    }
 
    const ext = path.extname(normalized).toLowerCase();
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
 
    let img;
 
    if (imageExts.includes(ext)) {
      img = nativeImage.createFromPath(normalized);
    } else {
      img = await app.getFileIcon(normalized, { size: 'large' });
    }
 
    if (img.isEmpty()) {
      const defaultIcon = path.join(__dirname, 'assets', 'default-app-icon.png');
      if (fs.existsSync(defaultIcon)) {
        img = nativeImage.createFromPath(defaultIcon);
      }
    }
 
    return img.isEmpty() ? '' : img.toDataURL();
  }
  catch (err) {
    console.error('获取图标失败:', err);
    return '';
  }
});
 
// 打开任务管理器
ipcMain.handle('open-task-manager', async () => {
  return new Promise((resolve, reject) => {
    exec('start "" /max taskmgr', (error, stdout, stderr) => {
      if (error) {
        console.error(`打开任务管理器失败: ${error}`);
        reject(`无法打开任务管理器: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
      console.log(`stdout: ${stdout}`);
      resolve(true);
    });
  });
});
 
// 获取第一个壁纸文件
ipcMain.handle('get-first-wallpaper', async () => {
  const wallpaperDir = getWallpaperDir();
  try {
    const files = await fs.promises.readdir(wallpaperDir);
    const imageFiles = files.filter(file => 
      ['.jpg', '.jpeg', '.png'].includes(path.extname(file).toLowerCase())
    ).sort();
     
    if (imageFiles.length > 0) {
      const firstImagePath = path.join(wallpaperDir, imageFiles[0]);
      return await fs.promises.readFile(firstImagePath);
    }
    return null;
  } catch (err) {
    console.error('Failed to read wallpaper:', err);
    throw err;
  }
});
 
// 创建主窗口
async function createWindow(settings) {
  const { width: screenWidth, height: screenHeight } =
    screen.getPrimaryDisplay().workAreaSize;
 
  const screenshotPath = settings?.screenshotPath || '';
 
  mainWindow = new BrowserWindow({
    x: 0,
    y: 0,
    width: screenWidth,
    height: screenHeight,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    minimizable: false,
    closable: false,
    webSecurity: false,
    contextIsolation: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      additionalArguments: [
        `--screenshotPath=${screenshotPath}`
      ],
    },
  });
 
  // 启动时允许鼠标交互
  mainWindow.setIgnoreMouseEvents(false);
  mainWindow.setAlwaysOnTop(true, "screen-saver");
 
  if (!app.isPackaged) {
    await mainWindow.loadURL("http://localhost:3506/");
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
 
  mainWindow.setMenuBarVisibility(false);
 
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
 
  mainWindow.webContents.on("render-process-gone", (_, details) => {
    console.error("Renderer 进程崩溃：", details);
    mainWindow.reload();
  });
}
 
// 应用程序准备好后执行的初始化操作
app.whenReady().then(() => {
  initConfig();
  const settings = loadSettingsSync();
  createWindow(settings);
 
  // 注册全局快捷键 Ctrl+Shift+L 打开开发者工具
  const { globalShortcut } = require('electron');
  globalShortcut.register('CommandOrControl+Shift+L', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  });
 
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const settings = loadSettingsSync();
      createWindow(settings);
    }
  });
});
 
// 退出时注销所有快捷键
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
 
// 所有窗口关闭后执行的操作
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
