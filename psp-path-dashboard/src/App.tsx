import { useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { PlaygroundPage } from '@/pages/PlaygroundPage'
import { CredentialsPage } from '@/pages/CredentialsPage'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { useThemeStore } from '@/store/theme'

// HashRouter：部署到 GitHub Pages 静态托管，避免子路由刷新/直达 404（无服务端回退可用）。
export default function App() {
  const theme = useThemeStore((s) => s.theme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <TooltipProvider delayDuration={200}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<PlaygroundPage />} />
          <Route path="/credentials" element={<CredentialsPage />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  )
}
