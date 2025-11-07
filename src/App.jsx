import { useEffect } from 'react'
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
import ContainerStats from './components/ContainerStats'
import ScriptOutput from './components/ScriptOutput'
import useDockerStore from './store/useDockerStore'

function App() {
  // Получение состояния и действий из store
  const {
    containers,
    selectedContainer,
    selectedContainerInfo,
    selectedContainerStats,
    loading,
    error,
    availableScripts,
    rebuildingContainers,
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
  } = useDockerStore()

  useEffect(() => {
    fetchContainers()
    fetchScripts()
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchContainers, 5000)
    return () => clearInterval(interval)
  }, [fetchContainers, fetchScripts])

  const handleViewModeChange = (event, newMode) => {
    if (newMode !== null) {
      setViewMode(newMode)
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
              onViewLogs={setSelectedContainer}
              onViewInfo={setSelectedContainerInfo}
              onViewStats={setSelectedContainerStats}
              onExecuteScript={executeScript}
              availableScripts={availableScripts}
              rebuildingContainers={rebuildingContainers}
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
