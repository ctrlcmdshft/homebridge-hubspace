# Changelog

All notable changes to this project will be documented in this file.

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
