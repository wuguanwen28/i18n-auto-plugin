import { computed, defineComponent, ref } from 'vue'

export default defineComponent({
  name: 'About',
  setup() {
    const text = ref('防守打法')
    const text2 = computed(() => `类型: ${text.value}`)
    return () => (
      <div class="box">
        <div>你好{text2.value}</div>
        <span>{text.value}</span>
      </div>
    )
  },
})
