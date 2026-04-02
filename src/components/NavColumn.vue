<script setup>
import { ref } from 'vue'

defineProps({
  column: {
    type: Object,
    required: true
  }
})

// 每层级的展开状态: { 'level1-groupIdx': true, 'level2-itemIdx': true, ... }
const expanded = ref({})

const toggle = (key) => {
  expanded.value[key] = expanded.value[key] === false ? true : false
}

const isExpanded = (key) => {
  return expanded.value[key] !== false
}
</script>

<template>
  <div class="nav-column">
    <div class="nav-column-header">
      <span class="material-icons">{{ column.icon }}</span>
      {{ column.title }}
    </div>

    <div v-for="(group, gIndex) in column.groups" :key="gIndex">
      <!-- Group Header -->
      <div class="group-header" @click="toggle(`g-${gIndex}`)">
        <span class="group-title">
          <span class="material-icons">{{ group.icon }}</span>
          {{ group.title }}
        </span>
        <span class="material-icons expand-icon">{{ isExpanded(`g-${gIndex}`) ? 'expand_less' : 'expand_more' }}</span>
      </div>

      <!-- Group Items -->
      <div v-if="isExpanded(`g-${gIndex}`)" class="group-body">
        <div v-for="(item, iIndex) in group.items" :key="iIndex" class="nav-item">
          <template v-if="item.isFolder && item.hasChildren">
            <!-- Folder with children - collapsible -->
            <div class="item-header folder-item" @click="toggle(`g-${gIndex}-i-${iIndex}`)">
              <span class="material-icons">chevron_right</span>
              <span class="item-title">{{ item.description || item.text }}</span>
              <span class="material-icons expand-icon">{{ isExpanded(`g-${gIndex}-i-${iIndex}`) ? 'expand_less' : 'expand_more' }}</span>
            </div>

            <!-- Children of folder -->
            <div v-if="isExpanded(`g-${gIndex}-i-${iIndex}`)" class="item-children">
              <div v-for="(child, ci) in item.children" :key="ci" class="nav-item child-item child-link-row">
                <span class="material-icons">subdirectory_arrow_right</span>
                <a :href="child.url" target="_blank" class="link-url">{{ child.text }}</a>
              </div>

              <!-- Sub-groups (3rd level) -->
              <div v-for="(subGroup, sgi) in item.subGroups" :key="sgi" class="nav-item sub-group-item">
                <div class="item-header folder-item" @click="toggle(`g-${gIndex}-i-${iIndex}-sg-${sgi}`)">
                  <span class="material-icons">folder</span>
                  <span class="item-title">{{ subGroup.description }}</span>
                  <span class="material-icons expand-icon">{{ isExpanded(`g-${gIndex}-i-${iIndex}-sg-${sgi}`) ? 'expand_less' : 'expand_more' }}</span>
                </div>
                <div v-if="isExpanded(`g-${gIndex}-i-${iIndex}-sg-${sgi}`)" class="item-children">
                  <div v-for="(sgChild, sgci) in subGroup.children" :key="sgci" class="nav-item child-item child-link-row">
                    <span class="material-icons">subdirectory_arrow_right</span>
                    <a :href="sgChild.url" target="_blank" class="link-url">{{ sgChild.text }}</a>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="item.isFolder">
            <!-- Folder without children - just show as link -->
            <div class="item-header folder-item">
              <span class="material-icons">folder</span>
              <a :href="item.url" target="_blank" class="link-url">{{ item.description || item.text }}</a>
            </div>
          </template>

          <template v-else>
            <!-- Regular file link -->
            <div class="item-link-row">
              <span class="material-icons">chevron_right</span>
              <a :href="item.url" target="_blank" class="link-url">{{ item.description || item.text }}</a>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
