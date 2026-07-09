import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { PlaygroundPage } from '@/pages/PlaygroundPage'
import { CredentialsPage } from '@/pages/CredentialsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PlaygroundPage />} />
        <Route path="/credentials" element={<CredentialsPage />} />
      </Routes>
    </BrowserRouter>
  )
}
