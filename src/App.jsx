import { useState, useEffect } from 'react'
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
  Snackbar
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import ViewListIcon from '@mui/icons-material/ViewList'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import ContainerList from './components/ContainerList'
import ContainerLogs from './components/ContainerLogs'
import ContainerInfo from './components/ContainerInfo'
import ScriptOutput from './components/ScriptOutput'
import axios from 'axios'

function App() {
  const [containers, setContainers] = useState([])
  const [selectedContainer, setSelectedContainer] = useState(null)
  const [selectedContainerInfo, setSelectedContainerInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [availableScripts, setAvailableScripts] = useState({})
  const [rebuildingContainers, setRebuildingContainers] = useState(new Set())
  const [snackbar, setSnackbar] = useState({ open: false, message: '' })
  const [scriptOutput, setScriptOutput] = useState({ open: false, data: null })
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('dockerManagerViewMode') || 'list'
  })

  const dockerApiHost = import.meta.env.VITE_DOCKER_API_HOST || '10.174.18.242'
  const dockerApiPort = import.meta.env.VITE_DOCKER_API_PORT || '2375'
  const dockerApiUrl = `${dockerApiHost}:${dockerApiPort}`

  const fetchContainers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await axios.get('/api/containers')
      setContainers(response.data)
    } catch (err) {
      setError(`Ошибка подключения к Docker API: ${err.message}`)
      console.error('Error fetching containers:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchScripts = async () => {
    try {
      const response = await axios.get('/api/scripts')
      setAvailableScripts(response.data)
    } catch (err) {
      console.error('Error fetching scripts:', err)
    }
  }

  useEffect(() => {
    fetchContainers()
    fetchScripts()
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchContainers, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleContainerAction = async (containerId, action) => {
    try {
      setError(null)
      let response
      
      switch (action) {
        case 'start':
          response = await axios.post(`/api/containers/${containerId}/start`)
          break
        case 'stop':
          response = await axios.post(`/api/containers/${containerId}/stop`)
          break
        case 'restart':
          response = await axios.post(`/api/containers/${containerId}/restart`)
          break
        case 'remove':
          response = await axios.delete(`/api/containers/${containerId}`)
          if (selectedContainer?.Id === containerId) {
            setSelectedContainer(null)
          }
          break
        default:
          break
      }
      
      // Refresh containers list after action
      setTimeout(fetchContainers, 1000)
    } catch (err) {
      setError(`Ошибка при выполнении операции: ${err.message}`)
      console.error('Error performing container action:', err)
    }
  }

  const handleViewLogs = (container) => {
    setSelectedContainer(container)
  }

  const handleCloseLogs = () => {
    setSelectedContainer(null)
  }

  const handleViewInfo = (container) => {
    setSelectedContainerInfo(container)
  }

  const handleCloseInfo = () => {
    setSelectedContainerInfo(null)
  }

  const handleExecuteScript = async (container, scriptName) => {
    const containerId = container.Id
    const containerName = container.Names[0].replace(/^\//, '')
    
    try {
      setError(null)
      // Add to rebuilding set
      setRebuildingContainers(prev => new Set(prev).add(containerId))
      
      const response = await axios.post('/api/scripts/execute', {
        scriptName,
        containerName
      })
      
      if (response.data.success) {
        // Show success snackbar
        setSnackbar({ 
          open: true, 
          message: `Скрипт успешно выполнен для ${containerName}` 
        })
        
        // Show script output dialog
        setScriptOutput({
          open: true,
          data: {
            containerName,
            output: response.data.output || '',
            exitCode: response.data.exitCode
          }
        })
        
        // Refresh containers after script execution
        setTimeout(fetchContainers, 1000)
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message
      const output = err.response?.data?.output || ''
      
      setError(`Ошибка выполнения скрипта: ${errorMsg}`)
      
      // Show error output if available
      if (output) {
        setScriptOutput({
          open: true,
          data: {
            containerName,
            output,
            exitCode: err.response?.data?.exitCode
          }
        })
      }
      
      console.error('Error executing script:', err)
    } finally {
      // Remove from rebuilding set after a delay
      setTimeout(() => {
        setRebuildingContainers(prev => {
          const newSet = new Set(prev)
          newSet.delete(containerId)
          return newSet
        })
      }, 2000)
    }
  }

  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: '' })
  }

  const handleCloseScriptOutput = () => {
    setScriptOutput({ open: false, data: null })
  }

  const handleViewModeChange = (event, newMode) => {
    if (newMode !== null) {
      setViewMode(newMode)
      localStorage.setItem('dockerManagerViewMode', newMode)
    }
  }

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Docker Manager
          </Typography>
          <Typography variant="body2" sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>
            API: {dockerApiUrl}
          </Typography>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            size="small"
            sx={{ mr: 2 }}
            color="primary"
          >
            <ToggleButton value="list" aria-label="list view">
              <ViewListIcon sx={{ mr: { xs: 0, sm: 0.5 } }} fontSize="small" />
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Список
              </Box>
            </ToggleButton>
            <ToggleButton value="grid" aria-label="grid view">
              <ViewModuleIcon sx={{ mr: { xs: 0, sm: 0.5 } }} fontSize="small" />
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Плитка
              </Box>
            </ToggleButton>
          </ToggleButtonGroup>
          <IconButton color="inherit" onClick={fetchContainers} aria-label="refresh">
            <RefreshIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
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
              onViewLogs={handleViewLogs}
              onViewInfo={handleViewInfo}
              onExecuteScript={handleExecuteScript}
              availableScripts={availableScripts}
              rebuildingContainers={rebuildingContainers}
              viewMode={viewMode}
            />
            
            {selectedContainer && (
              <ContainerLogs
                container={selectedContainer}
                onClose={handleCloseLogs}
              />
            )}

            {selectedContainerInfo && (
              <ContainerInfo
                container={selectedContainerInfo}
                onClose={handleCloseInfo}
              />
            )}

            <ScriptOutput
              open={scriptOutput.open}
              onClose={handleCloseScriptOutput}
              scriptData={scriptOutput.data}
            />
          </>
        )}
      </Container>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
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
