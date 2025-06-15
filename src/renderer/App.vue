<template>
  <div id="app">
    <!-- 根据 isViewer 的值判断是否显示截图组件 -->
    <ShowScreenshot v-if="isViewer" />
    <template v-else>
      <!-- 如果不是 Viewer 模式，显示 Dock 组件，并监听 open-ipad 事件 -->
      <Dock @open-ipad="openIPad" />
      <!-- 根据 showIPadWindow 的值判断是否显示 iPad 窗口组件，传入宽度并监听 close 事件 -->
      <IPadWindow v-if="showIPadWindow" :width="ipadWidth" @close="closeIPad" />
    </template>
  </div>
</template>

<script>
import { ref, computed, onMounted } from "vue";
import Dock from "./components/Dock.vue";
import IPadWindow from "./components/IPadWindow.vue";
import ShowScreenshot from "./components/ShowScreenshot.vue";

export default {
  name: "App",
  components: {
    Dock,
    IPadWindow,
    ShowScreenshot,
  },
  setup() {
    // 创建响应式变量 showIPadWindow 和 ipadWidth
    const showIPadWindow = ref(false);
    const ipadWidth = ref(0);

    // 定义 openIPad 方法，设置 iPad 窗口宽度并显示窗口
    const openIPad = (w) => {
      ipadWidth.value = w;
      showIPadWindow.value = true;
    };
    // 定义 closeIPad 方法，关闭 iPad 窗口并重置宽度
    const closeIPad = () => {
      showIPadWindow.value = false;
      ipadWidth.value = 0;
    };

    // 计算属性 isViewer，判断 URL 中是否包含 viewer=true 参数
    const isViewer = computed(() =>
      window.location.search.includes("viewer=true")
    );
    // 在组件挂载后添加 popstate 事件监听器
    onMounted(() => {
      window.addEventListener("popstate", () => {});
    });

    // 返回响应式变量和方法供模板使用
    return {
      showIPadWindow,
      ipadWidth,
      openIPad,
      closeIPad,
      isViewer,
    };
  },
};
</script>

<style>
html,
body,
#app {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  background-color: transparent;
}

/* iPadWindow 过渡动画 */
.ipad-window {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  transition: width 0.2s ease-out;
  z-index: 800;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.2);
}

/* 确保 Dock 在 iPadWindow 上方 */
.dock-wrapper {
  z-index: 1000;
}
</style>