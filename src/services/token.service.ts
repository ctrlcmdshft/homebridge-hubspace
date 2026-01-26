import axios from 'axios';
import type { API } from 'homebridge';
import { Endpoints } from '../api/endpoints';
import { TokenResponse } from '../responses/token-response';

/**
 * Service for managing JWT tokens
 */
class TokenService {
    public loginBuffer = 60;
    private _refreshInterval?: NodeJS.Timeout;
    private _saveDebounceTimer?: NodeJS.Timeout;
    private readonly _httpClient = axios.create({ baseURL: Endpoints.ACCOUNT_BASE_URL });

    private _accessToken?: string;
    private _accessTokenExpiration?: Date;
    private _refreshToken?: string;
    private _refreshTokenExpiration?: Date;
    private _username = '';
    private _password = '';
    private _authenticatingPromise?: Promise<boolean>;
    private _storage?: API;
    private _tokensRestored = false;

    /**
     * Initializes {@link TokenService}
     * @param username Account username
     * @param password Account password
     * @param storage Homebridge storage API for persisting tokens
     */
    public login(username: string, password: string, storage?: API): void {
        this._username = username;
        this._password = password;
        this._storage = storage;

        // Try to restore saved tokens from storage
        this.restoreTokensFromStorage();
    }

    public async getToken(): Promise<string | undefined> {
        if (!this.hasValidToken()) {
            await this.authenticate();  // will deduplicate automatically now
        }

        return this._accessToken;
    }

    public hasValidToken(): boolean {
        return this._accessToken !== undefined && !this.isAccessTokenExpired();
    }

    private startAutoRefresh(): void {
        if (this._refreshInterval) {
            clearInterval(this._refreshInterval);
        }

        this._refreshInterval = setInterval(async () => {
            const bufferTime = this.loginBuffer * 1000; // minutes before expiration
            const now = new Date().getTime();
            const exp = this._refreshTokenExpiration?.getTime() ?? 0;

            if (exp - now < bufferTime) {
                await this.authenticate();
            }
        }, 30 * 1000); // check every 30 seconds
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
            try {
                tokenResponse = await this.getTokenFromRefreshToken();
                if (tokenResponse) {
                    usedRefreshToken = true;
                    // eslint-disable-next-line no-console
                    console.log('[Hubspace TokenService] Token refreshed successfully');
                }
            } catch (err) {
                this.logAuthError('Failed to refresh token', err);
            }
            if (!tokenResponse) {
                try {
                    tokenResponse = await this.getTokenFromCredentials();
                    if (tokenResponse) {
                        // eslint-disable-next-line no-console
                        console.log('[Hubspace TokenService] Authenticated with credentials');
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
        if (this.isRefreshTokenExpired()) return undefined;

        const params = new URLSearchParams();

        params.append('grant_type', 'refresh_token');
        params.append('client_id', 'hubspace_android');
        params.append('refresh_token', this._refreshToken!);

        try {
            const response = await this._httpClient.post('/protocol/openid-connect/token', params);
            return response.status === 200 ? response.data : undefined;
        } catch {
            return undefined;
        }
    }

    private async getTokenFromCredentials(): Promise<TokenResponse | undefined> {
        const params = new URLSearchParams();

        params.append('grant_type', 'password');
        params.append('client_id', 'hubspace_android');
        params.append('username', this._username);
        params.append('password', this._password);

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

        this.startAutoRefresh();

        // Persist tokens to storage (debounced)
        this.saveTokensToStorage();
    }


    /**
     * Clears stored tokens
     */
    private clearTokens(): void {
        this._accessToken = undefined;
        this._refreshToken = undefined;
        this._accessTokenExpiration = undefined;
        this._refreshTokenExpiration = undefined;

        if (this._refreshInterval) {
            clearInterval(this._refreshInterval);
            this._refreshInterval = undefined;
        }

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
                        // eslint-disable-next-line no-console
                        console.log('[Hubspace TokenService] Restored tokens from storage');
                        this._tokensRestored = true;
                    }

                    // Start auto-refresh if we have valid tokens
                    if (!this.isRefreshTokenExpired()) {
                        this.startAutoRefresh();
                    }
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