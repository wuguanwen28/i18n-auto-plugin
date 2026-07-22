<template>
  <img alt="Vue logo" src="./assets/logo.png" />
  <HelloWorld msg="欢迎使用" />
  <p>这是一个国际化测试</p>
  <button @click="changeLng('zh-CN')">中文</button>
  <button @click="changeLng('en-US')">英文</button>
</template>

<script>
import HelloWorld from "./components/HelloWorld.vue";
import { changeLanguage } from "i18n-auto-plugin";

export default {
  name: "App",
  components: {
    HelloWorld,
  },
  methods: {
    /** @param {any} lng 语言代码 */
    changeLng(lng) {
      changeLanguage(lng);
    },
  },
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
