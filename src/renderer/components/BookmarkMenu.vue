<template>
  <div class="bookmark-menu" :style="{ top: pos.y + 'px', right: pos.x + 'px', pointerEvents: 'auto' }" @click.stop>
    <div class="bookmark-list">
      <div v-for="(bookmark, index) in bookmarks" :key="index" class="bookmark-item" @click="openBookmark(bookmark)">
        <div class="bookmark-icon">🔗</div>
        <div class="bookmark-info">
          <div class="bookmark-title">{{ bookmark.title ? bookmark.title : bookmark.url }}</div>
        </div>
        <div class="bookmark-actions">
          <button class="bookmark-delete" @click.stop="$emit('delete', index)" title="删除">×</button>
        </div>
      </div>
      <div class="bookmark-item add-bookmark" @click.stop="$emit('add')">
        <div class="bookmark-icon">➕</div>
        <div class="bookmark-info">
          <div class="bookmark-title">添加网址</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  bookmarks: Array,
  pos: Object
});
const emit = defineEmits(['hide', 'delete', 'add', 'open']);
function openBookmark(bookmark) {
  emit('open', bookmark);
}
</script>

<style scoped>
.bookmark-menu { position: fixed; z-index: 1000; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.15); border-radius: 8px; min-width: 240px; }
.bookmark-list { max-height: 320px; overflow-y: auto; }
.bookmark-item { display: flex; align-items: center; padding: 8px 12px; cursor: pointer; }
.bookmark-item.add-bookmark { color: #409eff; }
.bookmark-icon { margin-right: 8px; }
.bookmark-actions { margin-left: auto; }
.bookmark-delete { background: none; border: none; color: #f56c6c; font-size: 18px; cursor: pointer; }
</style> 