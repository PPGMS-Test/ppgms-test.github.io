import { useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import Landing from './pages/Landing'
import MerchantConsole from './pages/MerchantConsole'
import Storefront from './pages/Storefront'
import ProductDetail from './pages/ProductDetail'
import ReturnPage from './pages/ReturnPage'
import { useThemeStore } from './store/theme'
import { RETURN_LINK_PARAM } from './lib/return-url'

export default function App() {
  const theme = useThemeStore((s) => s.theme)
  const navigate = useNavigate()

  // Single source of truth for the theme: sync the chosen theme to <html>.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // PayPal 回流：return_url 无 hash，形如 /?paylink=<id>&status=paid。
  // PayPal redirect 回来时会把它的参数（token / PayerID / 交易号等）**追加到同一个 query string 上**，
  // 因此启动时要把 window.location.search **整段**转发到 HashRouter 的 /return，
  // 而不是只挑 link/status——否则 PayPal 追加的交易号会被丢掉。清掉 search 防刷新重复触发。
  useEffect(() => {
    const search = window.location.search
    const sp = new URLSearchParams(search)
    if (!sp.get(RETURN_LINK_PARAM)) return
    window.history.replaceState(null, '', window.location.pathname)
    navigate(`/return${search}`, { replace: true })
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
