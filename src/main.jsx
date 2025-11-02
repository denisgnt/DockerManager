import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { CssBaseline, GlobalStyles } from '@mui/material'
import { ThemeProvider, createTheme } from '@mui/material/styles'

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#2196f3',
    },
    secondary: {
      main: '#f50057',
    },
  },
})

const scrollbarStyles = (
  <GlobalStyles
    styles={{
      '*::-webkit-scrollbar': {
        width: '12px',
        height: '12px',
      },
      '*::-webkit-scrollbar-track': {
        background: '#1e1e1e',
        borderRadius: '10px',
      },
      '*::-webkit-scrollbar-thumb': {
        background: '#424242',
        borderRadius: '10px',
        border: '2px solid #1e1e1e',
        '&:hover': {
          background: '#616161',
        },
      },
      '*::-webkit-scrollbar-corner': {
        background: '#1e1e1e',
      },
      // Firefox
      '*': {
        scrollbarWidth: 'thin',
        scrollbarColor: '#424242 #1e1e1e',
      },
    }}
  />
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      {scrollbarStyles}
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
