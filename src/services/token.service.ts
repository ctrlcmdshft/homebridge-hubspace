import axios from 'axios';
import type { API } from 'homebridge';
import { Endpoints } from '../api/endpoints';
import { TokenResponse } from '../responses/token-response';

/**
 * Service for managing JWT tokens
 */
class TokenService {
    // Proactive token refresh to maintain valid refresh token chain
    private _saveDebounceTimer?: NodeJS.Timeout;
    private _refreshTimer?: NodeJS.Timeout;
    private readonly _httpClient = axios.create({ baseURL: Endpoints.ACCOUNT_BASE_URL });

    private _accessToken?: string;
    private _accessTokenExpiration?: Date;
    private _refreshToken?: string;
    private _refreshTokenExpiration?: Date;
    private _username = '';
    private _password = '';
    private _emailOtp?: string;
    private _verboseLogging = false;
    private _authenticatingPromise?: Promise<boolean>;
    private _storage?: API;
    private _tokensRestored = false;

    /**
     * Initializes {@link TokenService}
     * @param username Account username
     * @param password Account password
     * @param storage Homebridge storage API for persisting tokens
     * @param emailOtp Optional one-time password sent via email (Hubspace only supports email 2FA)
     * @param verboseLogging Enable detailed logging for debugging
     */
    public login(username: string, password: string, storage?: API, emailOtp?: string, verboseLogging = false): void {
        this._username = username;
        this._password = password;
        this._emailOtp = emailOtp;
        this._verboseLogging = verboseLogging;
        this._storage = storage;

        // Try to restore saved tokens from storage
        this.restoreTokensFromStorage();
    }

    public async getToken(): Promise<string | undefined> {
        // Proactive refresh - maintain valid token like iOS app
        if (!this.hasValidToken()) {
            await this.authenticate();
        }

        return this._accessToken;
    }

    public hasValidToken(): boolean {
        return this._accessToken !== undefined && !this.isAccessTokenExpired();
    }

    /**
     * Logs a message if verbose logging is enabled
     */
    private logVerbose(message: string, ...args: any[]): void {
        if (this._verboseLogging) {
            // eslint-disable-next-line no-console
            console.log(message, ...args);
        }
    }

    /**
     * Schedules proactive token refresh to keep refresh token chain alive
     * Refreshes access token before it expires (while refresh token is still valid)
     */
    private scheduleTokenRefresh(): void {
        // Clear any existing timer
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
            this._refreshTimer = undefined;
        }

        if (!this._accessTokenExpiration || !this._refreshTokenExpiration) return;

        const now = new Date().getTime();
        const accessExpireTime = this._accessTokenExpiration.getTime();
        const refreshExpireTime = this._refreshTokenExpiration.getTime();

        // Refresh at 80% of token lifetime (more conservative than 5min buffer)
        const tokenLifetimeMs = accessExpireTime - now;
        const refreshAt = now + (tokenLifetimeMs * 0.8);
        const delayMs = Math.max(0, refreshAt - now);

