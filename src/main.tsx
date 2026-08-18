import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AboutPage } from './pages/AboutPage'

const Page = window.location.pathname === '/about' || window.location.pathname.startsWith('/about/')
  ? AboutPage
  : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Page />
  </StrictMode>,
)
