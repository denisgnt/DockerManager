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
  CircularProgress,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Alert,
  useTheme
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import axios from 'axios'

const ContainerStats = ({ container, onClose }) => {
  const theme = useTheme()
  const [statsData, setStatsData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updateInterval, setUpdateInterval] = useState(() => {
    // Load from localStorage or default to 10 seconds
    return parseInt(localStorage.getItem('dockerStatsInterval') || '10000', 10)
  })
  const intervalRef = useRef(null)

  const getContainerName = (names) => {
    if (!names || names.length === 0) return 'Unnamed'
    return names[0].replace(/^\//, '')
  }

  const calculateCPUPercent = (stats) => {
    if (!stats?.cpu_stats || !stats?.precpu_stats) return 0

    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage
    const numberCpus = stats.cpu_stats.online_cpus || 1

    if (systemDelta > 0 && cpuDelta > 0) {
      return ((cpuDelta / systemDelta) * numberCpus * 100).toFixed(2)
    }
    return 0
  }

  const calculateMemoryUsage = (stats) => {
    if (!stats?.memory_stats) return { usage: 0, limit: 0, percent: 0 }

    const usage = stats.memory_stats.usage || 0
    const limit = stats.memory_stats.limit || 0
    const percent = limit > 0 ? ((usage / limit) * 100).toFixed(2) : 0

    return {
      usage: (usage / 1024 / 1024).toFixed(2), // MB
      limit: (limit / 1024 / 1024).toFixed(2), // MB
      percent
    }
  }

  const fetchStats = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/containers/${container.Id}/stats`, {
        params: { stream: false }
      })
      
      const cpuPercent = parseFloat(calculateCPUPercent(response.data))
      const memoryData = calculateMemoryUsage(response.data)
      
      const timestamp = new Date().toLocaleTimeString('ru-RU')
      
      setStatsData(prevData => {
        const newData = [
          ...prevData,
          {
            time: timestamp,
            cpu: cpuPercent,
            memory: parseFloat(memoryData.percent),
            memoryMB: parseFloat(memoryData.usage)
          }
        ]
        
        // Keep only last 50 data points
        return newData.slice(-50)
      })
      
      setError(null)
      setLoading(false)
    } catch (err) {
      setError(`Ошибка загрузки статистики: ${err.message}`)
      console.error('Error fetching container stats:', err)
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchStats()
    
    // Set up interval
    intervalRef.current = setInterval(fetchStats, updateInterval)
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [container.Id, updateInterval])

  const handleIntervalChange = (event) => {
    const newInterval = event.target.value
    setUpdateInterval(newInterval)
    localStorage.setItem('dockerStatsInterval', newInterval.toString())
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            backgroundColor: theme.palette.mode === 'dark' ? '#424242' : '#fff',
            border: `1px solid ${theme.palette.mode === 'dark' ? '#666' : '#ccc'}`,
            borderRadius: 1,
            p: 1.5,
            boxShadow: 2
          }}
        >
          <Typography 
            variant="caption" 
            sx={{ 
              fontWeight: 'bold', 
              color: theme.palette.text.primary, 
              display: 'block', 
              mb: 0.5 
            }}
          >
            {label}
          </Typography>
          {payload.map((entry, index) => (
            <Typography 
              key={index} 
              variant="caption" 
              sx={{ 
                color: entry.stroke || entry.color, 
                display: 'block' 
              }}
            >
              {entry.name}: {entry.value}
              {entry.dataKey === 'cpu' ? '%' : entry.dataKey === 'memory' ? '%' : ' MB'}
            </Typography>
          ))}
        </Box>
      )
    }
    return null
  }

  return (
    <Dialog open={true} onClose={onClose} maxWidth="lg" fullWidth fullScreen={window.innerWidth < 600}>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6">
              Телеметрия: {getContainerName(container.Names)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ID: {container.Id.substring(0, 12)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Интервал обновления</InputLabel>
              <Select
                value={updateInterval}
                onChange={handleIntervalChange}
                label="Интервал обновления"
              >
                <MenuItem value={5000}>5 секунд</MenuItem>
                <MenuItem value={10000}>10 секунд</MenuItem>
                <MenuItem value={30000}>30 секунд</MenuItem>
              </Select>
            </FormControl>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ overflowX: 'hidden' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading && statsData.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            
            {/* Current Stats Summary */}
            {statsData.length > 0 && (
              <Box sx={{ 
                mt: 2, 
                p: 2, 
                backgroundColor: 'background.paper',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider'
              }}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                  Текущие показатели:
                </Typography>
                <Box sx={{ display: 'flex', gap: 4 }}>
                  <Typography variant="body2">
                    <strong>CPU:</strong> {statsData[statsData.length - 1].cpu}%
                  </Typography>
                  <Typography variant="body2">
                    <strong>Memory:</strong> {statsData[statsData.length - 1].memory}% 
                    ({statsData[statsData.length - 1].memoryMB} MB)
                  </Typography>
                </Box>
              </Box>
            )}
            
            {/* CPU Chart */}
            <Box>
              <Typography variant="h6" sx={{ mb: 2, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                CPU Usage (%)
              </Typography>
              <ResponsiveContainer width="100%" height={window.innerWidth < 600 ? 200 : 120}>
                <LineChart data={statsData} isAnimationActive={false}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 12 }}
                    angle={0}
                    textAnchor="end"
                    
                  />
                  <YAxis 
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone"
                    dataKey="cpu" 
                    stroke={theme.palette.mode === 'dark' ? '#a4ff50' : '#4caf50'} 
                    name="CPU %"
                    isAnimationActive={false}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>

            {/* Memory Chart */}
            <Box>
              <Typography variant="h6" sx={{ mb: 2, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                Memory Usage
              </Typography>
              <ResponsiveContainer width="100%" height={window.innerWidth < 600 ? 200 : 120}>
                <LineChart data={statsData} isAnimationActive={false}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 12 }}
                    angle={0}
                    textAnchor="end"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    domain={[0, 1000]}
                    label={{ value: 'MB', angle: 90, position: 'insideLeft' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone"
                    dataKey="memoryMB" 
                    stroke={theme.palette.mode === 'dark' ? '#ffb64a' : '#ff9800'} 
                    name="Memory MB"
                    isAnimationActive={false}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>

            
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="contained" color="primary">
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ContainerStats