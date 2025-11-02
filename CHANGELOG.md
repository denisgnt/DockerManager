# Docker Manager - Changelog

## Version 1.2.0 (2025-11-02)

### Added
- ✨ Environment variables support via `.env` file
- ✨ `.env.example` template file
- ✨ `ENV_VARIABLES.md` documentation
- ✨ Configurable ports and Docker API endpoint
- ✨ Better hint message when search returns no results
- ✨ Responsive grid layout improvements (xs=12, sm=6, md=4, lg=3)
- ✨ Border separator in CardActions
- ✨ Smooth animations for cards (transform + box-shadow)

### Changed
- 🔄 Updated all components for Material UI 7 compatibility
- 🔄 Replaced `InputProps` with `slotProps.input` (TextField)
- 🔄 Replaced `PaperProps` with `slotProps.paper` (Dialog)
- 🔄 Optimized all `sx` props for MUI 7 best practices
- 🔄 Improved card layout with better alignment and spacing
- 🔄 Enhanced typography with `wordBreak: 'break-word'` for long names
- 🔄 Unified icon sizes to `small`
- 🔄 Localized search placeholder to Russian
- 🔄 API address in AppBar now uses environment variables
- 🔄 API address hidden on mobile devices (sm breakpoint)
- 🔄 Toggle button labels hidden on mobile (xs breakpoint)
- 🔄 Vite config now loads environment variables
- 🔄 Server config uses environment variables

### Improved
- 💅 Better responsive design for mobile devices
- 💅 Improved card content spacing with gap utilities
- 💅 Better visual separation in cards
- 💅 Enhanced log viewer dialog layout
- 💅 More consistent component styling
- ⚡ Better rendering performance

### Documentation
- 📝 Updated README.md with environment setup instructions
- 📝 Created UPDATE_V1.2.0.md with migration guide
- 📝 Updated QUICK_START.md with .env setup
- 📝 Added comprehensive ENV_VARIABLES.md
- 📝 Updated package.json description

### Fixed
- 🐛 Card header overflow with long container names
- 🐛 Status chip shrinking in card headers
- 🐛 Inconsistent icon sizes in actions
- 🐛 Log viewer word break issues

---

## Version 1.1.0 (2025-11-01)

### Added
- ✨ List/Grid view toggle (default: list)
- ✨ Table view with sortable columns
- ✨ Pagination (30, 50, 100 items per page)
- ✨ Full-width table layout
- ✨ Search functionality for both views
- ✨ Fullscreen mode for log viewer
- ✨ ANSI color codes support in logs

### Changed
- 🔄 Default view mode changed from grid to list
- 🔄 Added ToggleButtonGroup in AppBar

---

## Version 1.0.0 (2025-10-31)

### Initial Release
- ✨ Docker container management via HTTP API
- ✨ Real-time log streaming via WebSocket
- ✨ Container actions (start, stop, restart, remove)
- ✨ Material UI dark theme
- ✨ Auto-refresh every 5 seconds
- ✨ Grid view with cards
- ✨ Responsive design

---

**Legend:**
- ✨ New feature
- 🔄 Changed/Updated
- 💅 UI/UX improvement
- ⚡ Performance improvement
- 🐛 Bug fix
- 📝 Documentation
