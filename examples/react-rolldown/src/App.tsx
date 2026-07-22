import React from 'react'
import { changeLanguage, type LngType } from 'i18n-auto-plugin'

type AppProps = {}

export const App: React.FC<AppProps> = () => {
  const changeLng = (lng: LngType) => changeLanguage(lng)

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
