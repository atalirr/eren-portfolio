import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import { initializeApiConfig } from './shared/config/api.config'

initializeApiConfig()
  .then(() => {
    console.log('[OK] API Config initialized')
    const rootElement = document.getElementById('root')
    if (rootElement) {
      ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      )
    }
  })
  .catch((err) => {
    console.error('[ERROR] API Config initialization failed:', err)
    const rootElement = document.getElementById('root')
    if (rootElement) {
      ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      )
    }
  })


