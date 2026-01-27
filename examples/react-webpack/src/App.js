import { changeLanguage } from 'i18n-auto-plugin'
function App() {
  const changeLng = (lng) => changeLanguage(lng)

  return (
    <div className="App">
      <button onClick={() => changeLng('zh-CN')}>中文</button>
      <button onClick={() => changeLng('en-US')}>英文</button>
      <div>花飘万家雪</div>
      <div>你好</div>
    </div>
  )
}

export default App
