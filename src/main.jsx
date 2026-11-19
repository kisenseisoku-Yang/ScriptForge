import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { I18nProvider } from './i18n/index.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </I18nProvider>
  </React.StrictMode>,
)

// ============ 窗口圆角 ↔ 最大化联动 ============
// Electron roundedCorners 在 Win11/macOS 上给窗口加原生圆角，最大化时自动消失
// 这里同步控制 CSS border-radius，避免最大化后页面四角还有圆角露馅
{
  const root = document.getElementById('root')
  const api = typeof window !== 'undefined' ? window.electronAPI : null
  if (root && api?.win) {
    // 初始状态
    api.win.isMaximized().then((maxed) => {
      root.classList.toggle('is-maximized', !!maxed)
    }).catch(() => {})
    // 状态变化
    api.win.onMaximizeChange((maxed) => {
      root.classList.toggle('is-maximized', !!maxed)
    })
  }
}
