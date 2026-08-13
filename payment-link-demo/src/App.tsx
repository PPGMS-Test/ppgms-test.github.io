import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import MerchantConsole from './pages/MerchantConsole'
import Storefront from './pages/Storefront'
import ProductDetail from './pages/ProductDetail'
import ReturnPage from './pages/ReturnPage'
import { useThemeStore } from './store/theme'

export default function App() {
  const theme = useThemeStore((s) => s.theme)

  // Single source of truth for the theme: sync the chosen theme to <html>.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

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
