import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

const testPlugin = (): Plugin => {
  return {
    name: 'test-plugin',
    async transform(code: string, path: string) {
      if (path.endsWith('App.vue')) {
        console.log('code ==> ', code)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueJsx(), testPlugin()],
})
