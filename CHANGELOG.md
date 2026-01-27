# Changelog

All notable changes to this project will be documented in this file.

## [2.2.2] - 2026-01-27

### Added
- **Email 2FA Support**: Added dedicated field for email-based two-factor authentication codes
  - Hubspace sends 2FA verification codes via email when logging in with credentials
  - Enter the code received in your email to complete authentication
  - Code only needed for initial login, can be removed after successful authentication
- **Verbose Logging Toggle**: Added optional setting to control authentication and token management logging
  - When disabled (default): Only shows critical errors and important warnings
  - When enabled: Shows detailed token refresh schedules, expiration times, and session information
  - Helps reduce log noise while still providing troubleshooting capability when needed

### Changed
- Removed authenticator app OTP support (Hubspace only supports email-based 2FA)
- Reorganized configuration UI with clearer sections for account settings and advanced options
- Updated documentation to clarify email-only 2FA support and verbose logging usage

### Fixed
- Enhanced error handling for expired/invalid refresh tokens
  - Now properly clears invalid tokens when server reports "Session not active"
  - Prevents repeated authentication attempts with expired tokens
  - Provides clearer feedback when re-authentication is required

## [2.2.1] - 2026-01-26

### Fixed
- Fixed token refresh chain not being maintained after restoring tokens from storage
  - Now schedules proactive token refresh when restoring saved tokens on Homebridge restart
  - Prevents refresh token expiration during Homebridge downtime (no more login notification emails)
- Enhanced token refresh logging to diagnose authentication failures
  - Added detailed logging for token state (expired vs valid)
  - Shows why credential fallback is triggered (missing token, expired token, API failure)
  - Logs refresh token validity duration when restoring from storage
  - Warns when falling back to credential login (which triggers email notifications)

## [2.2.0] - 2026-01-26

### Added
- **Proactive token refresh**: Implemented automatic token refresh at 80% of token lifetime to maintain valid refresh token chain indefinitely
  - Prevents token expiration during periods of inactivity (no more login emails after 3+ hours of no device usage)
  - Maintains continuous refresh token chain like iOS app and Home Assistant integration
  - Schedules refresh automatically based on token expiration times
  - Logs token expiration details (access and refresh token lifetimes in minutes)
- **2FA/MFA Support**: Added optional One-Time Password (OTP) field for accounts with two-factor authentication enabled
  - OTP only required for initial login with credentials
  - Token refresh works without OTP, maintaining seamless background authentication
  - Optional configuration field - leave blank if 2FA is not enabled

### Changed
- Token refresh strategy now uses proactive scheduling instead of on-demand refresh
- Improved token expiration logging to show both access and refresh token lifetimes
- Enhanced authentication flow to support optional TOTP parameter

### Fixed
- Fixed issue where refresh tokens would expire after 3 hours of inactivity, causing repeated login emails
- Removed GitHub Actions auto-trigger on release events (now manual-only via workflow_dispatch)
- Simplified npm publishing workflow by removing unnecessary NPM_TOKEN authentication

## [2.1.3] - 2026-01-26

### Fixed
- Updated GitHub Actions workflow to properly handle both release events and manual triggers
- Fixed npm authentication token reference in publishing workflow

## [2.1.2] - 2026-01-26

### Fixed
- Publish to npm registry (resolving publishing issues)

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
