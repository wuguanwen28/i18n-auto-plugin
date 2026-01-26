<template>
  <div class="header">
    <div>
      <router-link v-for="route in routes" :key="route.path" :to="route.path">
        <button>
          {{ route.meta.title }}
        </button>
      </router-link>
    </div>
    <div class="lang">
      <button @click="changeLang('zh-CN')">中文</button>
      <button @click="changeLang('en-US')">English</button>
    </div>
  </div>
  <router-view></router-view>
</template>

<script lang="ts" setup>
import { type LngType, changeLanguage } from 'i18n-auto-plugin'
import { routes } from './router'

const changeLang = (lng: LngType) => {
  changeLanguage(lng)
}
</script>

<style>
#app {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.header {
  width: 100%;
  display: flex;
  justify-content: space-between;
}

.lang {
  display: flex;
}

button {
  height: 28px;
  margin: 0 10px;
  padding: 3px 12px;
}
</style>
