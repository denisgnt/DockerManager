import { useState, useMemo } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  IconButton,
  Box,
  Tooltip,
  CardActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  TableSortLabel,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Button
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import DeleteIcon from '@mui/icons-material/Delete'
import VisibilityIcon from '@mui/icons-material/Visibility'
import SearchIcon from '@mui/icons-material/Search'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import InfoIcon from '@mui/icons-material/Info'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'

const ContainerList = ({ containers, onAction, onViewLogs, onViewInfo, onViewStats, onExecuteScript, availableScripts = {}, viewMode = 'list' }) => {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(30)
  const [orderBy, setOrderBy] = useState('created')
  const [order, setOrder] = useState('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [columnMenuAnchor, setColumnMenuAnchor] = useState(null)
  
  // Favorite containers state with localStorage (using container names)
  const [favoriteContainers, setFavoriteContainers] = useState(() => {
    const saved = localStorage.getItem('dockerManagerFavoriteContainers')
    return saved ? JSON.parse(saved) : []
  })
  
  // Column visibility state with localStorage
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('dockerManagerVisibleColumns')
    return saved ? JSON.parse(saved) : {
      name: true,
      status: true,
      image: false,
      id: true,
      ports: true,
      serviceLink: false,
      created: true,
      actions: false,
      rebuild: true,
      view: true
    }
  })

  const handleColumnMenuOpen = (event) => {
    setColumnMenuAnchor(event.currentTarget)
  }

  const handleColumnMenuClose = () => {
    setColumnMenuAnchor(null)
  }

  const handleColumnToggle = (column) => {
    const newVisibleColumns = {
      ...visibleColumns,
      [column]: !visibleColumns[column]
    }
    setVisibleColumns(newVisibleColumns)
    localStorage.setItem('dockerManagerVisibleColumns', JSON.stringify(newVisibleColumns))
  }

  const toggleFavorite = (containerName) => {
    const newFavorites = favoriteContainers.includes(containerName)
      ? favoriteContainers.filter(name => name !== containerName)
      : [...favoriteContainers, containerName]
    
    setFavoriteContainers(newFavorites)
    localStorage.setItem('dockerManagerFavoriteContainers', JSON.stringify(newFavorites))
  }

  const isFavorite = (containerName) => {
    return favoriteContainers.includes(containerName)
  }

  const getStatusColor = (state, container) => {
    // If container is rebuilding, show grey
    if (container.Rebuilding) {
      return 'default'
    }
    
    switch (state.toLowerCase()) {
      case 'running':
        return 'success'
      case 'exited':
        return 'error'
      case 'paused':
        return 'warning'
      case 'unavailable':
        return 'default'
      default:
        return 'default'
    }
  }

  const getStatusLabel = (state, container) => {
    // If container is rebuilding, show "Rebuilding"
    if (container.Rebuilding) {
      return 'Rebuilding'
    }
    return state
  }

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString('ru-RU')
  }

  const getContainerName = (names) => {
    if (!names || names.length === 0) return 'Unnamed'
    return names[0].replace(/^\//, '')
  }

  const findScriptForContainer = (container) => {
    // First, try to get project name from docker-compose label
    const projectName = container.Labels?.['com.docker.compose.project']
    
    if (projectName) {
      // Try exact match with project name
      if (availableScripts[projectName]) {
        return availableScripts[projectName]
      }
      
    }
  }

  const formatPorts = (ports) => {
    if (!ports || ports.length === 0) return '-'
    
    // Remove duplicates - if public and private ports are the same, show only one
    const uniquePorts = new Set()
    ports.forEach(port => {
      if (port.PublicPort && port.PublicPort !== port.PrivatePort) {
        uniquePorts.add(`${port.PublicPort}:${port.PrivatePort}`)
      } else if (port.PublicPort) {
        uniquePorts.add(port.PublicPort.toString())
      } else {
        uniquePorts.add(port.PrivatePort.toString())
      }
    })
    
    // Sort ports numerically
    return Array.from(uniquePorts).sort((a, b) => {
      const getFirstPort = (str) => parseInt(str.split(':')[0])
      return getFirstPort(a) - getFirstPort(b)
    }).join(', ')
  }

  const getServiceLink = (ports) => {
    if (!ports || ports.length === 0) return null
    
    // Find first port with public mapping
    const publicPort = ports.find(port => port.PublicPort)
    if (publicPort) {
      // Use custom host from env or current page hostname
      const host = import.meta.env.VITE_SERVICE_HOST || window.location.hostname
      return `http://${host}:${publicPort.PublicPort}`
    }
    
    return null
  }

  const getPortsForSearch = (ports) => {
    if (!ports || ports.length === 0) return ''
    return ports.map(port => {
      if (port.PublicPort) {
        return `${port.PublicPort} ${port.PrivatePort}`
      }
      return port.PrivatePort.toString()
    }).join(' ')
  }

  // Sorting
  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc'
    setOrder(isAsc ? 'desc' : 'asc')
    setOrderBy(property)
  }

  const createSortHandler = (property) => () => {
    handleRequestSort(property)
  }

  // Pagination
  const handleChangePage = (event, newPage) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  // Search
  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value)
    setPage(0)
  }

  // Filter and sort containers
  const processedContainers = useMemo(() => {
    // Filter by search query
    let filtered = containers.filter((container) => {
      const name = getContainerName(container.Names).toLowerCase()
      const image = container.Image.toLowerCase()
      const id = container.Id.toLowerCase()
      const ports = getPortsForSearch(container.Ports).toLowerCase()
      const query = searchQuery.toLowerCase()
      
      return name.includes(query) || image.includes(query) || id.includes(query) || ports.includes(query)
    })

    // Sort by favorites first, then by selected criteria
    filtered.sort((a, b) => {
      // Favorites always come first
      const aIsFavorite = isFavorite(getContainerName(a.Names))
      const bIsFavorite = isFavorite(getContainerName(b.Names))
      
      if (aIsFavorite && !bIsFavorite) return -1
      if (!aIsFavorite && bIsFavorite) return 1
      
      // If both are favorites or both are not, sort by selected criteria
      let aValue, bValue

      switch (orderBy) {
        case 'name':
          aValue = getContainerName(a.Names).toLowerCase()
          bValue = getContainerName(b.Names).toLowerCase()
          break
        case 'status':
          aValue = a.State.toLowerCase()
          bValue = b.State.toLowerCase()
          break
        case 'image':
          aValue = a.Image.toLowerCase()
          bValue = b.Image.toLowerCase()
          break
        case 'id':
          aValue = a.Id
          bValue = b.Id
          break
        case 'ports':
          aValue = formatPorts(a.Ports)
          bValue = formatPorts(b.Ports)
          break
        case 'created':
          aValue = a.Created
          bValue = b.Created
          break
        default:
          return 0
      }

      if (aValue < bValue) return order === 'asc' ? -1 : 1
      if (aValue > bValue) return order === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [containers, searchQuery, order, orderBy, favoriteContainers])

  // Paginate
  const paginatedContainers = useMemo(() => {
    if (viewMode === 'list') {
      return processedContainers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
    }
    return processedContainers
  }, [processedContainers, page, rowsPerPage, viewMode])

  const renderActionButtons = (container) => {
    const scriptName = findScriptForContainer(container)
    const isRebuilding = container.Rebuilding
    const isUnavailable = container.State.toLowerCase() === 'unavailable'
    
    return (
      <Box display="flex" gap={0.5}>
        {container.State.toLowerCase() === 'running' ? (
          <>
            <Tooltip title="Остановить">
              <span>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => onAction(container.Id, 'stop')}
                  disabled={isRebuilding || isUnavailable}
                >
                  <StopIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Перезапустить">
              <span>
                <IconButton
                  size="small"
                  color="warning"
                  onClick={() => onAction(container.Id, 'restart')}
                  disabled={isRebuilding || isUnavailable}
                >
                  <RestartAltIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </>
        ) : (
          <>
            <Tooltip title="Запустить">
              <span>
                <IconButton
                  size="small"
                  color="success"
                  onClick={() => onAction(container.Id, 'start')}
                  disabled={isRebuilding || isUnavailable}
                >
                  <PlayArrowIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </>
        )}
        <Tooltip title="Удалить">
          <span>
            <IconButton
              size="small"
              color="error"
              onClick={() => {
                if (window.confirm(`Удалить контейнер ${getContainerName(container.Names)}?`)) {
                  onAction(container.Id, 'remove')
                }
              }}
              disabled={isRebuilding || isUnavailable}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    )
  }

  const renderRebuildButton = (container) => {
    const scriptName = findScriptForContainer(container)
    const isRebuilding = container.Rebuilding
    
    if (!scriptName) return <Box sx={{ width: 40 }} />
    
    return (
      <Tooltip title={isRebuilding ? "Rebuilding..." : "Rebuild"}>
        <span>
          <IconButton
            size="small"
            color="warning"
            onClick={() => onExecuteScript(container, scriptName)}
            disabled={isRebuilding}
          >
            <PlayCircleIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    )
  }

  const renderViewButtons = (container) => {
    const isRebuilding = container.Rebuilding
    const isUnavailable = container.State.toLowerCase() === 'unavailable'
    
    return (
      <Box display="flex" gap={0.5}>
        <Tooltip title="Информация">
          <span>
            <IconButton
              size="small"
              color="info"
              onClick={() => onViewInfo(container)}
              disabled={isRebuilding || isUnavailable}
            >
              <InfoIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Телеметрия">
          <span>
            <IconButton
              size="small"
              color="secondary"
              onClick={() => onViewStats(container)}
              disabled={isRebuilding || container.State.toLowerCase() !== 'running'}
            >
              <ShowChartIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Просмотр логов">
          <span>
            <IconButton
              size="small"
              color="primary"
              onClick={() => onViewLogs(container)}
              disabled={isRebuilding || isUnavailable}
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    )
  }

  // List view (table)
  const renderListView = () => (
    <TableContainer component={Paper} sx={{ width: '100%', overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell width={50} />
            {visibleColumns.name && (
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'name'}
                  direction={orderBy === 'name' ? order : 'asc'}
                  onClick={createSortHandler('name')}
                >
                  Name
                </TableSortLabel>
              </TableCell>
            )}
            {visibleColumns.status && (
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'status'}
                  direction={orderBy === 'status' ? order : 'asc'}
                  onClick={createSortHandler('status')}
                >
                  Status
                </TableSortLabel>
              </TableCell>
            )}
            {visibleColumns.image && (
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'image'}
                  direction={orderBy === 'image' ? order : 'asc'}
                  onClick={createSortHandler('image')}
                >
                  Image
                </TableSortLabel>
              </TableCell>
            )}
            {visibleColumns.id && (
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'id'}
                  direction={orderBy === 'id' ? order : 'asc'}
                  onClick={createSortHandler('id')}
                >
                  ID
                </TableSortLabel>
              </TableCell>
            )}
            {visibleColumns.ports && (
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'ports'}
                  direction={orderBy === 'ports' ? order : 'asc'}
                  onClick={createSortHandler('ports')}
                >
                  Ports
                </TableSortLabel>
              </TableCell>
            )}
            {visibleColumns.serviceLink && (
              <TableCell>Service Link</TableCell>
            )}
            {visibleColumns.created && (
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'created'}
                  direction={orderBy === 'created' ? order : 'asc'}
                  onClick={createSortHandler('created')}
                >
                  Created
                </TableSortLabel>
              </TableCell>
            )}
            {visibleColumns.actions && (
              <TableCell align="right">Actions</TableCell>
            )}
            {visibleColumns.rebuild && (
              <TableCell align="center">Rebuild</TableCell>
            )}
            {visibleColumns.view && (
              <TableCell align="center">View</TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {paginatedContainers.map((container) => (
            <TableRow 
              key={container.Id}
              sx={{ 
                '&:hover': { 
                  bgcolor: 'action.hover' 
                }
              }}
            >
              <TableCell>
                <IconButton
                  size="small"
                  onClick={() => toggleFavorite(getContainerName(container.Names))}
                  sx={{ 
                    color: isFavorite(getContainerName(container.Names)) ? '#ffd700' : 'action.disabled',
                    '&:hover': {
                      color: '#ffd700'
                    }
                  }}
                >
                  {isFavorite(getContainerName(container.Names)) ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                </IconButton>
              </TableCell>
              {visibleColumns.name && (
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {getContainerName(container.Names)}
                  </Typography>
                </TableCell>
              )}
              {visibleColumns.status && (
                <TableCell>
                  <Chip
                    label={getStatusLabel(container.State, container)}
                    color={getStatusColor(container.State, container)}
                    size="small"
                  />
                </TableCell>
              )}
              {visibleColumns.image && (
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {container.Image}
                  </Typography>
                </TableCell>
              )}
              {visibleColumns.id && (
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
                    {container.Id.substring(0, 12)}
                  </Typography>
                </TableCell>
              )}
              {visibleColumns.ports && (
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {formatPorts(container.Ports)}
                  </Typography>
                </TableCell>
              )}
              {visibleColumns.serviceLink && (
                <TableCell>
                  {getServiceLink(container.Ports) && container.State.toLowerCase() !== 'unavailable' ? (
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Typography 
                        component="a" 
                        href={getServiceLink(container.Ports)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        variant="body2"
                        sx={{
                          color: 'primary.main',
                          textDecoration: 'none',
                          '&:hover': {
                            textDecoration: 'underline'
                          }
                        }}
                      >
                        {getServiceLink(container.Ports)}
                      </Typography>
                      <OpenInNewIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">-</Typography>
                  )}
                </TableCell>
              )}
              {visibleColumns.created && (
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(container.Created)}
                  </Typography>
                </TableCell>
              )}
              {visibleColumns.actions && (
                <TableCell align="right">
                  {renderActionButtons(container)}
                </TableCell>
              )}
              {visibleColumns.rebuild && (
                <TableCell align="center">
                  {renderRebuildButton(container)}
                </TableCell>
              )}
              {visibleColumns.view && (
                <TableCell align="center">
                  {renderViewButtons(container)}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {viewMode === 'list' && (
        <TablePagination
          rowsPerPageOptions={[30, 50, 100]}
          component="div"
          count={processedContainers.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      )}
    </TableContainer>
  )

  // Grid view (cards)
  const renderGridView = () => (
    <Grid container spacing={{ xs: 2, sm: 2, md: 3 }}>
      {processedContainers.map((container) => {
        const scriptName = findScriptForContainer(container)
        const isRebuilding = container.Rebuilding
        
        return (
          <Grid item xs={12} sm={6} md={6} lg={4} xl={3} key={container.Id} sx={{ display: 'flex', justifyContent: 'center' }}>
            <Card 
            elevation={3}
            sx={{
              width: { xs: '100%', sm: 400, md: 450, lg: 400, xl: 480 },
              minWidth: { xs: 280, sm: 400 },
              maxWidth: '100%',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 6
              }
            }}
          >
            <CardContent sx={{ flexGrow: 1, pb: 1 }}>
              <Box 
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  mb: 2,
                  gap: 1
                }}
              >
                <Typography 
                  variant="h6" 
                  component="div"
                  sx={{ 
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    wordBreak: 'break-word',
                    flex: 1,
                    minWidth: 0,
                    fontSize: { xs: '1rem', sm: '1.25rem' }
                  }}
                >
                  {getContainerName(container.Names)}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexShrink: 0 }}>
                  <IconButton
                    size="small"
                    onClick={() => toggleFavorite(getContainerName(container.Names))}
                    sx={{ 
                      color: isFavorite(getContainerName(container.Names)) ? '#ffd700' : 'action.disabled',
                      '&:hover': {
                        color: '#ffd700'
                      }
                    }}
                  >
                    {isFavorite(getContainerName(container.Names)) ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                  </IconButton>
                  <Chip
                    label={getStatusLabel(container.State, container)}
                    color={getStatusColor(container.State, container)}
                    size="small"
                  />
                </Box>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                  <strong>Image:</strong> {container.Image}
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                  <strong>ID:</strong> {container.Id.substring(0, 12)}
                </Typography>

                {container.Ports && container.Ports.length > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    <strong>Ports:</strong> {formatPorts(container.Ports)}
                  </Typography>
                )}

                {getServiceLink(container.Ports) && container.State.toLowerCase() !== 'unavailable' && (
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'column', sm: 'row' },
                      alignItems: { xs: 'flex-start', sm: 'center' },
                      gap: { xs: 0, sm: 0.5 }
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      <strong>Service:</strong>
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, wordBreak: 'break-all' }}>
                      <Typography 
                        component="a" 
                        href={getServiceLink(container.Ports)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        variant="body2"
                        sx={{
                          color: 'primary.main',
                          textDecoration: 'none',
                          wordBreak: 'break-all',
                          '&:hover': {
                            textDecoration: 'underline'
                          }
                        }}
                      >
                        {getServiceLink(container.Ports)}
                      </Typography>
                      <OpenInNewIcon sx={{ fontSize: 14, color: 'primary.main', flexShrink: 0 }} />
                    </Box>
                  </Box>
                )}

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  <strong>Создан:</strong> {formatDate(container.Created)}
                </Typography>
              </Box>
            </CardContent>

            <CardActions 
              sx={{ 
                justifyContent: 'space-between', 
                px: 2, 
                py: 1.5,
                borderTop: 1,
                borderColor: 'divider'
              }}
            >
              <Box sx={{ display: 'flex', gap: { xs: 1, sm: 0.5 }, flexWrap: 'wrap' }}>
                {container.State.toLowerCase() === 'running' ? (
                  <>
                    <Tooltip title="Остановить">
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => onAction(container.Id, 'stop')}
                          disabled={isRebuilding || container.State.toLowerCase() === 'unavailable'}
                          sx={{ 
                            minWidth: { xs: 40, sm: 34 },
                            minHeight: { xs: 40, sm: 34 }
                          }}
                        >
                          <StopIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Перезапустить">
                      <span>
                        <IconButton
                          size="small"
                          color="warning"
                          onClick={() => onAction(container.Id, 'restart')}
                          disabled={isRebuilding || container.State.toLowerCase() === 'unavailable'}
                          sx={{ 
                            minWidth: { xs: 40, sm: 34 },
                            minHeight: { xs: 40, sm: 34 }
                          }}
                        >
                          <RestartAltIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </>
                ) : (
                  <Tooltip title="Запустить">
                    <span>
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() => onAction(container.Id, 'start')}
                        disabled={isRebuilding || container.State.toLowerCase() === 'unavailable'}
                        sx={{ 
                          minWidth: { xs: 40, sm: 34 },
                          minHeight: { xs: 40, sm: 34 }
                        }}
                      >
                        <PlayArrowIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
                <Tooltip title="Удалить">
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        if (window.confirm(`Удалить контейнер ${getContainerName(container.Names)}?`)) {
                          onAction(container.Id, 'remove')
                        }
                      }}
                      disabled={isRebuilding || container.State.toLowerCase() === 'unavailable'}
                      sx={{ 
                        minWidth: { xs: 40, sm: 34 },
                        minHeight: { xs: 40, sm: 34 }
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
              
              <Box sx={{ display: 'flex', gap: { xs: 1, sm: 0.5 }, flexWrap: 'wrap' }}>
                {scriptName && (
                  <Tooltip title={isRebuilding ? "Rebuilding..." : "Rebuild"}>
                    <span>
                      <IconButton
                        size="small"
                        color="warning"
                        onClick={() => onExecuteScript(container, scriptName)}
                        disabled={isRebuilding}
                        sx={{ 
                          minWidth: { xs: 40, sm: 34 },
                          minHeight: { xs: 40, sm: 34 }
                        }}
                      >
                        <PlayCircleIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
                <Tooltip title="Информация">
                  <span>
                    <IconButton
                      size="small"
                      color="info"
                      onClick={() => onViewInfo(container)}
                      disabled={isRebuilding || container.State.toLowerCase() === 'unavailable'}
                      sx={{ 
                        minWidth: { xs: 40, sm: 34 },
                        minHeight: { xs: 40, sm: 34 }
                      }}
                    >
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Телеметрия">
                  <span>
                    <IconButton
                      size="small"
                      color="secondary"
                      onClick={() => onViewStats(container)}
                      disabled={isRebuilding || container.State.toLowerCase() !== 'running'}
                      sx={{ 
                        minWidth: { xs: 40, sm: 34 },
                        minHeight: { xs: 40, sm: 34 }
                      }}
                    >
                      <ShowChartIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Просмотр логов">
                  <span>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => onViewLogs(container)}
                      disabled={isRebuilding || container.State.toLowerCase() === 'unavailable'}
                      sx={{ 
                        minWidth: { xs: 40, sm: 34 },
                        minHeight: { xs: 40, sm: 34 }
                      }}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            </CardActions>
          </Card>
        </Grid>
        )
      })}
    </Grid>
  )

  return (
    <Box sx={{ width: '100%' }}>
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: { xs: 'flex-start', sm: 'center' },
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
          flexDirection: { xs: 'column', sm: 'row' }
        }}
      >
        <Typography variant="h5" component="h2" sx={{ fontSize: { xs: '1.5rem', sm: '1.5rem' } }}>
          Контейнеры Docker ({containers.length})
        </Typography>
        {viewMode === 'list' && (
          <Button
            variant="outlined"
            startIcon={<ViewColumnIcon />}
            onClick={handleColumnMenuOpen}
            size="small"
          >
            Колонки
          </Button>
        )}
      </Box>
      
      <TextField
        fullWidth
        variant="outlined"
        placeholder="Поиск по имени, образу, ID или порту..."
        value={searchQuery}
        onChange={handleSearchChange}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }
        }}
        sx={{ mb: 2 }}
      />

      <Menu
        anchorEl={columnMenuAnchor}
        open={Boolean(columnMenuAnchor)}
        onClose={handleColumnMenuClose}
      >
        <MenuItem>
          <FormControlLabel
            control={
              <Checkbox
                checked={visibleColumns.name}
                onChange={() => handleColumnToggle('name')}
              />
            }
            label="Name"
          />
        </MenuItem>
        <MenuItem>
          <FormControlLabel
            control={
              <Checkbox
                checked={visibleColumns.status}
                onChange={() => handleColumnToggle('status')}
              />
            }
            label="Status"
          />
        </MenuItem>
        <MenuItem>
          <FormControlLabel
            control={
              <Checkbox
                checked={visibleColumns.image}
                onChange={() => handleColumnToggle('image')}
              />
            }
            label="Image"
          />
        </MenuItem>
        <MenuItem>
          <FormControlLabel
            control={
              <Checkbox
                checked={visibleColumns.id}
                onChange={() => handleColumnToggle('id')}
              />
            }
            label="ID"
          />
        </MenuItem>
        <MenuItem>
          <FormControlLabel
            control={
              <Checkbox
                checked={visibleColumns.ports}
                onChange={() => handleColumnToggle('ports')}
              />
            }
            label="Ports"
          />
        </MenuItem>
        <MenuItem>
          <FormControlLabel
            control={
              <Checkbox
                checked={visibleColumns.serviceLink}
                onChange={() => handleColumnToggle('serviceLink')}
              />
            }
            label="Service Link"
          />
        </MenuItem>
        <MenuItem>
          <FormControlLabel
            control={
              <Checkbox
                checked={visibleColumns.created}
                onChange={() => handleColumnToggle('created')}
              />
            }
            label="Created"
          />
        </MenuItem>
        <MenuItem>
          <FormControlLabel
            control={
              <Checkbox
                checked={visibleColumns.actions}
                onChange={() => handleColumnToggle('actions')}
              />
            }
            label="Actions"
          />
        </MenuItem>
        <MenuItem>
          <FormControlLabel
            control={
              <Checkbox
                checked={visibleColumns.rebuild}
                onChange={() => handleColumnToggle('rebuild')}
              />
            }
            label="Rebuild"
          />
        </MenuItem>
        <MenuItem>
          <FormControlLabel
            control={
              <Checkbox
                checked={visibleColumns.view}
                onChange={() => handleColumnToggle('view')}
              />
            }
            label="View"
          />
        </MenuItem>
      </Menu>

      {processedContainers.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '200px',
            flexDirection: 'column',
            gap: 2
          }}
        >
          <Typography variant="h6" color="text.secondary">
            Контейнеры не найдены
          </Typography>
          {searchQuery && (
            <Typography variant="body2" color="text.secondary">
              Попробуйте изменить поисковый запрос
            </Typography>
          )}
        </Box>
      ) : (
        viewMode === 'list' ? renderListView() : renderGridView()
      )}
    </Box>
  )
}

export default ContainerList
