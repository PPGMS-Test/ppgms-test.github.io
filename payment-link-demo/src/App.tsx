import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import MerchantConsole from './pages/MerchantConsole'
import Storefront from './pages/Storefront'
import ProductDetail from './pages/ProductDetail'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/merchant" element={<MerchantConsole />} />
      <Route path="/store" element={<Storefront />} />
      <Route path="/store/:productId" element={<ProductDetail />} />
    </Routes>
  )
}
