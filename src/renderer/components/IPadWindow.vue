<template>
  <div class="ipad-window" :style="{
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
        <div class="ipad-app-icon" v-for="n in 20" :key="n" :data-label="`App ${n}`" @click="onAppClick(n)">
          <!-- 占位图标 -->
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
      isWhiteText: false
    });

    // 单字段 watch，保存并立即更新 CSS
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

    const onAppClick = (n) => console.log("点击应用", n);

    onMounted(() => {
      updateTime();
      updateBatteryStatus();
      timeTimer = setInterval(updateTime, 60000);
      batteryTimer = setInterval(updateBatteryStatus, 300000);
      loadSettings();
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
      uploadWallpaper, selectScreenshotPath, onAppClick
    };
  },
};
</script>

<style src="../styles/ipad.css"></style>
<style scoped>
:root {
  --ipad-bg: #f0f0f5;
}

.ipad-window {
  background: var(--ipad-bg);
}

/* 暗黑模式 */
.ipad-dark .ipad-window {
  background: #1c1c1e;
}

.ipad-dark .ipad-header,
.ipad-dark .ipad-footer {
  background: rgba(30, 30, 30, 0.8);
}

.ipad-dark .ipad-footer .ipad-app-icon::after {
  color: #fff;
}

.text-white,
.text-white .ipad-status-time,
.text-white .ipad-status-icons,
.text-white .ipad-status-icons span {
  color: white !important;
}

/* iPad 内容面板 */
.ipad-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* 设置页面样式 - iPad Air5 风格 */
.settings-container {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  color: #333;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Segoe UI", sans-serif;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(30px) saturate(180%);
  border-radius: 16px;
  margin: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.ipad-dark .settings-container {
  color: #f5f5f7;
  background: rgba(28, 28, 30, 0.85);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(40px) saturate(160%);
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 28px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.ipad-dark .settings-header {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

.back-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: inherit;
  transition: opacity 0.2s ease;
}

.back-btn:hover {
  opacity: 0.7;
}

.settings-header h3 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.setting-item {
  margin-bottom: 24px;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 12px;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.ipad-dark .setting-item {
  background: rgba(44, 44, 46, 0.7);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
}

.setting-item:hover {
  background: rgba(255, 255, 255, 0.8);
}

.ipad-dark .setting-item:hover {
  background: rgba(80, 80, 80, 0.8);
}

.setting-item label {
  font-size: 17px;
  font-weight: 500;
}

.toggle-switch {
  width: 50px;
  height: 30px;
  background: #e0e0e0;
  border-radius: 15px;
  position: relative;
  cursor: pointer;
  transition: background 0.3s ease;
}

.toggle-switch.active {
  background: #007aff;
}

.toggle-switch .slider {
  width: 26px;
  height: 26px;
  background: white;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-switch .slider.active {
  left: 22px;
}

.ipad-dark .toggle-switch {
  background: #444;
}

.ipad-dark .toggle-switch.active {
  background: #0062cc;
}

.ipad-dark .toggle-switch .slider {
  background: white;
}

.setting-item select {
  padding: 8px 12px;
  font-size: 16px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.8);
}

.ipad-dark .setting-item select {
  background: rgba(60, 60, 60, 0.8);
  border-color: rgba(255, 255, 255, 0.1);
  color: #eee;
}

.wallpaper-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-bottom: 12px;
}

.upload-wallpaper {
  position: relative;
}

.upload-wallpaper input[type="file"] {
  position: absolute;
  width: 0.1px;
  height: 0.1px;
  opacity: 0;
  overflow: hidden;
  z-index: -1;
}

.upload-btn {
  display: inline-block;
  padding: 8px 16px;
  background: #007aff;
  color: white;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.upload-btn:hover {
  background: #0062cc;
  transform: translateY(-1px);
}

.ipad-dark .upload-btn {
  background: #0062cc;
}

.ipad-dark .upload-btn:hover {
  background: #0052a3;
}

.settings-container {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

.settings-container::-webkit-scrollbar {
  width: 6px;
}

.settings-container::-webkit-scrollbar-track {
  background: transparent;
}

.settings-container::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}
</style>
