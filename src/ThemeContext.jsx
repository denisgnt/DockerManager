import { createContext, useContext, useMemo, useState } from 'react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { CssBaseline, GlobalStyles } from '@mui/material'

const ThemeContext = createContext()

export const useThemeMode = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeContextProvider')
  }
  return context
}

export const ThemeContextProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    const savedMode = localStorage.getItem('dockerManagerThemeMode')
    return savedMode || 'dark'
  })

  const toggleTheme = () => {
    const newMode = mode === 'dark' ? 'light' : 'dark'
    setMode(newMode)
    localStorage.setItem('dockerManagerThemeMode', newMode)
  }

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: '#2196f3',
          },
          secondary: {
            main: '#f50057',
          },
          ...(mode === 'dark'
            ? {
                background: {
                  default: '#121212',
                  paper: '#1e1e1e',
                },
              }
            : {
                background: {
                  default: '#fafafa',
                  paper: '#ffffff',
                },
              }),
        },
      }),
    [mode]
  )

  const scrollbarStyles = useMemo(
    () => (
      <GlobalStyles
        styles={{
          '*::-webkit-scrollbar': {
            width: '12px',
            height: '12px',
          },
          '*::-webkit-scrollbar-track': {
            background: mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
            borderRadius: '10px',
          },
          '*::-webkit-scrollbar-thumb': {
            background: mode === 'dark' ? '#424242' : '#c0c0c0',
            borderRadius: '10px',
            border: `2px solid ${mode === 'dark' ? '#1e1e1e' : '#f5f5f5'}`,
            '&:hover': {
              background: mode === 'dark' ? '#616161' : '#a0a0a0',
            },
          },
          '*::-webkit-scrollbar-corner': {
            background: mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
          },
          // Firefox
          '*': {
            scrollbarWidth: 'thin',
            scrollbarColor: mode === 'dark' ? '#424242 #1e1e1e' : '#c0c0c0 #f5f5f5',
          },
        }}
      />
    ),
    [mode]
  )

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {scrollbarStyles}
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  )
}
