<template>
    <div class="viewer-root">
      <div class="controls">
        <button class="btn" @click="onSave">保存并复制到剪贴板</button>
        <button class="btn" @click="onOCR">文字识别</button>
        <button class="btn" @click="onDiscard">放弃</button>
      </div>
    <div class="content-area">
      <template v-if="!showSplit">
        <div ref="container" class="img-container full-width">
          <img
            v-if="imgSrc"
            ref="screenshotImg"
            :src="imgSrc"
            class="screenshot-img"
            draggable="false"
          />
        </div>
      </template>
      <template v-else>
        <div class="split-container">
          <div ref="container" class="img-container split-left">
            <img
              v-if="imgSrc"
              ref="screenshotImg"
              :src="imgSrc"
              class="screenshot-img"
              draggable="false"
            />
          </div>
          <div class="text-result split-right">
            <h3>识别结果</h3>
            <div class="text-content">{{ textResult }}</div>
            <button class="copy-btn" @click="copyTextResult">复制文本</button>
            <button class="copy-btn" @click="filterSpaces">过滤空格</button>
            <button class="copy-btn" @click="filterNewlines">过滤换行</button>
          </div>
        </div>
      </template>
    </div>
    </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, nextTick } from "vue";
import { startFullScreenOCR } from "../../utils/ocr";

