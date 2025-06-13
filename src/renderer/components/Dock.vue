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
          <div class="dock-icon" title="文字识别" @click.stop="onOCRClick">🔍</div>
          <div class="dock-icon" title="浏览器">🌐</div>
          <div class="dock-icon" title="设置">⚙️</div>
          <div class="dock-icon" title="邮件">✉️</div>
          <div class="dock-icon" title="音乐">🎵</div>
          <div class="dock-icon" title="照片">🖼️</div>
          <div class="dock-icon" title="计算器">🧮</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch } from "vue";
import { startScreenshot } from "../../utils/screenshot.js";

export default {
  name: "Dock",
  emits: ["open-ipad"],
  setup(_, { emit }) {
    const isActive = ref(false);
    const currentIPadWidth = ref(0);
    const screenshotActive = ref(false);
    let isDragging = false;
    let dragStartX = 0;
    let initialWidth = 0;
    let justReleased = false;

    const onDockMouseDown = (e) => {
      if (screenshotActive.value) return;
      if (e.target.closest(".dock-icon")) return;
      e.preventDefault();
      isDragging = true;
      dragStartX = e.clientX;
      initialWidth = currentIPadWidth.value;
      document.addEventListener("mousemove", onMouseMoveDrag);
      document.addEventListener("mouseup", onMouseUpDrag);
    };

    const onMouseMoveDrag = (e) => {
      if (!isDragging) return;
      const delta = dragStartX - e.clientX;
      let newWidth = initialWidth + delta;
      newWidth = Math.max(0, Math.min(newWidth, window.innerWidth * 0.8));
      currentIPadWidth.value = newWidth;
      emit("open-ipad", newWidth);
    };

    const onMouseUpDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      document.removeEventListener("mousemove", onMouseMoveDrag);
      document.removeEventListener("mouseup", onMouseUpDrag);
      justReleased = true;

      if (currentIPadWidth.value < 450) {
        currentIPadWidth.value = 0;
        emit("open-ipad", 0);
        isActive.value = false;
        window.electronAPI.disableInteraction();
        setTimeout(() => {
          justReleased = false;
        }, 50);
        return;
      }
      isActive.value = false;
      window.electronAPI.enableInteraction();
      setTimeout(() => {
        justReleased = false;
      }, 50);
    };

    const onDetectEdge = (e) => {
      if (isDragging || screenshotActive.value) return;
      if (currentIPadWidth.value > 0) return;
      if (!isActive.value) {
        const x = e.clientX;
        const w = window.innerWidth;
        if (x >= w - 6) openDock();
      }
    };

    const openDock = () => {
      isActive.value = true;
      window.electronAPI.enableInteraction();
    };

    const onDockMouseLeave = () => {
      if (isActive.value && !isDragging && !screenshotActive.value) {
        isActive.value = false;
        window.electronAPI.disableInteraction();
      }
    };

    const onOutsideClick = (e) => {
      if (justReleased) {
        justReleased = false;
        return;
      }
      if (currentIPadWidth.value <= 0) return;
      if (!e.target.closest(".ipad-window")) {
        currentIPadWidth.value = 0;
        emit("open-ipad", 0);
        isActive.value = false;
        window.electronAPI.disableInteraction();
      }
    };

    // 启动截图
    const onScreenshotClick = async () => {
      screenshotActive.value = true;
      await startScreenshot();
      screenshotActive.value = false;
    };




    onMounted(() => {
      window.addEventListener("mousemove", onDetectEdge);
      window.addEventListener("click", onOutsideClick);
      window.addEventListener("retract-dock", () => {
        isActive.value = false;
        window.electronAPI.disableInteraction();
      });
    });
    onUnmounted(() => {
      window.removeEventListener("mousemove", onDetectEdge);
      window.removeEventListener("click", onOutsideClick);
      window.removeEventListener("retract-dock", () => {
        isActive.value = false;
        window.electronAPI.disableInteraction();
      });
    });

    watch(
      () => currentIPadWidth.value,
      (w) => {
        if (w > 0) {
          window.electronAPI.enableInteraction();
        } else if (!screenshotActive.value) {
          window.electronAPI.disableInteraction();
        }
      }
    );

    return {
      isActive,
      screenshotActive,
      onDockMouseDown,
      onDockMouseLeave,
      currentIPadWidth,
      onScreenshotClick,
      emitOpen: (w) => emit("open-ipad", w),
    };
  },
};
</script>

<style src="../styles/dock.css"></style>
