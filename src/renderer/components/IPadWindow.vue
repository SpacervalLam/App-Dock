<template>
  <div ref="ipadWindowRef" class="ipad-window" :style="{
    '--ipad-width': width + 'px',
    transition: 'left 0.3s ease-out'
  }" @mousedown.stop @click.stop>
    <!-- 顶部状态栏 -->
    <div class="ipad-header" :class="{ 'text-white': settings.isWhiteText }" @click="toggleTimeColor">
      <div class="ipad-status-time">
        <span class="time">{{ currentTime }}</span>
        <span class="date">{{ currentDate }}</span>
      </div>
      <div class="ipad-status-icons">
        <span v-if="settings.darkMode">🌙</span>
        <span>📶</span>
        <span>🔋 {{ batteryLevel }}%</span>
      </div>
    </div>

    <!-- 主体内容：根据 currentView 切换 Home 或 Settings -->
    <div class="ipad-content">
      <!-- Home Screen -->
      <div v-if="currentView === 'home'" class="ipad-grid" :class="settings.layoutMode">
        <div 
          class="ipad-app-icon" 
          v-for="(app, index) in settings.apps" 
          :key="index"
          :data-label="app.name"
          @click="launchApp(app)"
        >
          <img v-if="app.icon" :src="app.icon" class="app-icon" />
          <span v-else>📱</span>
        </div>
        
        <!-- 右键菜单 -->
        <div 
          v-if="contextMenu.visible" 
          class="context-menu" 
          :style="{
            left: contextMenu.x + 'px',
            top: contextMenu.y + 'px'
          }"
          @click.stop
        >
          <div v-if="contextMenu.appIndex === -1" class="menu-item" @click="addApp">添加APP</div>
          <div v-if="contextMenu.appIndex !== -1" class="menu-item" @click="removeApp(contextMenu.appIndex)">删除</div>
        </div>
        
        <!-- 添加APP模态框 -->
        <div v-if="showAddAppModal" class="modal-overlay" @click.self="showAddAppModal = false">
          <div class="modal-content">
            <h3>添加快捷方式</h3>
            
            <!-- 预览区域 -->
            <div class="preview-section">
              <div class="preview-icon">
                <img v-if="appIconPreview" :src="appIconPreview" class="app-icon-preview">
                <span v-else>📱</span>
              </div>
              <div class="preview-label">{{ newApp.name || '应用名称' }}</div>
            </div>

            <div class="form-group">
              <label>应用图标</label>
              <div class="icon-upload-group">
                <input 
                  id="iconUpload"
                  type="file" 
                  accept="image/*"
                  @change="handleIconUpload"
                  style="display: none"
                >
                <label for="iconUpload" class="upload-btn">选择图标</label>
                <button 
                  v-if="customIcon" 
                  class="clear-btn"
                  @click.stop="clearCustomIcon"
                >
                  清除
                </button>
              </div>
            </div>

            <div class="form-group">
              <label>应用路径 <span class="required">*</span></label>
              <div class="path-input-group">
                <input 
                  v-model="newApp.path" 
                  type="text" 
                  placeholder="点击浏览选择" 
                  required
                  readonly
                  @input="handlePathChange"
                  @keyup.enter="handlePathChange"
                >
                <button class="browse-btn" @click="selectAppPath">浏览</button>
              </div>
              <p class="form-hint">必填，有效的应用路径</p>
            </div>
            
            <div class="form-group">
              <label>应用名称 <span class="required">*</span></label>
              <input v-model="newApp.name" type="text" placeholder="可自动从路径提取" required>
            </div>

            <div class="form-actions">
              <button class="cancel-btn" @click="showAddAppModal = false">取消</button>
              <button 
                class="confirm-btn" 
                @click="confirmAddApp"
                :disabled="!newApp.name || !newApp.path"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Settings Screen -->
      <div v-else class="settings-container">
        <!-- 返回按钮 -->
        <div class="settings-header">
          <button class="back-btn" @click="goHome">◀ 返回</button>
          <h3>设置</h3>
        </div>

        <!-- 夜间模式 -->
        <div class="setting-item">
          <label>夜间模式</label>
          <div class="toggle-switch" @click="toggleDarkMode">
            <div class="slider" :class="{ active: settings.darkMode }"></div>
          </div>
        </div>

        <!-- 语言切换 -->
        <div class="setting-item">
          <label for="languageSelect">语言</label>
          <select id="languageSelect" v-model="settings.language">
            <option value="zh">中文</option>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
          </select>
        </div>

        <!-- 布局模式 -->
        <div class="setting-item">
          <label>图标布局：{{ settings.layoutMode === 'dense' ? '密集' : '稀疏' }}</label>
          <div class="toggle-switch" @click="toggleLayoutMode">
            <div class="slider" :class="{ active: settings.layoutMode === 'sparse' }"></div>
          </div>
        </div>

        <!-- 壁纸设置 -->
        <div class="setting-item wallpaper-section">
          <div class="wallpaper-header">
            <label>壁纸</label>
            <div class="upload-wallpaper">
              <input id="wallpaperUpload" type="file" accept="image/*" @change="uploadWallpaper" />
              <label for="wallpaperUpload" class="upload-btn">选择图片</label>
            </div>
          </div>
        </div>

        <!-- 截屏保存目录 -->
        <div class="setting-item">
          <label>截屏保存目录</label>
          <div class="screenshot-path">
            <span class="path-text">{{ settings.screenshotPath || '未设置' }}</span>
            <button class="path-btn" @click="selectScreenshotPath">选择目录</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部 Dock -->
    <div class="ipad-footer" :class="{ dark: settings.darkMode }">
      <div class="ipad-app-icon" data-label="设置" @click="openSettings">⚙️</div>
      <div class="ipad-app-icon" data-label="文件">📁</div>
      <div class="ipad-app-icon" data-label="浏览器">🌐</div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted, watch } from "vue";

