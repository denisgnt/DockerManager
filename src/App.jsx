import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Container,
  Box,
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  Alert,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  Snackbar,
  Tooltip,
  TextField,
  InputAdornment
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import ViewListIcon from '@mui/icons-material/ViewList'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import ContainerList from './components/ContainerList'
import ContainerLogs from './components/ContainerLogs'
import ContainerInfo from './components/ContainerInfo'
import ContainerStats from './components/ContainerStats'
import ScriptOutput from './components/ScriptOutput'
import DependencyGraph from './components/DependencyGraph'
import useDockerStore from './store/useDockerStore'
import { io } from 'socket.io-client'
import { useThemeMode } from './ThemeContext'
import packageJson from '../package.json'

function App() {
  const { mode, toggleTheme } = useThemeMode()
  const [searchParams, setSearchParams] = useSearchParams()
  const [graphSearchQuery, setGraphSearchQuery] = useState('')
  const [graphRefreshTrigger, setGraphRefreshTrigger] = useState(0)
  
  // Получение состояния и действий из store
  const {
    containers,
    selectedContainer,
    selectedContainerInfo,
    selectedContainerStats,
    loading,
    error,
    availableScripts,
    snackbar,
    scriptOutput,
    viewMode,
    dockerApiUrl,
    fetchContainers,
    fetchScripts,
    handleContainerAction,
    executeScript,
    setSelectedContainer,
    setSelectedContainerInfo,
    setSelectedContainerStats,
    setError,
    closeSnackbar,
    closeScriptOutput,
    setViewMode,
    updateContainerRebuildStatus,
    appendScriptOutput,
    completeScriptOutput,
  } = useDockerStore()

  // Синхронизация viewMode с URL
  useEffect(() => {
    const viewFromUrl = searchParams.get('view')
    if (viewFromUrl && ['list', 'grid', 'graph'].includes(viewFromUrl)) {
      if (viewMode !== viewFromUrl) {
        setViewMode(viewFromUrl)
      }
    } else if (!viewFromUrl) {
      // Если в URL нет view, устанавливаем текущий viewMode
      setSearchParams({ view: viewMode }, { replace: true })
    }
  }, [searchParams, viewMode, setViewMode, setSearchParams])

  useEffect(() => {
    fetchContainers()
    fetchScripts()
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchContainers, 5000)
    return () => clearInterval(interval)
  }, [fetchContainers, fetchScripts])

  // Socket.IO для real-time обновлений rebuild статуса
  useEffect(() => {
    const socket = io()
    
    socket.on('rebuild-status-changed', ({ containerId, rebuilding }) => {
      console.log(`Rebuild status changed for ${containerId}: ${rebuilding}`)
      updateContainerRebuildStatus(containerId, rebuilding)
    })

    socket.on('script-output', ({ containerId, data, type }) => {
      console.log(`Script output (${type}):`, data)
      appendScriptOutput(data)
    })

    socket.on('script-completed', ({ containerId, exitCode, success }) => {
      console.log(`Script completed for ${containerId}: exit code ${exitCode}`)
      completeScriptOutput(exitCode, success)
    })

    return () => {
      socket.disconnect()
    }
  }, [updateContainerRebuildStatus, appendScriptOutput, completeScriptOutput])

  const handleViewModeChange = (event, newMode) => {
    if (newMode !== null) {
      setViewMode(newMode)
      setSearchParams({ view: newMode })
    }
  }

  const handleRefresh = () => {
    if (viewMode === 'graph') {
      // Для графа - триггерим обновление зависимостей
      setGraphRefreshTrigger(prev => prev + 1)
    } else {
      // Для списка/плитки - обновляем контейнеры
      fetchContainers()
    }
  }

  return (
    <>
      <AppBar 
        position="fixed" 
        elevation={0}
        sx={{ 
          backdropFilter: 'blur(20px)',
          backgroundColor: mode === 'dark' 
            ? 'rgba(80, 80, 80, 0.5)' 
            : 'rgba(200,200, 200, 0.3)',
          borderBottom: mode === 'dark'
            ? '1px solid rgba(194, 224, 255, 0.08)'
            : '1px solid rgba(0, 0, 0, 0.08)',
          color: mode === 'dark' ? '#fff' : 'rgba(0, 0, 0, 0.87)'
        }}
      >
        <Toolbar>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" component="div" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              Docker Manager
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                fontSize: { xs: '0.65rem', sm: '0.75rem' },
                opacity: 0.7,
                fontWeight: 500,
                backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
                padding: '2px 6px',
                borderRadius: '4px',
                display: { xs: 'none', sm: 'inline-block' }
              }}
            >
              v{packageJson.version}
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ mr: 2, display: { xs: 'none', md: 'block' }, fontSize: { sm: '0.8rem', md: '0.875rem' } }}>
            API: {dockerApiUrl}
          </Typography>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            size="small"
            sx={{ 
              mr: 2,
              '& .MuiToggleButton-root': {
                color: mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
                borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.23)' : 'rgba(0, 0, 0, 0.23)',
                '&.Mui-selected': {
                  color: mode === 'dark' ? '#90caf9' : '#1976d2',
                  backgroundColor: mode === 'dark' ? 'rgba(144, 202, 249, 0.16)' : 'rgba(25, 118, 210, 0.08)',
                  '&:hover': {
                    backgroundColor: mode === 'dark' ? 'rgba(144, 202, 249, 0.24)' : 'rgba(25, 118, 210, 0.12)',
                  }
                },
                '&:hover': {
                  backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                }
              }
            }}
          >
            <ToggleButton value="list" aria-label="list view">
              <ViewListIcon sx={{ mr: { xs: 0, md: 0.5 } }} fontSize="small" />
              <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                Список
              </Box>
            </ToggleButton>
            <ToggleButton value="grid" aria-label="grid view">
              <ViewModuleIcon sx={{ mr: { xs: 0, md: 0.5 } }} fontSize="small" />
              <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                Плитка
              </Box>
            </ToggleButton>
            <ToggleButton value="graph" aria-label="graph view">
              <AccountTreeIcon sx={{ mr: { xs: 0, md: 0.5 } }} fontSize="small" />
              <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                Граф
              </Box>
            </ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title={mode === 'dark' ? 'Светлая тема' : 'Темная тема'}>
            <IconButton color="inherit" onClick={toggleTheme} aria-label="toggle theme" sx={{ mr: 1 }}>
              {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Tooltip>
          <IconButton color="inherit" onClick={handleRefresh} aria-label="refresh">
            <RefreshIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Spacer для фиксированного AppBar */}
      <Toolbar />

      {viewMode === 'graph' ? (
        <DependencyGraph 
          searchQuery={graphSearchQuery} 
          onSearchChange={setGraphSearchQuery}
          mode={mode}
          refreshTrigger={graphRefreshTrigger}
        />
      ) : (
        <Container maxWidth="xl" sx={{ mt: { xs: 2, sm: 4 }, mb: { xs: 2, sm: 4 }, px: { xs: 2, sm: 3 } }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {loading && !containers.length ? (
              <Box 
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  minHeight: '50vh' 
                }}
              >
                <CircularProgress />
              </Box>
            ) : (
              <>
                <ContainerList
                  containers={containers}
                  onAction={handleContainerAction}
                  onViewLogs={setSelectedContainer}
                  onViewInfo={setSelectedContainerInfo}
                  onViewStats={setSelectedContainerStats}
                  onExecuteScript={executeScript}
                  availableScripts={availableScripts}
                  viewMode={viewMode}
                />
                
                {selectedContainer && (
                  <ContainerLogs
                    container={selectedContainer}
                    onClose={() => setSelectedContainer(null)}
                  />
                )}

                {selectedContainerInfo && (
                  <ContainerInfo
                    container={selectedContainerInfo}
                    onClose={() => setSelectedContainerInfo(null)}
                  />
                )}

                {selectedContainerStats && (
                  <ContainerStats
                    container={selectedContainerStats}
                    onClose={() => setSelectedContainerStats(null)}
                  />
                )}

                <ScriptOutput
                  open={scriptOutput.open}
                  onClose={closeScriptOutput}
                  scriptData={scriptOutput.data}
                />
              </>
            )}
        </Container>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={closeSnackbar}
        message={snackbar.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        ContentProps={{
          sx: {
            bgcolor: '#323232',
            color: '#fff',
            '& .MuiSnackbarContent-message': {
              fontSize: '0.95rem',
              fontWeight: 500
            }
          }
        }}
      />
    </>
  )
}

export default App
