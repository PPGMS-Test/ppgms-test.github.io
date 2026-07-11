import { HashRouter, Route, Routes } from 'react-router-dom'
import { PlaygroundPage } from '@/pages/PlaygroundPage'
import { CredentialsPage } from '@/pages/CredentialsPage'

// HashRouter：部署到 GitHub Pages 静态托管，避免子路由刷新/直达 404（无服务端回退可用）。
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<PlaygroundPage />} />
        <Route path="/credentials" element={<CredentialsPage />} />
      </Routes>
    </HashRouter>
  )
}
