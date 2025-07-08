# Webflow Integration Setup Guide

This comprehensive guide explains how to set up Webflow integration for the Content Chat feature, supporting both OAuth 2.0 and Personal Access Token authentication methods.

## Overview

The Webflow integration enables Content Chat to:
- Sync content from your Webflow CMS collections
- Search and analyze your content with AI
- Bulk edit and manage card references
- Automatically sync content changes
- Provide real-time content search and updates

### Authentication Methods Supported

1. **OAuth 2.0 (Recommended)** - Secure, user-authorized access with automatic token refresh
2. **Personal Access Token** - Simple setup for personal/internal use cases

## Prerequisites

- A Webflow account with access to sites you want to sync
- **For OAuth**: Admin access to your Webflow workspace (for OAuth app creation)
- **For Personal Tokens**: Site-level access permissions
- The Interlink application deployed to a public URL
- Understanding of your Webflow site structure and CMS collections

## Method 1: OAuth 2.0 Setup (Recommended)

### Step 1: Create Webflow OAuth App

1. Go to [Webflow Developer Settings](https://webflow.com/developers/account)
2. Click "Create App" or "New App"
3. Fill in the app details:
   - **App Name**: `Interlink Content Chat`
   - **Description**: `AI-powered content management and card reference system`
   - **App Type**: `OAuth App`
   - **Redirect URI**: `https://your-domain.vercel.app/api/webflow/callback`
   - **Scopes**: Select the following required scopes:
     - `sites:read` - Read access to your Webflow sites
     - `cms:read` - Read access to CMS collections and items
     - `cms:write` - Write access for content updates (optional, for future features)

4. Click "Create App"
5. Copy the **Client ID** and **Client Secret** from the app settings

Add the following environment variables to your deployment (Vercel, Railway, etc.):

```env
# Webflow OAuth Configuration
WEBFLOW_CLIENT_ID=your_webflow_client_id
WEBFLOW_CLIENT_SECRET=your_webflow_client_secret
WEBFLOW_REDIRECT_URI=https://your-domain.vercel.app/api/webflow/callback

# Encryption Key (generate a 256-bit key for token security)
ENCRYPTION_KEY=your_256_bit_encryption_key_here

# Security Configuration (Optional but Recommended)
OAUTH_STATE_SECRET=your_random_state_secret_for_csrf_protection
```

### Generating an Encryption Key

You can generate a secure encryption key using Node.js:

```javascript
// Run this in a Node.js console or script
const crypto = require('crypto');
console.log(crypto.randomBytes(32).toString('hex'));
```

Or use an online tool like [GRC's Password Generator](https://www.grc.com/passwords.htm) to generate a 64-character hexadecimal string.

### Step 3: Update Redirect URI for Different Environments

### Development
```env
WEBFLOW_REDIRECT_URI=http://localhost:3000/api/webflow/callback
```

### Production
```env
WEBFLOW_REDIRECT_URI=https://your-domain.vercel.app/api/webflow/callback
```

**Important**: Make sure to update the redirect URI in your Webflow app settings to match your environment.

### Step 4: Test the OAuth Integration

1. Deploy your application with the new environment variables
2. Navigate to the dashboard and look for the Webflow connection section in the sidebar
3. Click "Connect to Webflow" to initiate the OAuth flow
4. Authorize the application in Webflow
5. You should be redirected back to your application with a successful connection

### Step 5: Content Sync

Once connected, content sync will begin automatically:

1. The system will fetch all CMS collections from your connected sites
2. Content will be processed and chunked for AI search
3. Embeddings will be generated for semantic search capabilities
4. You can now use Content Chat to search and analyze your content

---

## Method 2: Personal Access Token Setup (Alternative)

For simpler setups or personal use, you can use a Personal Access Token instead of OAuth. This method is quicker to set up but requires manual token management.

### Step 1: Generate a Personal Access Token

1. Go to your [Webflow Account Settings](https://webflow.com/dashboard/account/general)
2. Navigate to the **API Access** section
3. Click **Generate new token**
4. Name your token: `Interlink Content Chat`
5. Select the required scopes:
   - `Read sites` - Access to site information
   - `Read CMS` - Access to CMS collections and items
   - `Write CMS` - Content modification capabilities (optional)
6. Copy the generated token immediately (it won't be shown again)

### Step 2: Configure Personal Token Environment

Add this environment variable instead of the OAuth variables:

```env
# Webflow Personal Access Token Configuration
WEBFLOW_PERSONAL_TOKEN=your_personal_access_token_here

# Keep the encryption key for secure storage
ENCRYPTION_KEY=your_256_bit_encryption_key_here
```

### Step 3: Test Personal Token Integration

1. Deploy your application with the personal token
2. The system will automatically use the personal token for API requests
3. Navigate to the Content Chat dashboard to verify connection
4. Check that your sites and collections are accessible

**Note**: Personal tokens don't expire automatically but can be revoked from your Webflow account settings.

---

## Site and Collection Selection Guide

### Choosing the Right Sites

When setting up your Webflow integration, consider these factors:

1. **Content Volume**: Start with sites that have moderate content volumes (10-1000 CMS items)
2. **Update Frequency**: Prioritize sites with content that changes regularly
3. **Collection Structure**: Sites with well-organized CMS collections work best
4. **Content Types**: Focus on text-heavy content (blog posts, articles, documentation)

### Optimizing Collection Selection

**Recommended Collections**:
- Blog posts and articles
- Knowledge base entries
- Product descriptions (if text-heavy)
- FAQ collections

**Collections to Avoid Initially**:
- Large image galleries
- Media-only collections
- Form submission collections
- Auto-generated collections

**Best Practices**:
- Test with one collection first, then expand
- Ensure collections have meaningful text content
- Verify proper slug and URL configurations
- Check that content is published (not draft)

---

## Rate Limits and Performance

### Webflow API Limits

Webflow enforces the following rate limits:

```
Standard Rate Limit: 60 requests per minute per API key
```

**Headers to Monitor**:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window  
- `Retry-After`: Seconds to wait when rate limited

### Performance Optimization

**Content Sync Performance**:
- Initial sync: 1-5 minutes for typical sites (100-500 items)
- Incremental sync: 30-60 seconds for changed content
- Large sites (1000+ items): 10-15 minutes initial sync

**Optimization Strategies**:
- Sync during off-peak hours for large sites
- Use incremental sync for regular updates
- Monitor API quota usage in dashboard
- Implement content deduplication (automatic)

**Expected Processing Times**:
```
Collection fetch: 10-30 seconds per collection
Content processing: 1-2 seconds per item
Embedding generation: 2-5 seconds per chunk
Total for 100 items: 3-8 minutes
```

---

## Troubleshooting

### OAuth Connection Issues

**Problem**: "Webflow configuration incomplete" error
- **Solution**: Verify all environment variables are set correctly
- Check that `WEBFLOW_CLIENT_ID`, `WEBFLOW_CLIENT_SECRET`, and `WEBFLOW_REDIRECT_URI` are all configured
- Ensure encryption key is properly generated and set

**Problem**: OAuth redirect fails or "Invalid redirect URI"
- **Solution**: Ensure the redirect URI in your Webflow app settings exactly matches your `WEBFLOW_REDIRECT_URI` environment variable
- Check that your domain is accessible (not localhost for production)
- Verify HTTPS is enabled for production domains
- Ensure no trailing slashes in redirect URIs

**Problem**: "Invalid client" or "Authentication failed" error
- **Solution**: Double-check your Client ID and Client Secret (copy-paste to avoid typos)
- Ensure your Webflow app has the correct scopes enabled
- Verify the app is in "Published" status in Webflow Developer Settings
- Check that OAuth app hasn't been deleted or disabled

**Problem**: "State does not match" security error
- **Solution**: This indicates a CSRF protection issue
- Clear browser cookies and try again
- Ensure `OAUTH_STATE_SECRET` is consistently set across deployments
- Verify no browser extensions are interfering with redirects

### Personal Access Token Issues

**Problem**: "Invalid token" or "Unauthorized" error with personal tokens
- **Solution**: Verify the token was copied correctly without extra spaces
- Check that the token hasn't been revoked in Webflow settings
- Ensure the token has the required scopes selected
- Generate a new token if the current one isn't working

**Problem**: Personal token works but limited functionality
- **Solution**: Check which scopes were selected during token creation
- Regenerate token with additional scopes if needed
- Verify workspace permissions for the account that created the token

### Token Refresh and Expiration Issues

**Problem**: OAuth connection shows as expired
- **Solution**: The system automatically attempts to refresh tokens using the refresh token
- If refresh fails, users need to reconnect their Webflow account through the dashboard
- Check that `ENCRYPTION_KEY` hasn't changed (this would invalidate stored tokens)

**Problem**: Frequent token refresh failures
- **Solution**: Verify that `WEBFLOW_CLIENT_SECRET` is correct
- Ensure system clock is synchronized (token timing is important)
- Check network connectivity to Webflow APIs
- Review application logs for specific refresh error messages

**Problem**: "Insufficient permissions" or scope errors
- **Solution**: Check that your Webflow app has the required scopes (`sites:read`, `cms:read`, `cms:write`)
- The user connecting must have appropriate permissions in their Webflow workspace
- For agency accounts, ensure proper client site permissions are granted

### Content Sync Issues

**Problem**: No content appears in Content Chat after connection
- **Solution**: Check the Content Chat dashboard to see if sites and collections are detected
- Verify that your Webflow sites have CMS collections with published content
- Check the application logs for sync errors
- Ensure collections contain meaningful text content (not just images/media)
- Try manually triggering a sync from the dashboard

**Problem**: Content sync fails with rate limit errors
- **Solution**: Webflow API enforces 60 requests/minute limit
- The system includes automatic retry logic with exponential backoff
- For large sites, initial sync may take 10-15 minutes due to rate limiting
- Monitor sync progress and avoid multiple simultaneous sync operations

**Problem**: Content sync is slow or times out
- **Solution**: Large sites with many collections may take time to sync initially
- Subsequent syncs will be incremental and faster
- Monitor the sync progress in the Webflow settings panel
- Consider syncing during off-peak hours for very large sites (1000+ items)
- Check network connectivity and server performance

**Problem**: Some collections or items missing after sync
- **Solution**: Verify items are published (not draft status) in Webflow
- Check that collection has proper read permissions
- Review item-level permissions in Webflow
- Ensure items have required fields populated (title, content)
- Check for API errors in application logs during sync

### Rate Limiting and API Issues

**Problem**: "Too Many Requests" (429) errors
- **Solution**: This is expected behavior with Webflow's 60 req/min limit
- The system automatically handles retries with proper backoff
- Monitor the `X-RateLimit-Remaining` header in dashboard logs
- Reduce concurrent operations if errors persist
- For development, consider using test sites with fewer items

**Problem**: API calls failing with 5xx server errors
- **Solution**: These indicate Webflow API issues (temporary)
- The system includes automatic retry logic for transient failures
- Check [Webflow Status Page](https://status.webflow.com) for known issues
- Wait and retry - most 5xx errors resolve automatically
- Contact Webflow support if errors persist beyond 1 hour

## Security Considerations

### OAuth Security Best Practices

1. **CSRF Protection**: The OAuth flow includes state parameter validation to prevent Cross-Site Request Forgery attacks
   - Set `OAUTH_STATE_SECRET` environment variable for additional security
   - State parameters are automatically generated and validated
   - Never ignore "state does not match" errors

2. **Secure Token Storage**: 
   - OAuth tokens are encrypted using AES-256-GCM before database storage
   - Refresh tokens are encrypted separately from access tokens
   - Encryption keys should be 256-bit randomly generated values
   - Store `ENCRYPTION_KEY` securely and never commit to version control

3. **Scope Limitation**: 
   - Only request the minimum required Webflow scopes for your use case
   - Start with `sites:read` and `cms:read` - add `cms:write` only if needed
   - Regularly audit granted permissions in Webflow Developer Settings
   - Users can revoke access at any time from their Webflow account

4. **Network Security**:
   - Always use HTTPS for redirect URIs in production
   - Ensure SSL/TLS certificates are valid and current
   - Use secure headers (HSTS, CSP) in your application
   - Validate all redirect URIs match exactly (no trailing slashes)

### Environment Security

5. **Environment Variables**: 
   - Keep your Client Secret secure and never commit it to version control
   - Use different OAuth apps for development/staging/production
   - Rotate secrets regularly (quarterly recommended)
   - Use your platform's secret management (Vercel Environment Variables, etc.)

6. **User Isolation**: 
   - All content and connections are scoped to individual users
   - Database queries include user ID filtering to prevent data leakage
   - OAuth tokens are tied to specific user accounts
   - Automatic cleanup of user data on account deletion

### Access Control

7. **Token Management**:
   - Tokens automatically expire and refresh (OAuth) or can be manually revoked (Personal tokens)
   - Monitor token usage and detect unusual API activity
   - Implement proper error handling for expired/invalid tokens
   - Log authentication events for security auditing

8. **API Security**:
   - Rate limiting prevents abuse (60 requests/minute enforced by Webflow)
   - Automatic retry logic prevents overwhelming the API
   - Error messages don't expose sensitive information
   - All API calls include proper authentication headers

### Compliance and Privacy

9. **Data Handling**:
   - Content is processed and stored in compliance with user permissions
   - Encrypted storage for all sensitive data (tokens, user content)
   - Automatic content cleanup when connections are removed
   - GDPR-compliant data deletion capabilities

10. **Audit and Monitoring**:
    - All OAuth flows and API calls are logged
    - Failed authentication attempts are tracked
    - Regular security reviews of permissions and access
    - Integration with monitoring tools for anomaly detection

## API Endpoints

The Webflow integration provides the following API endpoints:

- `GET /api/webflow/auth` - Initiate OAuth flow
- `GET /api/webflow/callback` - OAuth callback handler
- `GET /api/webflow/status` - Check connection status
- `POST /api/webflow/refresh` - Refresh access token
- `DELETE /api/webflow/disconnect` - Remove connection

## Rate Limits

Webflow API has rate limits:
- **60 requests per minute** per API key
- The system includes automatic rate limiting and retry logic
- Large content syncs may take longer due to these limits

## Support

If you encounter issues:

1. Check the browser console for JavaScript errors
2. Review server logs for API errors
3. Verify all environment variables are correctly set
4. Test the OAuth flow in an incognito/private browser window
5. Ensure your Webflow app settings match your environment configuration

For additional help, refer to the [Webflow API Documentation](https://developers.webflow.com/) or create an issue in the project repository.