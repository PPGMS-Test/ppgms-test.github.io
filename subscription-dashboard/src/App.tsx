// subscription-dashboard/src/App.tsx
import { HashRouter, Route, Routes } from 'react-router-dom'
import { PlaygroundPage } from '@/pages/PlaygroundPage'
import { IntegrationGuidePage } from '@/pages/IntegrationGuidePage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<PlaygroundPage />} />
        <Route path="/guide" element={<IntegrationGuidePage />} />
      </Routes>
    </HashRouter>
  )
}
