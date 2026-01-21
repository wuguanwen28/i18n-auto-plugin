<template>
  <div
    title="无可奈何花落去"
    :data="{
      aa: '你好',
      // i18n-disabled
      cc: '你好2',
    }"
    @click="sohwToast('点击了')"
  >
    {{ title }}
    花飘万家雪
  </div>
  <!-- 标题 -->
  <span> 花飘万家雪 </span>
  <div style="display: inline">花飘万家雪</div>
  <About></About>
  <!-- i18n-disabled -->
  <div>{{ title }}</div>
</template>

<script lang="ts" setup>
/** @i18n-disabled */
import { ref } from 'vue'
import About from './About'

const subTitle = ref('副标题')
const title = ref(`测试文本：${subTitle.value}`)

const sohwToast = (title: string) => alert(title)
</script>
<style lang="scss" scoped>
body {
  background-color: #f00;
}
</style>
