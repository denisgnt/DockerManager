import { useState, useEffect, useRef, useMemo } from 'react'
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
  Tooltip,
  TextField,
  InputAdornment
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import { io } from 'socket.io-client'
import Ansi from 'ansi-to-react'

const ContainerLogs = ({ container, onClose }) => {
  const [logs, setLogs] = useState([])
  const [connected, setConnected] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [exportLines, setExportLines] = useState(5000)
  const [isExporting, setIsExporting] = useState(false)
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

  // Filter logs based on search text
  const filteredLogs = useMemo(() => {
    if (!filterText.trim()) {
      return logs.map((log, index) => ({ log, index }))
    }
    
    const filter = filterText.toLowerCase()
    return logs
      .map((log, index) => ({ log, index }))
      .filter(({ log }) => {
        // Remove ANSI codes for filtering
        const cleanLog = log.replace(/\x1b\[[0-9;]*m/g, '')
        return cleanLog.toLowerCase().includes(filter)
      })
  }, [logs, filterText])

  // Highlight matching text in log with yellow background
  const highlightMatch = (text) => {
    if (!filterText.trim()) {
      return <Ansi>{text}</Ansi>
    }

    const filter = filterText.toLowerCase()
    const parts = []
    let remaining = text
    let result = []
    
    // Process text character by character, handling ANSI codes
    let i = 0
    let plainText = ''
    let plainTextLower = ''
    
    while (i < remaining.length) {
      // Check for ANSI escape sequence
      if (remaining[i] === '\x1b' && remaining[i + 1] === '[') {
        let j = i + 2
        while (j < remaining.length && remaining[j] !== 'm') {
          j++
        }
        // Found complete ANSI code
        if (j < remaining.length) {
          plainText += remaining.substring(i, j + 1)
          i = j + 1
          continue
        }
      }
      
      // Regular character
      plainText += remaining[i]
      plainTextLower += remaining[i].toLowerCase()
      i++
    }
    
    // Find all occurrences of the filter in the plain text
    const matchIndex = plainTextLower.indexOf(filter)
    
    if (matchIndex === -1) {
      return <Ansi>{text}</Ansi>
    }
    
    // Split text into parts: before, match, after
    let beforeMatch = ''
    let match = ''
    let afterMatch = ''
    
    let charCount = 0
    let inMatch = false
    let matchChars = 0
    
    for (let i = 0; i < text.length; i++) {
      // Check for ANSI sequence
      if (text[i] === '\x1b' && text[i + 1] === '[') {
        let j = i + 2
        while (j < text.length && text[j] !== 'm') {
          j++
        }
        if (j < text.length) {
          const ansiCode = text.substring(i, j + 1)
          if (charCount < matchIndex) {
            beforeMatch += ansiCode
          } else if (inMatch) {
            match += ansiCode
          } else {
            afterMatch += ansiCode
          }
          i = j
          continue
        }
      }
      
      // Regular character
      if (charCount === matchIndex) {
        inMatch = true
      }
      
      if (inMatch && matchChars >= filterText.length) {
        inMatch = false
      }
      
      if (charCount < matchIndex) {
        beforeMatch += text[i]
      } else if (inMatch) {
        match += text[i]
        matchChars++
      } else {
        afterMatch += text[i]
      }
      
      charCount++
    }
    
    return (
      <>
        <Ansi>{beforeMatch}</Ansi>
        <Box
          component="span"
          sx={{
            backgroundColor: '#ffd700',
            color: '#000',
            fontWeight: 'bold',
            padding: '0 2px',
            borderRadius: '2px'
          }}
        >
          <Ansi>{match}</Ansi>
        </Box>
        <Ansi>{afterMatch}</Ansi>
      </>
    )
  }

  const handleClearFilter = () => {
    setFilterText('')
  }

  const handleExportLogs = async () => {
    setIsExporting(true)
    try {
      const backendUrl = import.meta.env.PROD 
        ? window.location.origin
        : `http://localhost:${import.meta.env.VITE_BACKEND_PORT || '5005'}`
      
      const response = await fetch(
        `${backendUrl}/api/containers/${container.Id}/export-logs?tail=${exportLines}`
      )
      
      if (!response.ok) {
        throw new Error('Ошибка при экспорте логов')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${getContainerName(container.Names)}_logs_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error exporting logs:', error)
      alert('Ошибка при экспорте логов: ' + error.message)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth={fullscreen ? false : "lg"}
      fullWidth={!fullscreen}
      fullScreen={fullscreen || window.innerWidth < 600}
      slotProps={{
        paper: {
          sx: {
            height: fullscreen ? '100vh' : { xs: '100vh', sm: '80vh' },
            maxHeight: fullscreen ? '100vh' : { xs: '100vh', sm: '80vh' }
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

      <Box sx={{ px: 3, pt: 2, pb: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Фильтр логов..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: filterText && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={handleClearFilter}
                    edge="end"
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'background.paper'
            }
          }}
        />
        {filterText && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Найдено строк: {filteredLogs.length} из {logs.length}
          </Typography>
        )}
      </Box>

      <DialogContent dividers>
        <Paper
          elevation={0}
          sx={{
            bgcolor: '#1e1e1e',
            color: '#d4d4d4',
            p: { xs: 1, sm: 2 },
            fontFamily: 'monospace',
            fontSize: { xs: '0.7rem', sm: '0.875rem' },
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
          ) : filteredLogs.length === 0 ? (
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100%',
                color: 'text.secondary'
              }}
            >
              <Typography>Нет логов, соответствующих фильтру</Typography>
            </Box>
          ) : (
            <>
              {filteredLogs.map(({ log, index }) => (
                <Box key={index} component="div" sx={{ mb: 0.25 }}>
                  {highlightMatch(log)}
                </Box>
              ))}
              <div ref={logsEndRef} />
            </>
          )}
        </Paper>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
          <TextField
            type="number"
            size="small"
            label="Строк для экспорта"
            value={exportLines}
            onChange={(e) => setExportLines(Math.max(1, parseInt(e.target.value) || 5000))}
            sx={{ width: { xs: 120, sm: 150 } }}
            inputProps={{ min: 1, max: 100000 }}
          />
          <Button 
            onClick={handleExportLogs} 
            color="success" 
            variant="outlined"
            disabled={isExporting}
          >
            {isExporting ? 'Экспорт...' : 'Экспорт в файл'}
          </Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={handleClearLogs} color="warning" variant="outlined">
            Очистить
          </Button>
          <Button onClick={onClose} variant="contained" color="primary">
            Закрыть
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  )
}

export default ContainerLogs
