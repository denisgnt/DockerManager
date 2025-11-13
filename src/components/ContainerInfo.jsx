import { useState, useEffect } from 'react'
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
  Table,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import axios from 'axios'

const ContainerInfo = ({ container, onClose }) => {
  const [containerInfo, setContainerInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const getContainerName = (names) => {
    if (!names || names.length === 0) return 'Unnamed'
    return names[0].replace(/^\//, '')
  }

  useEffect(() => {
    const fetchContainerInfo = async () => {
      try {
        setLoading(true)
        const response = await axios.get(`/api/containers/${container.Id}`)
        setContainerInfo(response.data)
        setError(null)
      } catch (err) {
        setError(`Ошибка загрузки информации: ${err.message}`)
        console.error('Error fetching container info:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchContainerInfo()
  }, [container.Id])

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('ru-RU')
  }

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  const renderKeyValue = (key, value) => (
    <TableRow>
      <TableCell sx={{ fontWeight: 'bold', width: '30%', wordBreak: 'break-word' }}>{key}</TableCell>
      <TableCell sx={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{value || '-'}</TableCell>
    </TableRow>
  )

  const renderSection = (title, content) => (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="h6">{title}</Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ overflowY: 'auto', overflowX: 'hidden' }}>
        {content}
      </AccordionDetails>
    </Accordion>
  )

  if (loading) {
    return (
      <Dialog open={true} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Информация о контейнере</Typography>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>
    )
  }

  if (error) {
    return (
      <Dialog open={true} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Ошибка</Typography>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography color="error">{error}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} variant="contained">Закрыть</Button>
        </DialogActions>
      </Dialog>
    )
  }

  return (
    <Dialog open={true} onClose={onClose} maxWidth="lg" fullWidth fullScreen={window.innerWidth < 600}>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6">
              {getContainerName(containerInfo.Name ? [containerInfo.Name] : container.Names)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ID: {containerInfo.Id.substring(0, 12)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip 
              label={containerInfo.State.Status} 
              color={containerInfo.State.Running ? 'success' : 'error'}
              size="small"
            />
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ overflowX: 'hidden' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Основная информация */}
          {renderSection('Основная информация', (
            <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
              <TableBody>
                {renderKeyValue('Имя', containerInfo.Name)}
                {renderKeyValue('Image', containerInfo.Config.Image)}
                {renderKeyValue('ID', containerInfo.Id)}
                {renderKeyValue('Создан', formatDate(containerInfo.Created))}
                {renderKeyValue('Платформа', containerInfo.Platform)}
                {renderKeyValue('Driver', containerInfo.Driver)}
              </TableBody>
            </Table>
          ))}

          {/* Состояние */}
          {renderSection('Состояние', (
            <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
              <TableBody>
                {renderKeyValue('Status', containerInfo.State.Status)}
                {renderKeyValue('Running', containerInfo.State.Running ? 'Да' : 'Нет')}
                {renderKeyValue('Paused', containerInfo.State.Paused ? 'Да' : 'Нет')}
                {renderKeyValue('Restarting', containerInfo.State.Restarting ? 'Да' : 'Нет')}
                {renderKeyValue('OOMKilled', containerInfo.State.OOMKilled ? 'Да' : 'Нет')}
                {renderKeyValue('Dead', containerInfo.State.Dead ? 'Да' : 'Нет')}
                {renderKeyValue('Pid', containerInfo.State.Pid)}
                {renderKeyValue('Exit Code', containerInfo.State.ExitCode)}
                {renderKeyValue('Started At', formatDate(containerInfo.State.StartedAt))}
                {containerInfo.State.FinishedAt && renderKeyValue('Finished At', formatDate(containerInfo.State.FinishedAt))}
              </TableBody>
            </Table>
          ))}

          {/* Сеть */}
          {containerInfo.NetworkSettings && renderSection('Сеть', (
            <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
              <TableBody>
                {renderKeyValue('IP Address', containerInfo.NetworkSettings.IPAddress)}
                {renderKeyValue('Gateway', containerInfo.NetworkSettings.Gateway)}
                {renderKeyValue('Bridge', containerInfo.NetworkSettings.Bridge)}
                {renderKeyValue('MAC Address', containerInfo.NetworkSettings.MacAddress)}
                {containerInfo.NetworkSettings.Ports && Object.keys(containerInfo.NetworkSettings.Ports).length > 0 && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', width: '30%', wordBreak: 'break-word' }}>Ports</TableCell>
                    <TableCell sx={{ overflowWrap: 'anywhere' }}>
                      {Object.entries(containerInfo.NetworkSettings.Ports).map(([port, bindings]) => (
                        <Box key={port} sx={{ mb: 0.5 }}>
                          <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                            {port} → {bindings ? bindings.map(b => `${b.HostIp}:${b.HostPort}`).join(', ') : 'not bound'}
                          </Typography>
                        </Box>
                      ))}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ))}

          {/* Ресурсы */}
          {containerInfo.HostConfig && renderSection('Ресурсы', (
            <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
              <TableBody>
                {renderKeyValue('CPU Shares', containerInfo.HostConfig.CpuShares)}
                {renderKeyValue('Memory', formatBytes(containerInfo.HostConfig.Memory))}
                {renderKeyValue('Memory Swap', formatBytes(containerInfo.HostConfig.MemorySwap))}
                {renderKeyValue('CPU Quota', containerInfo.HostConfig.CpuQuota)}
                {renderKeyValue('CPU Period', containerInfo.HostConfig.CpuPeriod)}
                {renderKeyValue('Restart Policy', containerInfo.HostConfig.RestartPolicy?.Name)}
              </TableBody>
            </Table>
          ))}

          {/* Переменные окружения */}
          {containerInfo.Config.Env && containerInfo.Config.Env.length > 0 && renderSection('Переменные окружения', (
            <Box sx={{ overflowX: 'auto' }}>
              {containerInfo.Config.Env.map((env, index) => (
                <Typography key={index} variant="body2" sx={{ fontFamily: 'monospace', mb: 0.5, wordBreak: 'break-word' }}>
                  {env}
                </Typography>
              ))}
            </Box>
          ))}

          {/* Volumes */}
          {containerInfo.Mounts && containerInfo.Mounts.length > 0 && renderSection('Volumes', (
            <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
              <TableBody>
                {containerInfo.Mounts.map((mount, index) => (
                  <TableRow key={index}>
                    <TableCell sx={{ fontWeight: 'bold', width: '30%', wordBreak: 'break-word' }}>{mount.Type}</TableCell>
                    <TableCell sx={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      <Typography variant="body2">
                        {mount.Source} → {mount.Destination}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Mode: {mount.Mode}, RW: {mount.RW ? 'Yes' : 'No'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ))}

          {/* Labels */}
          {containerInfo.Config.Labels && Object.keys(containerInfo.Config.Labels).length > 0 && renderSection('Labels', (
            <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
              <TableBody>
                {Object.entries(containerInfo.Config.Labels).map(([key, value]) => (
                  renderKeyValue(key, value)
                ))}
              </TableBody>
            </Table>
          ))}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="contained" color="primary">
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ContainerInfo
