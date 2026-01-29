<p align="center">
  <img src="https://raw.githubusercontent.com/homebridge/branding/latest/logos/homebridge-wordmark-logo-vertical.png" height="150"/>
</p>

<span align="center">
  
  # Homebridge Hubspace
  
  <a href="https://www.npmjs.com/homebridge-hubspace">
    <img src="https://img.shields.io/npm/v/homebridge-hubspace.svg?logo=npm&logoColor=fff&label=NPM+package&color=limegreen" alt="Hubspace for Homebridge on npm" />
  </a>
  
  <a href="https://github.com/homebridge/homebridge/wiki/Verified-Plugins">
    <img title="Verified by Homebridge" src="https://badgen.net/badge/homebridge/verified/purple"/>
  </a>
  
</span>

# About plugin
Homebridge Hubspace is a plugin that integrates Hubspace devices (sold at Home Depot) with Apple HomeKit. Control your smart ceiling fans, plugs, lights, and other Hubspace accessories directly from the Home app.

# Disclaimer
I do not own any rights to Hubspace. Any work published here is solely for my own convenience. I am not making any guarantees about the code or products referenced here.

# Tested products
Below you can find a table of products that have been tested with this plugin. Some products share similarities among one another (e.g. lights), however, that does not guarantee that they will all work.

Not all features for all products are implemented. Please see the functions below of what is implemented. If you need a feature that is not implemented create an issue for it.

| Product | Functions supported |
| --- | --- |
| [Universal Smart Wi-Fi 4-Speed Ceiling Fan](https://www.homedepot.com/p/Hampton-Bay-Universal-Smart-Wi-Fi-4-Speed-Ceiling-Fan-White-Remote-Control-For-Use-Only-With-AC-Motor-Fans-Powered-by-Hubspace-76278/315169181?) | <ul><li>Light on/off</li><li>Fan on/off</li><li>Light brightness</li><li>Fan speed</li></ul> |
| [Defiant Smart Plug](https://www.homedepot.com/p/Defiant-15-Amp-120-Volt-Smart-Wi-Fi-Bluetooth-Plug-with-1-Outlet-Powered-by-Hubspace-HPPA11AWB/315636834) | <ul><li>Power on/off</li></ul> |

# Configuration

## Authentication Options

You have **two ways** to authenticate with Hubspace:

### Option 1: Interactive Login Wizard (Recommended) 🎯

The easiest way! Click the **"Setup Account"** button in the plugin settings to launch an interactive authentication wizard that:
- Guides you through the login process step-by-step
- Handles 2FA codes automatically
- Provides real-time validation and clear error messages
- No need to edit config files manually

**[→ See detailed interactive auth guide](./AUTHENTICATION.md#option-1-interactive-login-wizard-recommended-)**

### Option 2: Manual Configuration 📝

Prefer editing config files? You can manually configure your credentials:

## Basic Setup
Enter your Hubspace username and password in the plugin settings through the Homebridge UI.

**[→ See manual configuration guide](./AUTHENTICATION.md#option-2-manual-configuration-)**

## Two-Factor Authentication (2FA)
Hubspace only supports email-based two-factor authentication. When you login with your credentials, Hubspace will send a verification code to your email address.

### Using the Interactive Wizard (Easy)
1. Click "Setup Account" in plugin settings
2. Enter username and password
3. Check your email for the code
4. Enter the code in the wizard
5. Done! ✅

### Manual 2FA Setup
1. Configure your username and password in the plugin settings
2. Save the config and restart Homebridge
3. Check your email for the 2FA code sent by Hubspace
4. Enter the code in the **Email 2FA Code** field in the plugin settings
5. Save and restart Homebridge again
6. Once authenticated successfully, you can remove the code from the settings

**Note:** Email codes are sent whenever you login with credentials (not when refreshing tokens). The plugin automatically uses saved tokens to avoid sending emails on every restart, keeping your inbox cleaner.

**[→ Full authentication documentation](./AUTHENTICATION.md)**

## Advanced Settings

### Verbose Logging
Enable **Verbose Logging** to see detailed information about token management and authentication processes. This is useful for troubleshooting but will create more log output.

When verbose logging is disabled, you'll only see important messages like:
- Authentication failures
- Email notification warnings (when falling back to credential login)
- Critical errors

When enabled, you'll also see:
- Token refresh schedules and operations
- Token expiration times
- Storage operations
- Session state information

# Development
There is no official documentation for Hubspace products. Under the hood they use Afero cloud as the mechanism that controls the products. Any functionality here is gained by experimenting with various functions of the devices. Afero provides simple explanation of [their APIs](https://developer.afero.io/API-DeviceEndpoints), however, this is in no way comprehensive.

If you find that a product does not work as intended, or you want to request a new product, please create a ticket for it in the issues section. You are always more than welcome to create a PR with any fixes or additions to the plugin.

## Guidelines

Any code you submit must be readable, be properly commented where necessary, and follow some common sense code quality.

This is a TypeScript project, therefore, TypeScript naming conventions must be followed, unless otherwise specified. Some basic naming conventions are below.

1. Use PascalCase for type names.
1. Do not use I as a prefix for interface names.
1. Use PascalCase for enum values.
1. Use camelCase for function names.
1. Use camelCase for property names and local variables.
1. Use _ as a prefix for private fields.
1. Use whole words in names when possible. Only use abbreviations where their use is common and obvious.

Any ESLint issues need to be resolved before code can be merged. To check for production build linter issues you can run `npm run prepublishOnly`.

## Adding new features
To add new features to the do the following:
1. Create an issue for the feature (unless there is an issue already)
1. Assign the issue to yourself
1. Create a new branch for the issue and name is as _{issue number}-{issue description}_ (e.g. 6-add-laser-support)
1. Once ready issue a PR that is linked to the issue

## Development authentication
Hubspace platform uses [Keycloak](https://www.keycloak.org) for authentication. To develop new features you will need to request JWT from Keycloak to authenticate your requests against the platform.

To get the token send HTTP request with `x-www-form-urlencoded` body to the URL below.
```
POST https://accounts.hubspaceconnect.com/auth/realms/thd/protocol/openid-connect/token
```

Your payload should include the following fields.

| Key | Value |
| --- | --- |
| grant_type | password |
| client_id | hubspace_android |
| username | YOUR_USERNAME |
| password | YOUR_PASSWORD |

Once you receive the token you can make request to Afero with it to investigate the devices and commands.