        // Only schedule if refresh token will still be valid
        if (refreshAt < refreshExpireTime) {
            this._refreshTimer = setTimeout(async () => {
                this.logVerbose('[Hubspace TokenService] Proactively refreshing access token');
                try {
                    const tokenResponse = await this.getTokenFromRefreshToken();
                    if (tokenResponse) {
                        this.setTokens(tokenResponse, true);
                        this.logVerbose('[Hubspace TokenService] Token refreshed successfully');
                    }
                } catch (err) {
                    this.logAuthError('Proactive token refresh failed', err);
                }
            }, delayMs);

            const delayMinutes = Math.floor(delayMs / 60000);
            this.logVerbose(`[Hubspace TokenService] Scheduled token refresh in ${delayMinutes} minutes`);
        }
    }

    private async authenticate(): Promise<boolean> {
        if (this._authenticatingPromise) {
            // If already authenticating, reuse it
            return this._authenticatingPromise;
        }

        this._authenticatingPromise = (async () => {
            if (!this.isAccessTokenExpired() && !this.isRefreshTokenExpired()) return true;
            let tokenResponse: TokenResponse | undefined;
            let usedRefreshToken = false;
            
            // Log token state before attempting refresh
            this.logVerbose('[Hubspace TokenService] Token state - Access expired:', this.isAccessTokenExpired(), 
                        'Refresh expired:', this.isRefreshTokenExpired());
            
            try {
                tokenResponse = await this.getTokenFromRefreshToken();
                if (tokenResponse) {
                    usedRefreshToken = true;
                    this.logVerbose('[Hubspace TokenService] Successfully refreshed token (no new login email)');
                } else {
                    this.logVerbose('[Hubspace TokenService] Refresh token request returned no token');
                }
            } catch (err) {
                this.logAuthError('Failed to refresh token', err);
            }
            if (!tokenResponse) {
                // eslint-disable-next-line no-console
                console.warn('[Hubspace TokenService] ⚠️  Falling back to credential login - THIS WILL SEND EMAIL');
                try {
                    tokenResponse = await this.getTokenFromCredentials();
                    if (tokenResponse) {
                        this.logVerbose('[Hubspace TokenService] Authenticated with credentials');
                    }
                } catch (err) {
                    this.logAuthError('Failed to login with credentials', err);
                }
            }
            if (!tokenResponse) {
                this.logAuthError('Authentication failed: Unable to obtain valid token. Please check your credentials or re-login.');
                // Optionally, emit an event or call a callback for UI notification here
            }
            this.setTokens(tokenResponse, usedRefreshToken);
            return !!tokenResponse;
        })();

        try {
            return await this._authenticatingPromise;
        } finally {
            this._authenticatingPromise = undefined;  // clear once finished
        }
    }

    /**
     * Logs authentication errors and notifies user if needed
     */
    private logAuthError(message: string, err?: unknown): void {
        // eslint-disable-next-line no-console
        if (err) {
            console.error(`[Hubspace TokenService] ${message}:`, err);
        } else {
            console.error(`[Hubspace TokenService] ${message}`);
        }
        // TODO: Optionally, emit an event or call a Homebridge notification callback here
    }

    private async getTokenFromRefreshToken(): Promise<TokenResponse | undefined> {
        // If refresh token is expired then don't even try...
        if (this.isRefreshTokenExpired()) {
            this.logVerbose('[Hubspace TokenService] Refresh token is expired, cannot use it');
            // Clear expired tokens to force fresh login
            this.clearTokens();
            return undefined;
        }
        
        if (!this._refreshToken) {
            this.logVerbose('[Hubspace TokenService] No refresh token available');
            return undefined;
        }

        const params = new URLSearchParams();

        params.append('grant_type', 'refresh_token');
        params.append('client_id', 'hubspace_android');
        params.append('refresh_token', this._refreshToken!);

        try {
            const response = await this._httpClient.post('/protocol/openid-connect/token', params);
            return response.status === 200 ? response.data : undefined;
        } catch (error: any) {
            // Check if the error is due to inactive session or invalid grant
            if (error?.response?.data?.error === 'invalid_grant') {
                // eslint-disable-next-line no-console
                console.warn('[Hubspace TokenService] Server rejected refresh token (session inactive or token revoked)');
                // Clear invalid tokens to force fresh login
                this.clearTokens();
            } else {
                // eslint-disable-next-line no-console
                console.error('[Hubspace TokenService] Refresh token request failed:', error);
            }
            return undefined;
        }
    }

    private async getTokenFromCredentials(): Promise<TokenResponse | undefined> {
        const params = new URLSearchParams();

        params.append('grant_type', 'password');
        params.append('client_id', 'hubspace_android');
        params.append('username', this._username);
        params.append('password', this._password);
        
        // Include email OTP if provided (Hubspace only supports email-based 2FA)
        if (this._emailOtp) {
            params.append('totp', this._emailOtp);
        }

        try {
            const response = await this._httpClient.post('/protocol/openid-connect/token', params);

            return response.status === 200 ? response.data : undefined;
        } catch {
            return undefined;
        }
    }


    /**
     * Sets tokens to new values
     * @param response Response with tokens
     * @param fromRefresh Whether tokens came from refresh (vs full login)
     */
    private setTokens(response?: TokenResponse, fromRefresh = false): void {
        if (!response) {
            this.clearTokens();
            return;
        }

        this._accessToken = response.access_token;
        this._refreshToken = response.refresh_token;

        const currentDate = new Date();

        this._accessTokenExpiration = new Date(currentDate.getTime() + response.expires_in * 1000);
        this._refreshTokenExpiration = new Date(currentDate.getTime() + response.refresh_expires_in * 1000);

        // Log token expiration times for debugging
        const accessExpireMinutes = Math.floor(response.expires_in / 60);
        const refreshExpireMinutes = Math.floor(response.refresh_expires_in / 60);
        this.logVerbose(`[Hubspace TokenService] Token expiration: Access=${accessExpireMinutes}m, Refresh=${refreshExpireMinutes}m`);

        // Persist tokens to storage (debounced)
        this.saveTokensToStorage();

        // Schedule proactive refresh to maintain token chain like iOS app
        this.scheduleTokenRefresh();
    }


    /**
     * Clears stored tokens
     */
    private clearTokens(): void {
        // Clear refresh timer
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
            this._refreshTimer = undefined;
        }

        this._accessToken = undefined;
        this._refreshToken = undefined;
        this._accessTokenExpiration = undefined;
        this._refreshTokenExpiration = undefined;

        // Clear persisted tokens
        if (this._storage) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const fs = require('fs');
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const path = require('path');
                const savedTokens = this._storage.user.storagePath();
                const tokenPath = path.join(savedTokens, '..', 'hubspace-tokens.json');
                if (fs.existsSync(tokenPath)) {
                    fs.unlinkSync(tokenPath);
                }
            } catch (err) {
                // eslint-disable-next-line no-console
                console.warn('[Hubspace TokenService] Failed to clear persisted tokens:', err);
            }
        }
    }

    /**
     * Checks whether the access token is expired
     * @returns True if access token is expired otherwise false
     */
    private isAccessTokenExpired(): boolean {
        return !this._accessTokenExpiration || this._accessTokenExpiration < new Date();
    }

    /**
     * Checks whether the refresh token is expired
     * @returns True if refresh token is expired otherwise false
     */
    private isRefreshTokenExpired(): boolean {
        return !this._refreshTokenExpiration || this._refreshTokenExpiration < new Date();
    }

    /**
     * Restores tokens from persistent storage if available
     */
    private restoreTokensFromStorage(): void {
        if (!this._storage) return;

        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const fs = require('fs');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const path = require('path');
            const savedTokens = this._storage.user.storagePath();
            const tokenPath = path.join(savedTokens, '..', 'hubspace-tokens.json');

            if (fs.existsSync(tokenPath)) {
                const data = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));

                // Only restore if tokens are for the same user and not expired
                if (data.username === this._username) {
                    this._refreshToken = data.refreshToken;
                    this._refreshTokenExpiration = new Date(data.refreshTokenExpiration);
                    this._accessToken = data.accessToken;
                    this._accessTokenExpiration = new Date(data.accessTokenExpiration);

                    if (!this._tokensRestored) {
                        const refreshMinutesLeft = Math.floor((this._refreshTokenExpiration.getTime() - Date.now()) / 60000);
                        this.logVerbose(`[Hubspace TokenService] Restored tokens from storage (Refresh token valid for ${refreshMinutesLeft} more minutes)`);
                        this._tokensRestored = true;
                    }
                    // Schedule proactive refresh to keep refresh token chain alive
                    this.scheduleTokenRefresh();
                } else {
                    this.logVerbose('[Hubspace TokenService] Tokens in storage are for different user, ignoring');
                }
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('[Hubspace TokenService] Failed to restore tokens from storage:', err);
        }
    }

    /**
     * Saves tokens to persistent storage (debounced to prevent excessive writes)
     */
    private saveTokensToStorage(): void {
        if (!this._storage || !this._refreshToken) return;

        // Clear any pending save
        if (this._saveDebounceTimer) {
            clearTimeout(this._saveDebounceTimer);
        }

        // Debounce saves to prevent multiple rapid writes
        this._saveDebounceTimer = setTimeout(() => {
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const fs = require('fs');
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const path = require('path');
                const savedTokens = this._storage!.user.storagePath();
                const tokenPath = path.join(savedTokens, '..', 'hubspace-tokens.json');

                const data = {
                    username: this._username,
                    refreshToken: this._refreshToken,
                    refreshTokenExpiration: this._refreshTokenExpiration?.toISOString(),
                    accessToken: this._accessToken,
                    accessTokenExpiration: this._accessTokenExpiration?.toISOString()
                };

                fs.writeFileSync(tokenPath, JSON.stringify(data, null, 2));
                // Only log on first save after restore to reduce noise
                // Subsequent saves happen silently
            } catch (err) {
                // eslint-disable-next-line no-console
                console.warn('[Hubspace TokenService] Failed to save tokens to storage:', err);
            }
        }, 500); // Wait 500ms before saving to batch multiple rapid updates
    }

}

export const tokenService: TokenService = new TokenService();