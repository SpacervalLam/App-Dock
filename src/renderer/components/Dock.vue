<template>
  <div class="dock-wrapper">
    <!-- 收起状态下仅显示 6px 呼吸灯 -->
    <div v-if="!isActive && !screenshotActive" class="breathing-light" @mouseenter="openDock"></div>

    <!-- Dock 容器 -->
    <div ref="container" :class="['dock-container', { active: isActive && !screenshotActive }]"
      @mousedown.prevent="onDockMouseDown" @mouseleave="onDockMouseLeave">
      <div class="dock">
        <div class="dock-icons">
          <!-- Dock 图标区域 -->
          <div class="dock-icon" title="屏幕截图" @click.stop="onScreenshotClick">📷</div>
          <div class="dock-icon" title="浏览器" 
               @click.stop="onBrowserClick" 
               @contextmenu.prevent="onBrowserRightClick">🌐</div>
          <div class="dock-icon" title="菜单">☰</div>
          <div class="dock-icon" title="设置">⚙️</div>
          <div class="dock-icon" title="邮件">✉️</div>
          <div class="dock-icon" title="音乐">🎵</div>
          <div class="dock-icon" title="照片">🖼️</div>
          <div class="dock-icon" title="任务管理器" @click.stop="onTaskManagerClick">📊</div>
        </div>
      </div>
    </div>

    <!-- 书签菜单弹窗 -->
    <teleport to="body">
      <BookmarkMenu
        v-if="showBookmarkMenu"
        :bookmarks="bookmarks"
        :pos="bookmarkMenuPos"
        @hide="hideBookmarkMenu"
        @delete="deleteBookmark"
        @add="showAddBookmarkDialog"
        @open="openBookmark"
      />
    </teleport>

    <!-- 添加书签对话框 -->
    <teleport to="body">
      <AddBookmarkDialog
        v-if="showAddDialog"
        :model-value="newBookmark"
        @cancel="hideAddDialog"
        @add="addBookmark"
      />
    </teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useBookmarks } from '../composables/useBookmarks.js';
import BookmarkMenu from './BookmarkMenu.vue';
import AddBookmarkDialog from './AddBookmarkDialog.vue';
import { startScreenshot } from "../../utils/screenshot.js";

const emit = defineEmits(['open-ipad']);

const isActive = ref(false);
const currentIPadWidth = ref(0);
const screenshotActive = ref(false);
const bookmarkMenuPos = ref({ x: 0, y: 0 });
const showBookmarkMenu = ref(false);
const showAddDialog = ref(false);
const newBookmark = ref({ title: '', url: '' });

let isDragging = false;
let dragStartX = 0;
let initialWidth = 0;
let justReleased = false;

// 书签逻辑
const {
  bookmarks,
  loadBookmarks,
  addBookmark: addBookmarkRaw,
  deleteBookmark: deleteBookmarkRaw
} = useBookmarks();

function onBrowserRightClick(e) {
  e.preventDefault();
  e.stopPropagation();
  const rect = e.target.getBoundingClientRect();
  bookmarkMenuPos.value = {
    x: window.innerWidth - rect.left + 10,
    y: rect.top
  };
  isActive.value = true;
  window.electronAPI.enableInteraction();
  showBookmarkMenu.value = true;
  loadBookmarks();
  setTimeout(() => {
    if (showBookmarkMenu.value) {
      document.addEventListener('click', onDocumentClick, true);
    }
  }, 10);
}
function hideBookmarkMenu() {
  setTimeout(() => {
    showBookmarkMenu.value = false;
    document.removeEventListener('click', onDocumentClick, true);
    // 只有所有弹窗都关闭时，才允许 dock 收起和主窗口穿透
    if (!showAddDialog.value && currentIPadWidth.value === 0 && !screenshotActive.value) {
      isActive.value = false;
      window.electronAPI.disableInteraction();
    }
  }, 100);
}
function onDocumentClick(e) {
  if (showAddDialog.value) return;
  if (e.target.closest('.bookmark-menu')) return;
  if (e.target.closest('.dock-icon[title="浏览器"]')) return;
  if (e.target.closest('.add-bookmark')) return;
  hideBookmarkMenuImmediately();
}
function hideBookmarkMenuImmediately() {
  showBookmarkMenu.value = false;
  document.removeEventListener('click', onDocumentClick, true);
  if (currentIPadWidth.value === 0 && !screenshotActive.value && !showAddDialog.value) {
    isActive.value = false;
    window.electronAPI.disableInteraction();
  }
}
function openBookmark(bookmark) {
  window.electronAPI.openDefaultBrowser(bookmark.url);
  hideBookmarkMenuImmediately();
}
function showAddBookmarkDialog() {
  // 先立即隐藏书签菜单，避免 setTimeout 影响
  showBookmarkMenu.value = false;
  document.removeEventListener('click', onDocumentClick, true);
  // 延迟设置 showAddDialog，确保不会被 hideBookmarkMenu 的 setTimeout 100ms 关闭
  setTimeout(() => {
    showAddDialog.value = true;
    newBookmark.value = { title: '', url: '' };
    isActive.value = true;
    window.electronAPI.enableInteraction();
    nextTick(() => {
      const input = document.querySelector('.add-bookmark-dialog input');
      if (input) input.focus();
    });
  }, 120);
}
function hideAddDialog() {
  showAddDialog.value = false;
  newBookmark.value = { title: '', url: '' };
  // 只有所有弹窗都关闭时，才允许 dock 收起和主窗口穿透
  if (!showBookmarkMenu.value && currentIPadWidth.value === 0 && !screenshotActive.value) {
    isActive.value = false;
    window.electronAPI.disableInteraction();
  }
}
function addBookmark(bookmark) {
  let url = bookmark.url.trim();
  // 简单校验网址格式
  const urlPattern = /^(https?:\/\/)[\w\-]+(\.[\w\-]+)+/i;
  if (!urlPattern.test(url)) {
    alert('请输入有效的网址（以 http:// 或 https:// 开头）');
    return;
  }
  addBookmarkRaw({ title: bookmark.title.trim(), url });
  hideAddDialog();
}
function deleteBookmark(index) {
  deleteBookmarkRaw(index);
}