export default {
  name: "IPadWindow",
  props: { width: { type: Number, required: true, default: 0 } },
  setup() {
    const currentTime = ref("");
    const currentDate = ref("");
    const batteryLevel = ref(0);
    const currentView = ref("home");

    const settings = reactive({
      darkMode: false,
      language: "zh",
      wallpaper: "",
      layoutMode: "dense",
      screenshotPath: "",
      isWhiteText: false,
      apps: []
    });

    const contextMenu = reactive({
      visible: false,
      x: 0,
      y: 0,
      appIndex: -1
    });

    // 确保右键菜单点击外部时关闭
    const closeContextMenu = (e) => {
      if (!contextMenu.visible) return;
      
      const menu = document.querySelector('.context-menu');
      const clickedInsideMenu = menu && menu.contains(e.target);
      
      console.log('Close check - clicked inside menu:', clickedInsideMenu);
      
      if (!clickedInsideMenu) {
        console.log('Closing context menu');
        contextMenu.visible = false;
        e.stopPropagation();
        e.preventDefault();
      }
    };

    onMounted(() => {
      ipadWindowRef.value = document.querySelector('.ipad-window');
      
      // 使用passive事件监听器提高性能
      const options = { capture: true, passive: false };
      document.addEventListener('click', closeContextMenu, options);
      document.addEventListener('contextmenu', closeContextMenu, options);
      
      console.log('Context menu handlers registered with options:', options);
    });
    
    onUnmounted(() => {
      document.removeEventListener('click', closeContextMenu, true);
      document.removeEventListener('contextmenu', closeContextMenu, true);
    });

    const showAddAppModal = ref(false);
    const newApp = reactive({
      name: '',
      path: '',
      icon: '',
      workingDir: ''
    });

    const appIconPreview = ref('');
    const customIcon = ref(false);
    
    const selectAppPath = async () => {
      console.log('点击浏览按钮');
      try {
        const result = await window.electronAPI.showOpenDialog({
          properties: ['openFile'],
          filters: [
            { name: 'Applications', extensions: ['exe', 'app', 'lnk'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });
        console.log('对话框返回结果:', result);
        if (!result.canceled && result.filePaths?.length) {
          newApp.path = result.filePaths[0];
          handlePathChange(newApp.path);
        }
      } catch (err) {
        console.error('打开文件对话框失败:', err);
      }
    };

    const handlePathChange = (path) => {
      path = path || newApp.path;
      try {
        if (path) {
          // 提取应用名称 (不含扩展名)
          const fileName = path.split('\\').pop().split('/').pop();
          const appName = fileName.replace(/\.[^/.]+$/, '');
          newApp.name = appName;
          
          // 如果用户没有上传自定义图标，才获取默认图标
          if (!customIcon.value) {
            window.electronAPI.getAppIcon(path).then(icon => {
              appIconPreview.value = icon;
              newApp.icon = icon;
            }).catch(() => {
              appIconPreview.value = '';
              newApp.icon = '';
            });
          }
        }
      } catch (err) {
        console.error('解析路径失败:', err);
      }
    };

    const handleIconUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        appIconPreview.value = event.target.result;
        newApp.icon = event.target.result;
        customIcon.value = true;
      };
      reader.readAsDataURL(file);
    };

    const clearCustomIcon = () => {
      customIcon.value = false;
      appIconPreview.value = '';
      newApp.icon = '';
      if (newApp.path) {
        handlePathChange(newApp.path); // 重新获取默认图标
      }
    };

    watch(() => settings.darkMode, async (val) => {
      document.documentElement.classList.toggle('ipad-dark', val);
      await window.electronAPI.saveSettings({ darkMode: val });
    });
    watch(() => settings.language, async (val) => {
      await window.electronAPI.saveSettings({ language: val });
    });
    watch(() => settings.layoutMode, async (val) => {
      await window.electronAPI.saveSettings({ layoutMode: val });
    });
    watch(() => settings.screenshotPath, async (val) => {
      await window.electronAPI.saveSettings({ screenshotPath: val });
    });
    watch(() => settings.isWhiteText, async (val) => {
      document.querySelector('.ipad-header').classList.toggle('text-white', val);
      await window.electronAPI.saveSettings({ isWhiteText: val });
    });


    const setBackground = (file) => {

      if (!file) {
        document.documentElement.style.setProperty('--ipad-bg', '#f0f0f5');
        return;
      } else {
        const url = URL.createObjectURL(file);
        document.documentElement.style.setProperty(
          "--ipad-bg",
          `url(${url}) center/cover no-repeat`
        );
      }
    };

    const uploadWallpaper = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        setBackground(file);
        
        // 保存壁纸到userdata/wallpapers目录
        const arrayBuffer = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsArrayBuffer(file);
        });
        await window.electronAPI.saveWallpaper(new Uint8Array(arrayBuffer));
      } catch (err) {
        console.error('上传壁纸失败:', err);
      }
    };

    const toggleDarkMode = () => { settings.darkMode = !settings.darkMode; };
    const toggleLayoutMode = () => { settings.layoutMode = settings.layoutMode === 'dense' ? 'sparse' : 'dense'; };
    const toggleTimeColor = () => { settings.isWhiteText = !settings.isWhiteText; };

    const updateTime = () => {
      const d = new Date();
      currentTime.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      currentDate.value = `${d.getMonth() + 1}月${d.getDate()}日 周${['日', '一', '二', '三', '四', '五', '六'][d.getDay()]}`;
    };

    let timeTimer, batteryTimer;
    const updateBatteryStatus = async () => {
      try { batteryLevel.value = await window.electronAPI.getBatteryLevel(); }
      catch { batteryLevel.value = 100; }
    };
    const loadSettings = async () => {
      const saved = await window.electronAPI.loadSettings();
      Object.assign(settings, saved);
      document.documentElement.classList.toggle('ipad-dark', saved.darkMode);
      
      // 从userdata/wallpapers目录加载第一张壁纸
      try {
        const wallpaperBuffer = await window.electronAPI.getFirstWallpaper();
        if (wallpaperBuffer) {
          const blob = new Blob([wallpaperBuffer], { type: 'image/jpeg' });
          const wallpaperFile = new File([blob], 'wallpaper.jpg', { type: 'image/jpeg' });
          setBackground(wallpaperFile);
        }
      } catch (err) {
        console.error('加载壁纸失败:', err);
      }
      
      if (saved.isWhiteText) {
        document.querySelector('.ipad-header').classList.add('text-white');
      }
    };

    const selectScreenshotPath = async () => {
      const result = await window.electronAPI.openDirectoryDialog();
      if (!result.canceled && result.filePaths.length) {
        settings.screenshotPath = result.filePaths[0];
      }
    };

    const launchApp = async (app) => {
      if (app.path) {
        try {
          await window.electronAPI.launchApp(app.path);
          // 通知Dock执行完整关闭流程
          window.dispatchEvent(new CustomEvent("ipad-window-close", {
            detail: { shouldClose: true }
          }));
        } catch (err) {
          console.error('启动应用失败:', err);
        }
      }
    };

    const ipadWindowRef = ref(null);
    

    const showContextMenu = (e, index) => {
      console.log('显示上下文菜单', e, index);
      e.preventDefault();
      e.stopPropagation();
      contextMenu.visible = true;
      contextMenu.x = e.clientX;
      contextMenu.y = e.clientY;
      contextMenu.appIndex = index;
      console.log('上下文菜单状态:', contextMenu);
    };

    const addApp = () => {
      contextMenu.visible = false;
      showAddAppModal.value = true;
    };

    const removeApp = (index) => {
      try {
        contextMenu.visible = false;
        const newApps = [...settings.apps];
        newApps.splice(index, 1);
        window.electronAPI.saveSettings({ 
          apps: newApps.map(app => ({
            name: app.name,
            path: app.path,
            icon: app.icon
          }))
        });
        settings.apps = newApps;
      } catch (err) {
        console.error('删除应用失败:', err);
      }
    };

    const confirmAddApp = () => {
      if (newApp.name && newApp.path) {
        try {
          const appToAdd = {
            name: newApp.name,
            path: newApp.path,
            icon: appIconPreview.value || '' // 确保使用当前预览的图标
          };
          
          const updatedApps = [...settings.apps, appToAdd];
          window.electronAPI.saveSettings({ 
            apps: updatedApps.map(app => ({
              name: app.name,
              path: app.path,
              icon: app.icon
            }))
          });
          
          settings.apps = updatedApps;
          showAddAppModal.value = false;
          // 重置表单
          newApp.name = '';
          newApp.path = '';
          newApp.icon = '';
          appIconPreview.value = '';
          customIcon.value = false;
        } catch (err) {
          console.error('添加应用失败:', err);
        }
      }
    };

    onMounted(() => {
      updateTime();
      updateBatteryStatus();
      timeTimer = setInterval(updateTime, 60000);
      batteryTimer = setInterval(updateBatteryStatus, 300000);
      loadSettings();

      window.addEventListener('ipad-contextmenu', (e) => {
        contextMenu.visible = true;
        contextMenu.x = e.detail.x;
        contextMenu.y = e.detail.y;
        contextMenu.appIndex = e.detail.target;
      });
    });
    onUnmounted(() => {
      clearInterval(timeTimer);
      clearInterval(batteryTimer);
    });

    const openSettings = () => {
      currentView.value = currentView.value === 'home' ? 'settings' : 'home';
    };
    const goHome = () => { currentView.value = 'home'; };

    return {
      currentTime, currentDate, batteryLevel, currentView,
      settings, openSettings, goHome,
      toggleTimeColor, toggleDarkMode, toggleLayoutMode,
      uploadWallpaper, selectScreenshotPath, selectAppPath,
      launchApp, showContextMenu, addApp, removeApp, confirmAddApp,
      showAddAppModal, newApp, contextMenu, handleIconUpload, clearCustomIcon,
    };
  },
};
</script>

<style src="../styles/ipad.css"></style>
