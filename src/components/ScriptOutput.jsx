import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Chip
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import Ansi from 'ansi-to-react'

const ScriptOutput = ({ open, onClose, scriptData }) => {
  const [filterText, setFilterText] = useState('')
  const logsEndRef = useRef(null)
  
  const { containerName, output, exitCode, streaming } = scriptData || {}

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [output])

  // Split output into lines for filtering
  const lines = useMemo(() => {
    if (!output) return []
    return output.split('\n')
  }, [output])

  // Filter lines based on search text
  const filteredLines = useMemo(() => {
    if (!filterText.trim()) {
      return lines.map((line, index) => ({ line, index }))
    }
    
    const filter = filterText.toLowerCase()
    return lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => {
        // Remove ANSI codes for filtering
        const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '')
        return cleanLine.toLowerCase().includes(filter)
      })
  }, [lines, filterText])

  // Highlight matching text with yellow background
  const highlightMatch = (text) => {
    if (!filterText.trim()) {
      return <Ansi>{text}</Ansi>
    }

    const filter = filterText.toLowerCase()
    let plainText = ''
    let plainTextLower = ''
    
    // Extract plain text without ANSI codes
    let i = 0
    while (i < text.length) {
      if (text[i] === '\x1b' && text[i + 1] === '[') {
        let j = i + 2
        while (j < text.length && text[j] !== 'm') {
          j++
        }
        if (j < text.length) {
          i = j + 1
          continue
        }
      }
      plainText += text[i]
      plainTextLower += text[i].toLowerCase()
      i++
    }
    
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
  
  if (!scriptData) return null

  return (
    <Dialog
      open={open}
      onClose={streaming ? undefined : onClose}
      maxWidth="lg"
      fullWidth
      fullScreen={window.innerWidth < 600}
      slotProps={{
        paper: {
          sx: {
            minHeight: '60vh',
            maxHeight: '80vh',
            '@keyframes pulse': {
              '0%, 100%': {
                opacity: 1,
              },
              '50%': {
                opacity: 0.5,
              },
            },
          }
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1
        }}
      >
        <Box>
          <Typography variant="h6" component="span">
            Результат выполнения скрипта
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Контейнер: {containerName}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {streaming && (
            <Chip 
              label="Выполняется..." 
              color="primary" 
              size="small"
              sx={{ animation: 'pulse 2s ease-in-out infinite' }}
            />
          )}
          <IconButton
            edge="end"
            color="inherit"
            onClick={onClose}
            aria-label="close"
            disabled={streaming}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <Box sx={{ px: 3, pt: 2, pb: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Фильтр вывода..."
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
            Найдено строк: {filteredLines.length} из {lines.length}
          </Typography>
        )}
      </Box>

      <DialogContent dividers>
        <Box
          sx={{
            bgcolor: '#1e1e1e',
            color: '#d4d4d4',
            p: { xs: 1, sm: 2 },
            borderRadius: 1,
            fontFamily: 'monospace',
            fontSize: { xs: '0.75rem', sm: '0.875rem' },
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            height: { xs: '300px', sm: '400px' }
          }}
        >
          {!output ? (
            <Typography color="text.secondary">Ожидание вывода...</Typography>
          ) : filteredLines.length === 0 ? (
            <Typography color="text.secondary">Нет строк, соответствующих фильтру</Typography>
          ) : (
            filteredLines.map(({ line, index }) => (
              <Box key={index} component="div" sx={{ mb: 0.25 }}>
                {highlightMatch(line)}
              </Box>
            ))
          )}
          <div ref={logsEndRef} />
        </Box>
        
        {exitCode !== undefined && exitCode !== null && !streaming && (
          <Box sx={{ mt: 2 }}>
            <Typography
              variant="body2"
              sx={{
                color: exitCode === 0 ? 'success.main' : 'error.main',
                fontWeight: 'medium'
              }}
            >
              Exit Code: {exitCode}
              {exitCode === 0 ? ' (Успешно)' : ' (Ошибка)'}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained" disabled={streaming}>
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ScriptOutput
