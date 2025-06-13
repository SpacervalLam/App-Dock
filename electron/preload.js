const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getBatteryLevel: () => ipcRenderer.invoke("get-battery-level"),
  enableInteraction: () => ipcRenderer.send("enable-interaction"),
  disableInteraction: () => ipcRenderer.send("disable-interaction"),
  minimize: () => ipcRenderer.send("window-minimize"),
  close: () => ipcRenderer.send("window-close"),
  getScreenSize: () => ipcRenderer.invoke("get-screen-size"),

  // 截图入口
  startScreenshot: () => ipcRenderer.invoke("start-screenshot"),
  send: (channel, data) => {
    if (channel === "hide-main-and-capture") {
      ipcRenderer.send(channel, data);
    }
  },

  // 保存图片到本地并复制到剪贴板
  saveImage: (dataURL, savePath) => ipcRenderer.invoke("save-image", dataURL, savePath),

  // 渲染进程监听主进程发来的“初始化图片”事件
  onInitImage: (callback) => {
    ipcRenderer.on("init-image", (event, payload) => {
      callback(payload);
    });
  },

  viewerReady: () => ipcRenderer.send("viewer-ready"),
  openDirectoryDialog: () => ipcRenderer.invoke("open-directory-dialog"),
  showOpenDialog: (options) => ipcRenderer.invoke("show-open-dialog", options),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  loadSettings: () => ipcRenderer.invoke("load-settings"),
  saveWallpaper: (fileBuffer) => ipcRenderer.invoke("save-wallpaper", fileBuffer),
  getFirstWallpaper: () => ipcRenderer.invoke("get-first-wallpaper"),
  launchApp: (path) => ipcRenderer.invoke("launch-app", path),
  
  handleContextMenu: (callback) => {
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      callback({ x: e.clientX, y: e.clientY });
    });
  },
  
  getAppIcon: (path) => ipcRenderer.invoke("get-app-icon", path),
  openTaskManager: () => ipcRenderer.invoke("open-task-manager")
});
