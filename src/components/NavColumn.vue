<script setup>
import { ref } from 'vue'

defineProps({
  column: {
    type: Object,
    required: true
  }
})

const expanded = ref(true)

const toggle = () => {
  expanded.value = !expanded.value
}
</script>

<template>
  <div class="nav-column">
    <div class="nav-column-header" @click="toggle">
      <span class="material-icons">{{ column.icon }}</span>
      {{ column.title }}
      <span class="material-icons expand-icon">{{ expanded ? 'expand_less' : 'expand_more' }}</span>
    </div>

    <div v-if="expanded">
      <div v-for="(group, gIndex) in column.groups" :key="gIndex">
        <div class="group-title">
          <span class="material-icons">{{ group.icon }}</span>
          {{ group.title }}
        </div>
        <div v-for="(item, iIndex) in group.items" :key="iIndex" class="nav-item">
          <span class="material-icons">chevron_right</span>
          <div class="link-container">
            <span v-if="item.description" class="link-description">{{ item.description }}</span>
            <a :href="item.url" target="_blank" class="link-url">{{ item.text || item.url }}</a>

            <!-- Level 4 sub-items (folder children) -->
            <div v-if="item.children && item.children.length" class="nav-sub-group">
              <div v-for="(child, ci) in item.children" :key="ci" class="nav-item nav-sub-item">
                <span class="material-icons">subdirectory_arrow_right</span>
                <div class="link-container">
                  <span v-if="child.description" class="link-description">{{ child.description }}</span>
                  <a :href="child.url" target="_blank" class="link-url">{{ child.text || child.url }}</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
