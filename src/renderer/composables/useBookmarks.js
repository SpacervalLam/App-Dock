import { ref } from 'vue';

export function useBookmarks() {
  const bookmarks = ref([]);
  const loading = ref(false);
  const error = ref(null);

  async function loadBookmarks() {
    loading.value = true;
    try {
      const settings = await window.electronAPI.loadSettings();
      bookmarks.value = settings.bookmarks || [];
    } catch (err) {
      error.value = err;
      bookmarks.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function saveBookmarks() {
    try {
      await window.electronAPI.saveSettings({ bookmarks: JSON.parse(JSON.stringify(bookmarks.value)) });
    } catch (err) {
      error.value = err;
    }
  }

  async function addBookmark(bookmark) {
    bookmarks.value.push(bookmark);
    await saveBookmarks();
    await loadBookmarks();
  }

  async function deleteBookmark(index) {
    bookmarks.value.splice(index, 1);
    await saveBookmarks();
    await loadBookmarks();
  }

  return {
    bookmarks,
    loading,
    error,
    loadBookmarks,
    saveBookmarks,
    addBookmark,
    deleteBookmark
  };
} 