const { HomebridgePluginUiServer } = require('@homebridge/plugin-ui-utils');
const axios = require('axios');

/**
 * Custom UI server for interactive 2FA authentication
 * This creates a web interface accessible from Homebridge Config UI X
 */
class PluginUiServer extends HomebridgePluginUiServer {
        // Compatibility: get plugin config regardless of Homebridge UI version
        async getConfigCompat() {
            if (typeof this.getPluginConfig === 'function') {
                return await this.getPluginConfig();
            }
            // fallback for older plugin-ui-utils
            return await this.request('/getConfig');
        }
    constructor() {
        super();

        // Handler for initial login with username/password
        this.onRequest('/login', this.handleLogin.bind(this));

        // Handler for OTP verification
        this.onRequest('/verify-otp', this.handleVerifyOtp.bind(this));

        // Handler to get current auth status
        this.onRequest('/auth-status', this.handleAuthStatus.bind(this));

        this.ready();
    }

    /**
   * Handle initial login attempt
   * This will trigger the email OTP to be sent
   */
    async handleLogin(payload) {
        const { username, password } = payload;

        if (!username || !password) {
            throw new Error('Username and password are required');
        }

        try {
            // Attempt to authenticate
            const params = new URLSearchParams();
            params.append('grant_type', 'password');
            params.append('client_id', 'hubspace_android');
            params.append('username', username);
            params.append('password', password);

            const response = await axios.post(
                'https://accounts.hubspaceconnect.com/auth/realms/thd/protocol/openid-connect/token',
                params
            );

            if (response.status === 200) {
                // Success - no 2FA required
                const currentConfig = await this.getConfigCompat();
                const pluginConfig = Array.isArray(currentConfig) && currentConfig.length > 0
                    ? currentConfig[0]
                    : { platform: 'Hubspace' };

                pluginConfig.username = username;
                pluginConfig.password = password;
                // Clear any old OTP
                delete pluginConfig.emailOtp;

                await this.updatePluginConfig([pluginConfig]);

                return {
                    success: true,
                    requires2FA: false,
                    message: 'Login successful! No 2FA required.',
                    tokens: {
                        accessToken: response.data.access_token,
                        refreshToken: response.data.refresh_token
                    }
                };
            }
        } catch (error) {
            // Check if it's a 2FA requirement
            if (error.response?.status === 401) {
                const errorData = error.response?.data;

                // If error indicates 2FA is required
                if (errorData?.error === 'invalid_grant' &&
            errorData?.error_description?.includes('OTP')) {
                    return {
                        success: false,
                        requires2FA: true,
                        message: 'Please check your email for the verification code sent by Hubspace.',
                        username: username,
                        password: password
                    };
                }

                throw new Error('Invalid username or password');
            }

            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    /**
   * Handle OTP verification after user receives email
   */
    async handleVerifyOtp(payload) {
        const { username, password, otp } = payload;

        if (!username || !password || !otp) {
            throw new Error('Username, password, and OTP are required');
        }

        try {
            const params = new URLSearchParams();
            params.append('grant_type', 'password');
            params.append('client_id', 'hubspace_android');
            params.append('username', username);
            params.append('password', password);
            params.append('totp', otp);

            const response = await axios.post(
                'https://accounts.hubspaceconnect.com/auth/realms/thd/protocol/openid-connect/token',
                params
            );

            if (response.status === 200) {
                // Update config with credentials (but not OTP - we don't need to store it)
                const currentConfig = await this.getConfigCompat();
                const pluginConfig = Array.isArray(currentConfig) && currentConfig.length > 0
                    ? currentConfig[0]
                    : { platform: 'Hubspace' };

                pluginConfig.username = username;
                pluginConfig.password = password;
                // Don't store OTP - tokens will be saved by the plugin
                delete pluginConfig.emailOtp;

                await this.updatePluginConfig([pluginConfig]);

                return {
                    success: true,
                    message: 'Authentication successful! You can now close this window. Homebridge will restart automatically.',
                    tokens: {
                        accessToken: response.data.access_token,
                        refreshToken: response.data.refresh_token
                    }
                };
            }
        } catch (error) {
            if (error.response?.status === 401) {
                throw new Error('Invalid verification code. Please try again.');
            }

            throw new Error(`Verification failed: ${error.message}`);
        }
    }

    /**
   * Get current authentication status
   */
    async handleAuthStatus() {
        const currentConfig = await this.getConfigCompat();
        const pluginConfig = Array.isArray(currentConfig) && currentConfig.length > 0
            ? currentConfig[0]
            : { platform: 'Hubspace' };

        return {
            configured: !!(pluginConfig.username && pluginConfig.password),
            username: pluginConfig.username || ''
        };
    }
}

// Start the UI server
(() => {
    return new PluginUiServer();
})();
