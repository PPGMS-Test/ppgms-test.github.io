import { useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import Landing from './pages/Landing'
import MerchantConsole from './pages/MerchantConsole'
import Storefront from './pages/Storefront'
import ProductDetail from './pages/ProductDetail'
import ReturnPage from './pages/ReturnPage'
import { useThemeStore } from './store/theme'
import { RETURN_LINK_PARAM, RETURN_STATUS_PARAM } from './lib/return-url'

export default function App() {
  const theme = useThemeStore((s) => s.theme)
  const navigate = useNavigate()

  // Single source of truth for the theme: sync the chosen theme to <html>.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // PayPal 回流：return_url 无 hash，形如 /?paylink=<id>&status=paid。
  // 启动时把该 query 转发到 HashRouter 的 /return，并清掉 search 防刷新重复触发。
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const link = sp.get(RETURN_LINK_PARAM)
    if (!link) return
    const status = sp.get(RETURN_STATUS_PARAM) ?? 'paid'
    window.history.replaceState(null, '', window.location.pathname)
    navigate(`/return?link=${encodeURIComponent(link)}&status=${encodeURIComponent(status)}`, {
      replace: true,
    })
  }, [navigate])

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/merchant" element={<MerchantConsole />} />
      <Route path="/store" element={<Storefront />} />
      <Route path="/store/:productId" element={<ProductDetail />} />
      <Route path="/return" element={<ReturnPage />} />
    </Routes>
  )
}
