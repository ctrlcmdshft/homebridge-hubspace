# Interactive Authentication Guide

This plugin now supports **two ways** to authenticate with Hubspace:

## Option 1: Interactive Login Wizard (Recommended) 🎯

The easiest way to set up your Hubspace account with full 2FA support.

### Steps:

1. **Open Homebridge Config UI**
   - Navigate to the Hubspace plugin settings
   - Look for the "Configure Authentication" button or link

2. **Click "Setup Account"**
   - This opens the interactive authentication wizard
   - The wizard is a dedicated page for authentication

3. **Enter Your Credentials**
   - Username/Email
   - Password
   - Click "Continue"

4. **If you have 2FA enabled:**
   - Check your email for the verification code from Hubspace
   - Enter the 6-digit code
   - Click "Verify & Complete Setup"

5. **Done!**
   - Your credentials are saved
   - Homebridge automatically restarts
   - The plugin uses saved tokens for future authentication

### Benefits:
- ✅ Step-by-step guided process
- ✅ Real-time validation
- ✅ Clear error messages
- ✅ No need to manually enter codes in config files
- ✅ Automatic restart after successful auth

---

## Option 2: Manual Configuration 📝

If you prefer editing config files directly.

### Steps:

1. **Edit your Homebridge config:**

```json
{
  "platforms": [
    {
      "platform": "Hubspace",
      "name": "Hubspace",
      "username": "your-email@example.com",
      "password": "your-password"
    }
  ]
}
```

2. **Restart Homebridge**

3. **If you have 2FA enabled:**
   - Check your email for the verification code
   - Edit the config and add the `emailOtp` field:

```json
{
  "platforms": [
    {
      "platform": "Hubspace",
      "name": "Hubspace",
      "username": "your-email@example.com",
      "password": "your-password",
      "emailOtp": "123456"
    }
  ]
}
```

4. **Restart Homebridge again**

5. **Once authenticated:**
   - Remove the `emailOtp` field from your config
   - The plugin saves tokens and won't need it again

### Manual Config Benefits:
- ✅ Works without the Config UI
- ✅ Scriptable/automatable
- ✅ Good for advanced users

---

## How Token Management Works 🔐

The plugin intelligently manages authentication tokens to minimize disruption:

### Automatic Token Refresh
- Tokens are saved to Homebridge storage
- Access tokens refresh automatically before expiration
- Refresh tokens are maintained to keep your session alive
- **Email codes are only sent when logging in fresh** (not on token refresh)

### Token Lifecycle

```
Initial Login (sends email) ──> Save Tokens ──> Use Access Token
                                      │
                                      ▼
                         Access Token Expires?
                                      │
                                      ├─> Refresh Token Valid?
                                      │         │
                                      │         ├─> Yes: Refresh (no email) ──┐
                                      │         └─> No: Fresh Login (sends email)
                                      │                                        │
                                      └────────────────────────────────────────┘
```

### Why This Matters
- 🎯 **Fewer emails**: You only get verification emails when absolutely necessary
- 🔄 **Seamless restarts**: Homebridge restarts don't require re-authentication
- ⚡ **Faster startup**: Uses saved tokens instead of full login flow
- 🛡️ **Secure**: Tokens expire and refresh automatically

---

## Troubleshooting 🔧

### "Invalid username or password"
- Double-check your credentials
- Try logging in to the Hubspace mobile app to verify

### "Invalid verification code"
- Make sure you're using the latest code from your email
- Codes typically expire after a few minutes
- Request a new code by trying to log in again

### "Authentication failed: Unable to obtain valid token"
- Check your internet connection
- Verify Hubspace services are operational
- Enable verbose logging to see detailed error messages

### Email not arriving
- Check spam/junk folders
- Verify your email address is correct
- Try logging in to Hubspace mobile app to confirm 2FA is set up

### Plugin keeps sending emails on restart
- This means tokens aren't being saved properly
- Enable verbose logging to see token storage operations
- Check Homebridge has write permissions to its storage directory
- Ensure `emailOtp` is removed from config after first successful auth

---

## Advanced: Verbose Logging 🔍

Enable detailed logging to troubleshoot authentication issues:

```json
{
  "platforms": [
    {
      "platform": "Hubspace",
      "name": "Hubspace",
      "username": "your-email@example.com",
      "password": "your-password",
      "verboseLogging": true
    }
  ]
}
```

**What you'll see with verbose logging:**
- Token expiration times
- Token refresh schedules
- Storage save/restore operations
- Authentication flow details

**When to use it:**
- Troubleshooting authentication issues
- Understanding when emails will be sent
- Debugging token refresh problems
- Investigating unexpected re-authentication

**When to disable it:**
- Normal operation (creates a lot of logs)
- Once everything is working smoothly

---

## Security Notes 🔒

### Token Storage
- Tokens are stored in Homebridge's secure storage
- Access tokens expire in ~1 hour (automatically refreshed)
- Refresh tokens expire in ~30 days (requires fresh login)

### Best Practices
1. **Don't share tokens** - They provide full access to your account
2. **Remove emailOtp from config** - Once authenticated, you don't need it
3. **Use strong passwords** - Protect your Hubspace account
4. **Monitor email** - Watch for unexpected verification codes (could indicate unauthorized access)

### When Tokens Are Cleared
- Manual logout (clearing Homebridge cache)
- Refresh token expiration
- Server-side token revocation (security event)
- Changing your Hubspace password

---

## FAQ ❓

**Q: Do I need to enter the email code every time Homebridge restarts?**  
A: No! Only when logging in for the first time or when tokens have expired (typically after 30 days).

**Q: Can I use the mobile app and Homebridge at the same time?**  
A: Yes! Each device maintains its own authentication session.

**Q: What happens if I change my Hubspace password?**  
A: You'll need to update your config with the new password and re-authenticate (which may send a new email code).

**Q: Can I disable 2FA for Homebridge?**  
A: 2FA is controlled by your Hubspace account settings, not by Homebridge. If your account has 2FA enabled, you'll need to use it for all logins.

**Q: Is the interactive wizard required?**  
A: No, it's optional. You can always use manual config if you prefer.

---

## Need Help? 🆘

If you're still having issues:

1. **Enable verbose logging** and check the logs
2. **Try the interactive wizard** - it provides better error messages
3. **Check the GitHub issues** - your issue might already be reported
4. **Create a new issue** with:
   - Your Homebridge version
   - Plugin version
   - Sanitized logs (remove sensitive info!)
   - Steps to reproduce the problem