export default {
  name: "ShowScreenshot",
  setup() {
    const imgSrc = ref("");
    const textResult = ref("");
    const showSplit = ref(false);
    const container = ref(null);
    const screenshotImg = ref(null);
    const settings = ref({});

    let scale = 1;
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let startPanX = 0;
    let startPanY = 0;

    // 等待图片加载后，让其居中并适应容器
    const fitImage = () => {
      const imgEl = screenshotImg.value;
      const cont = container.value;
      if (!imgEl || !cont) return;
      const cw = cont.clientWidth;
      const ch = cont.clientHeight;
      const iw = imgEl.naturalWidth;
      const ih = imgEl.naturalHeight;
      const fitScale = Math.min(cw / iw, ch / ih);
      scale = fitScale;
      panX = (cw - iw * scale) / 2;
      panY = (ch - ih * scale) / 2;
      updateTransform();
    };

    const updateTransform = () => {
      const imgEl = screenshotImg.value;
      if (imgEl) {
        imgEl.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
      }
    };

    const getMousePos = (e) => {
      const rect = container.value.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onWheel = (e) => {
      e.preventDefault();
      const imgEl = screenshotImg.value;
      const cont = container.value;
      if (!imgEl || !cont) return;

      const mousePos = getMousePos(e);
      // 计算鼠标在图片上的相对坐标（使用当前 scale 和 pan）
      const imgX = (mousePos.x - panX) / scale;
      const imgY = (mousePos.y - panY) / scale;

      // 缩放幅度减小：将除数设为 1000
      const delta = -e.deltaY / 1000;
      const newScale = Math.max(0.1, Math.min(scale + delta, 10));

      // 保持以鼠标为中心缩放：更新 panX, panY
      panX = mousePos.x - imgX * newScale;
      panY = mousePos.y - imgY * newScale;
      scale = newScale;
      updateTransform();
    };

    const onMouseDown = (e) => {
      e.preventDefault();
      if (!screenshotImg.value) return;
      isPanning = true;
      container.value.style.cursor = "grabbing";
      startPanX = e.clientX - panX;
      startPanY = e.clientY - panY;
    };

    const onMouseMove = (e) => {
      if (!isPanning) return;
      panX = e.clientX - startPanX;
      panY = e.clientY - startPanY;
      updateTransform();
    };

    const onMouseUp = () => {
      if (isPanning) {
        isPanning = false;
        container.value.style.cursor = "grab";
      }
    };

    const onSave = async () => {
      if (!imgSrc.value) return;
      try {
        if (settings.value.screenshotPath) {
          await window.electronAPI.saveImage(imgSrc.value, settings.value.screenshotPath);
        } else {
          await window.electronAPI.saveImageWithDialog(imgSrc.value);
        }
        window.close();
      } catch (error) {
        console.error('保存截图失败:', error);
        alert('保存失败: ' + error.message);
      }
    };

    const onDiscard = () => {
      window.close();
    };

    const onOCR = async () => {
      if (!imgSrc.value) {
        window.electronAPI.showNotification('操作失败', '没有可识别的图片');
        return;
      }
      try {
        textResult.value = await startFullScreenOCR(imgSrc.value);
        showSplit.value = true;
      } catch (error) {
        console.error('OCR error:', error);
      }
    };

    const copyTextResult = async () => {
      if (!textResult.value) return;
      try {
        await navigator.clipboard.writeText(textResult.value);
        window.electronAPI.showNotification('操作成功', '文本已复制到剪贴板');
      } catch (error) {
        console.error('复制失败:', error);
        window.electronAPI.showNotification('复制失败', error.message);
      }
    };

    const filterSpaces = () => {
      if (!textResult.value) return;
      textResult.value = textResult.value.replace(/ /g, '');
      window.electronAPI.showNotification('操作成功', '已过滤所有空格');
    };

    const filterNewlines = () => {
      if (!textResult.value) return;
      textResult.value = textResult.value.replace(/\n/g, '');
      window.electronAPI.showNotification('操作成功', '已过滤所有换行符');
    };

    onMounted(async () => {
      // 加载设置
      const loadedSettings = await window.electronAPI.loadSettings();
      settings.value = loadedSettings;
      
      window.electronAPI.viewerReady();

      window.electronAPI.onInitImage((payload) => {
        imgSrc.value = payload.dataURL;
        nextTick(() => {
          const imgEl = screenshotImg.value;
          imgEl.addEventListener("load", fitImage);
        });
      });

      if (container.value) {
        container.value.addEventListener("wheel", onWheel, { passive: false });
        container.value.addEventListener("mousedown", onMouseDown);
      }
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });

    onBeforeUnmount(() => {
      if (container.value) {
        container.value.removeEventListener("wheel", onWheel);
        container.value.removeEventListener("mousedown", onMouseDown);
      }
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    });

    return {
      imgSrc,
      textResult,
      showSplit,
      container,
      screenshotImg,
      onSave,
      onDiscard,
      onOCR,
      copyTextResult,
      filterSpaces,
      filterNewlines,
    };
  },
};
</script>

<style scoped>
.viewer-root {
  width: 100%;
  height: 100%;
  background: #333333;
  position: relative;
  user-select: none;
  cursor: default;
}

.content-area {
  display: flex;
  height: calc(100% - 60px);
}

.text-result {
  padding: 16px;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  overflow-y: auto;
}

.split-container {
  display: flex;
  width: 100%;
  height: 100%;
}

.split-left {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.split-right {
  width: 300px;
  flex-shrink: 0;
}

.full-width {
  width: 100%;
  height: 100%;
  position: relative;
}

.text-result h3 {
  margin-top: 0;
  margin-bottom: 12px;
}

.text-content {
  white-space: pre-wrap;
  margin-bottom: 16px;
}

.copy-btn {
  padding: 6px 12px;
  background: #333;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 8px;
}

.copy-btn:hover {
  background: #555;
}

/* 底部按钮 */
.controls {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  background: rgba(51, 51, 51, 0.9);
  z-index: 100;
}

.btn {
  padding: 8px 16px;
  font-size: 14px;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  user-select: none;
}
.btn:hover {
  background: rgba(255, 255, 255, 1);
}

/* 图片容器 */
.img-container {
  position: relative;
  height: 100%;
  overflow: hidden;
  cursor: grab;
}

/* 截图 <img> 初始居中适应 */
.screenshot-img {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  max-width: none;
  max-height: none;
}
</style>
