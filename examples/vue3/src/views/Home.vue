<template>
  <div>
    <div>{{ text1 }}</div>
    <div>{{ text2 }}</div>
    <div>
      <span>测试静态</span>
      <span>文本</span>
    </div>
    <div title="标题">测试属性文本</div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

const text1 = ref('测试普通文本')

const world = '世界'
const text2 = ref(`测试模板：你好${world}`)
var aa = '顶替'
console.log('text2 ==> ', text2.value, aa)
</script>
<style lang="scss" scoped></style>