// Dock 相关逻辑（保持原有）
function onDockMouseDown(e) {
  if (screenshotActive.value) return;
  if (e.target.closest(".dock-icon")) return;
  e.preventDefault();
  isDragging = true;
  dragStartX = e.clientX;
  initialWidth = currentIPadWidth.value;
  document.addEventListener("mousemove", onMouseMoveDrag);
  document.addEventListener("mouseup", onMouseUpDrag);
}
function onMouseMoveDrag(e) {
  if (!isDragging) return;
  const delta = dragStartX - e.clientX;
  let newWidth = initialWidth + delta;
  newWidth = Math.max(0, Math.min(newWidth, window.innerWidth * 0.8));
  currentIPadWidth.value = newWidth;
  emitOpen(newWidth);
}
function onMouseUpDrag() {
  if (!isDragging) return;
  isDragging = false;
  document.removeEventListener("mousemove", onMouseMoveDrag);
  document.removeEventListener("mouseup", onMouseUpDrag);
  justReleased = true;
  if (currentIPadWidth.value < 450) {
    resetIPadState();
    setTimeout(() => { justReleased = false; }, 50);
    return;
  }
  isActive.value = false;
  window.electronAPI.enableInteraction();
  setTimeout(() => { justReleased = false; }, 50);
}
function onDetectEdge(e) {
  if (isDragging || screenshotActive.value) return;
  if (currentIPadWidth.value > 0) return;
  if (!isActive.value) {
    const x = e.clientX;
    const w = window.innerWidth;
    if (x >= w - 6) openDock();
  }
}
function openDock() {
  isActive.value = true;
  window.electronAPI.enableInteraction();
}
function onDockMouseLeave() {
  if (showBookmarkMenu.value || showAddDialog.value || isDragging) return;
  setTimeout(() => {
    if (isActive.value && !screenshotActive.value && !showBookmarkMenu.value && !showAddDialog.value) {
      isActive.value = false;
      window.electronAPI.disableInteraction();
    }
  }, 200);
}
function resetIPadState() {
  currentIPadWidth.value = 0;
  emitOpen(0);
  isActive.value = false;
  window.electronAPI.disableInteraction();
}
function emitOpen(w) {
  emit('open-ipad', w);
}

// 其他功能
async function onScreenshotClick() {
  screenshotActive.value = true;
  await startScreenshot();
  screenshotActive.value = false;
}
async function onTaskManagerClick() {
  try {
    await window.electronAPI.openTaskManager();
  } catch (err) {
    console.error('打开任务管理器失败:', err);
  }
}
async function onBrowserClick() {
  try {
    await window.electronAPI.openDefaultBrowser();
  } catch (err) {
    console.error('打开浏览器失败:', err);
  }
}

// ESC键关闭弹窗
function onKeyDown(e) {
  if (e.key === 'Escape') {
    if (showBookmarkMenu.value) hideBookmarkMenuImmediately();
    if (showAddDialog.value) hideAddDialog();
    if (currentIPadWidth.value > 0) resetIPadState();
  }
}

function onIpadDoubleClick(e) {
  if (currentIPadWidth.value <= 0) return;
  const ipadWin = document.querySelector('.ipad-window');
  if (ipadWin && ipadWin.contains(e.target)) {
    resetIPadState();
  }
}

// 监听弹窗状态，保证弹窗期间 dock 保持 active，主窗口禁止穿透
watch([showBookmarkMenu, showAddDialog], ([bookmarkMenu, addDialog]) => {
  if (bookmarkMenu || addDialog) {
    isActive.value = true;
    window.electronAPI.enableInteraction();
  } else {
    // 只有所有弹窗都关闭时，才允许 dock 收起和主窗口穿透
    if (currentIPadWidth.value === 0 && !screenshotActive.value) {
      isActive.value = false;
      window.electronAPI.disableInteraction();
    }
  }
});

onMounted(() => {
  window.addEventListener("mousemove", onDetectEdge);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("dblclick", onIpadDoubleClick);
  loadBookmarks();
});
onUnmounted(() => {
  window.removeEventListener("mousemove", onDetectEdge);
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("dblclick", onIpadDoubleClick);
  document.removeEventListener('click', onDocumentClick, true);
});
</script>

<style src="../styles/dock.css"></style>
