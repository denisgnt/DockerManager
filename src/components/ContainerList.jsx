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

const ContainerList = ({ containers, onAction, onViewLogs, onViewInfo, onExecuteScript, availableScripts = {}, rebuildingContainers = new Set(), viewMode = 'list' }) => {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(30)
  const [orderBy, setOrderBy] = useState('created')
  const [order, setOrder] = useState('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [columnMenuAnchor, setColumnMenuAnchor] = useState(null)
  
  // Column visibility state with localStorage
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('dockerManagerVisibleColumns')
    return saved ? JSON.parse(saved) : {
      name: true,
      status: true,
      image: false,
      id: true,
      ports: true,
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

  const getStatusColor = (state, containerId) => {
    // If container is rebuilding, show grey
    if (rebuildingContainers.has(containerId)) {
      return 'default'
    }
    
    switch (state.toLowerCase()) {
      case 'running':
        return 'success'
      case 'exited':
        return 'error'
      case 'paused':
        return 'warning'
      default:
        return 'default'
    }
  }

  const getStatusLabel = (state, containerId) => {
    // If container is rebuilding, show "Rebuilding"
    if (rebuildingContainers.has(containerId)) {
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
    return ports.map(port => 
      port.PublicPort ? `${port.PublicPort}:${port.PrivatePort}` : port.PrivatePort
    ).join(', ')
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
      const query = searchQuery.toLowerCase()
      
      return name.includes(query) || image.includes(query) || id.includes(query)
    })

    // Sort
    filtered.sort((a, b) => {
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
  }, [containers, searchQuery, order, orderBy])

  // Paginate
  const paginatedContainers = useMemo(() => {
    if (viewMode === 'list') {
      return processedContainers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
    }
    return processedContainers
  }, [processedContainers, page, rowsPerPage, viewMode])

  const renderActionButtons = (container) => {
    const scriptName = findScriptForContainer(container)
    const isRebuilding = rebuildingContainers.has(container.Id)
    
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
                  disabled={isRebuilding}
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
                  disabled={isRebuilding}
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
                  disabled={isRebuilding}
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
              disabled={isRebuilding}
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
    const isRebuilding = rebuildingContainers.has(container.Id)
    
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
    const isRebuilding = rebuildingContainers.has(container.Id)
    
    return (
      <Box display="flex" gap={0.5}>
        <Tooltip title="Информация">
          <span>
            <IconButton
              size="small"
              color="info"
              onClick={() => onViewInfo(container)}
              disabled={isRebuilding}
            >
              <InfoIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Просмотр логов">
          <span>
            <IconButton
              size="small"
              color="primary"
              onClick={() => onViewLogs(container)}
              disabled={isRebuilding}
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
    <TableContainer component={Paper} sx={{ width: '100%' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
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
              <TableCell>Ports</TableCell>
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
                    label={getStatusLabel(container.State, container.Id)}
                    color={getStatusColor(container.State, container.Id)}
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
    <Grid container spacing={2}>
      {processedContainers.map((container) => {
        const scriptName = findScriptForContainer(container)
        const isRebuilding = rebuildingContainers.has(container.Id)
        
        return (
          <Grid item key={container.Id}>
            <Card 
            elevation={3}
            sx={{
              width: 485,
              height: '100%',
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
                    minWidth: 0
                  }}
                >
                  {getContainerName(container.Names)}
                </Typography>
                <Chip
                  label={getStatusLabel(container.State, container.Id)}
                  color={getStatusColor(container.State, container.Id)}
                  size="small"
                  sx={{ flexShrink: 0 }}
                />
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
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {container.State.toLowerCase() === 'running' ? (
                  <>
                    <Tooltip title="Остановить">
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => onAction(container.Id, 'stop')}
                          disabled={isRebuilding}
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
                          disabled={isRebuilding}
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
                        disabled={isRebuilding}
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
                      disabled={isRebuilding}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
              
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {scriptName && (
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
                )}
                <Tooltip title="Информация">
                  <span>
                    <IconButton
                      size="small"
                      color="info"
                      onClick={() => onViewInfo(container)}
                      disabled={isRebuilding}
                    >
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Просмотр логов">
                  <span>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => onViewLogs(container)}
                      disabled={isRebuilding}
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
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2
        }}
      >
        <Typography variant="h5" component="h2">
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
        placeholder="Поиск по имени, образу или ID..."
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
