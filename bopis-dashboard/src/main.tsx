// ============================================================
// main.tsx — 应用入口
// Application entry point. Mounts the React app into #root.
//
// StrictMode 会在开发环境对每个组件执行两次 mount/unmount，
// 用于提前暴露副作用不纯的问题（例如重复加载 SDK script）。
// StrictMode double-invokes mount/unmount in dev to surface impure side effects.
// PayPalButton 组件使用了单例 Promise 来应对这个行为。
// PayPalButton uses a singleton Promise to handle this correctly.
// ============================================================

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
