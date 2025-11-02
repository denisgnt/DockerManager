import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Paper,
  Tooltip
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import { io } from 'socket.io-client'
import Ansi from 'ansi-to-react'

const ContainerLogs = ({ container, onClose }) => {
  const [logs, setLogs] = useState([])
  const [connected, setConnected] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const logsEndRef = useRef(null)
  const socketRef = useRef(null)

  const getContainerName = (names) => {
    if (!names || names.length === 0) return 'Unnamed'
    return names[0].replace(/^\//, '')
  }

  useEffect(() => {
    // В production используем текущий хост (т.к. всё на одном сервере)
    // В development используем переменные окружения
    const backendUrl = import.meta.env.PROD 
      ? window.location.origin  // В production используем текущий URL
      : `http://localhost:${import.meta.env.VITE_BACKEND_PORT || '5005'}`
    
    console.log('Connecting to Socket.IO:', backendUrl)
    
    // Connect to Socket.IO server
    socketRef.current = io(backendUrl, {
      transports: ['websocket'],
    })

    socketRef.current.on('connect', () => {
      console.log('Connected to Socket.IO server')
      setConnected(true)
      // Subscribe to container logs
      socketRef.current.emit('subscribe-logs', container.Id)
    })

    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server')
      setConnected(false)
    })

    socketRef.current.on('log-data', ({ containerId, data }) => {
      if (containerId === container.Id) {
        setLogs((prevLogs) => [...prevLogs, data])
      }
    })

    socketRef.current.on('log-error', ({ containerId, error }) => {
      if (containerId === container.Id) {
        setLogs((prevLogs) => [...prevLogs, `ERROR: ${error}`])
      }
    })

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('unsubscribe-logs')
        socketRef.current.disconnect()
      }
    }
  }, [container.Id])

  useEffect(() => {
    // Auto-scroll to bottom when new logs arrive
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const handleClearLogs = () => {
    setLogs([])
  }

  const toggleFullscreen = () => {
    setFullscreen(!fullscreen)
  }

  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth={fullscreen ? false : "lg"}
      fullWidth={!fullscreen}
      fullScreen={fullscreen}
      slotProps={{
        paper: {
          sx: {
            height: fullscreen ? '100vh' : '80vh',
            maxHeight: fullscreen ? '100vh' : '80vh'
          }
        }
      }}
    >
      <DialogTitle>
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            gap: 2
          }}
        >
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, minWidth: 0 }}>
            Логи контейнера: {getContainerName(container.Names)}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <Typography
              variant="caption"
              sx={{ 
                color: connected ? 'success.main' : 'error.main',
                mr: 1,
                fontWeight: 'medium'
              }}
            >
              {connected ? '● Подключено' : '● Отключено'}
            </Typography>
            <Tooltip title={fullscreen ? "Выход из полноэкранного режима" : "Полноэкранный режим"}>
              <IconButton
                color="inherit"
                onClick={toggleFullscreen}
                aria-label="toggle fullscreen"
                size="small"
              >
                {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>
            </Tooltip>
            <IconButton
              color="inherit"
              onClick={onClose}
              aria-label="close"
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Paper
          elevation={0}
          sx={{
            bgcolor: '#1e1e1e',
            color: '#d4d4d4',
            p: 2,
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            height: '100%',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            '& span': {
              fontFamily: 'monospace',
            }
          }}
        >
          {logs.length === 0 ? (
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100%',
                color: 'text.secondary'
              }}
            >
              <Typography>Ожидание логов...</Typography>
            </Box>
          ) : (
            <>
              {logs.map((log, index) => (
                <Box key={index} component="div" sx={{ mb: 0.25 }}>
                  <Ansi>{log}</Ansi>
                </Box>
              ))}
              <div ref={logsEndRef} />
            </>
          )}
        </Paper>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClearLogs} color="warning" variant="outlined">
          Очистить
        </Button>
        <Button onClick={onClose} variant="contained" color="primary">
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ContainerLogs
