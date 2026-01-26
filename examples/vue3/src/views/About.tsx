import { defineComponent, ref } from 'vue'

export default defineComponent({
  name: 'About',
  setup() {
    const text = ref('写点什么好呢')
    console.log('text ==> ', text.value)
    return () => (
      <div title='测试属性文本'>
        <div>测试JSX</div>
        <span>{text.value}</span>
      </div>
    )
  },
})
