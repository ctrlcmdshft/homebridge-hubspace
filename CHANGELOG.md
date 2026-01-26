# Changelog

All notable changes to this project will be documented in this file.

## [2.1.1] - 2026-01-26

### Fixed
- Republish to npm registry (v2.1.0 publish was incomplete)

## [2.1.0] - 2026-01-26

### Changed
- **Token refresh strategy overhaul**: Completely redesigned token management to match aioafero (Home Assistant integration) approach
  - Removed background polling timer that was checking tokens every 30 seconds
  - Implemented pure on-demand token refresh - tokens only refresh when actually needed during API calls
  - Eliminated "Token refreshed successfully" log spam that appeared frequently
  - Token validation now happens lazily only when `getToken()` is called
  - More efficient and matches the proven aioafero pattern used by Home Assistant

### Removed
- Removed `loginBuffer` configuration (no longer needed with on-demand refresh)
- Removed background auto-refresh interval checking
- Removed preemptive token refresh logic

## [2.0.3] - 2026-01-26

### Changed
- **Improved token service logging**: Significantly reduced log verbosity to prevent cluttered logs
  - Token save operations are now debounced (500ms) to prevent multiple rapid writes
  - "Restored tokens from storage" message now only appears once on startup
  - Removed repetitive "Saved tokens to storage" messages
  - Added meaningful authentication event logs: "Token refreshed successfully" and "Authenticated with credentials"

### Fixed
- Fixed excessive token persistence logging that caused "Saved tokens to storage" to appear multiple times in quick succession
- Improved token save performance by batching multiple rapid updates into a single write operation

## [2.0.2] - Previous Release
- Previous functionality (details not documented)
