import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ThemeContextProvider } from './ThemeContext.jsx'
import './mobile.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeContextProvider>
      <App />
    </ThemeContextProvider>
  </React.StrictMode>,
)
