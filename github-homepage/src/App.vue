<script setup>
import { ref } from 'vue'
import NavColumn from './components/NavColumn.vue'
import navData from './router/nav-data.json'

const columns = ref(navData)
const isDarkMode = ref(false)

const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value
  document.body.classList.toggle('dark-mode', isDarkMode.value)
}
</script>

<template>
  <div id="app" :class="{ 'dark-mode': isDarkMode }">
    <!-- 主题切换按钮 -->
    <div class="theme-toggle">
      <button class="theme-toggle-btn" @click="toggleTheme" :title="isDarkMode ? '切换到亮色模式' : '切换到深色模式'">
        <span class="material-icons">{{ isDarkMode ? 'light_mode' : 'dark_mode' }}</span>
      </button>
    </div>

    <main>
      <div class="nav-container">
        <NavColumn
          v-for="(column, cIndex) in columns"
          :key="cIndex"
          :column="column"
          :cIndex="cIndex"
        />
      </div>
    </main>

    <footer>
      <p>本仓库访问地址:</p>
      <p><a href="https://github.com/PPGMS-Test/ppgms-test.github.io" target="_blank">https://github.com/PPGMS-Test/ppgms-test.github.io</a></p>
    </footer>
  </div>
</template>
