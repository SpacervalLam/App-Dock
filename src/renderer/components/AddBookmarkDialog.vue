<template>
  <div class="add-bookmark-dialog">
    <div class="dialog-overlay" @click="$emit('cancel')"></div>
    <div class="dialog-content" @click.stop>
      <h3>添加网址收藏</h3>
      <div class="form-group">
        <label>网址标题：</label>
        <input v-model="title" type="text" placeholder="请输入网址标题" @keyup.enter="submit" />
      </div>
      <div class="form-group">
        <label>网址链接：</label>
        <input v-model="url" type="text" placeholder="https://example.com" @keyup.enter="submit" />
      </div>
      <div class="dialog-actions">
        <button @click="$emit('cancel')">取消</button>
        <button @click="submit" :disabled="!title || !url">添加</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
const props = defineProps({
  modelValue: Object
});
const emit = defineEmits(['update:modelValue', 'add', 'cancel']);
const title = ref(props.modelValue?.title || '');
const url = ref(props.modelValue?.url || '');
watch(() => props.modelValue, (val) => {
  title.value = val?.title || '';
  url.value = val?.url || '';
});
function submit() {
  if (title.value && url.value) {
    emit('add', { title: title.value, url: url.value });
  }
}
</script>

<style scoped>
.add-bookmark-dialog { position: fixed; z-index: 1100; top: 0; left: 0; width: 100vw; height: 100vh; }
.dialog-overlay { position: absolute; width: 100vw; height: 100vh; background: rgba(0,0,0,0.2); }
.dialog-content { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #fff; border-radius: 8px; padding: 24px; min-width: 320px; box-shadow: 0 2px 12px rgba(0,0,0,0.18); }
.form-group { margin-bottom: 16px; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 12px; }
</style> 