<template>
  <div id="app">
    <ShowScreenshot v-if="isViewer" />
    <template v-else>
      <Dock @open-ipad="openIPad" />
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
    const showIPadWindow = ref(false);
    const ipadWidth = ref(0);

    const openIPad = (w) => {
      ipadWidth.value = w;
      showIPadWindow.value = true;
    };
    const closeIPad = () => {
      showIPadWindow.value = false;
      ipadWidth.value = 0;
    };

    // 判断 URL 中是否包含 viewer=true
    const isViewer = computed(() =>
      window.location.search.includes("viewer=true")
    );
    onMounted(() => {
      window.addEventListener("popstate", () => {});
    });

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
