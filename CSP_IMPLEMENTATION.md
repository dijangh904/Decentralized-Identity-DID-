# CSP Headers Implementation

## Overview
This document describes the Content Security Policy (CSP) implementation for the Stellar DID Platform to protect against XSS and injection attacks.

## Implementation Details

### Backend CSP Configuration
The backend server (`backend/src/server.js`) now includes comprehensive CSP headers using Helmet middleware:

#### CSP Directives:
- **default-src**: `'self'` - Only allow resources from the same origin
- **script-src**: `'self' 'unsafe-eval'` - Allow scripts from same origin and eval for React development
- **style-src**: `'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com` - Allow styles and Google Fonts
- **img-src**: `'self' data: https: blob:` - Allow images from same origin, data URLs, HTTPS, and blob URLs
- **font-src**: `'self' https://fonts.googleapis.com https://fonts.gstatic.com data:` - Allow fonts from same origin and Google Fonts
- **connect-src**: `'self' wss: https://*.stellar.org https://horizon-testnet.stellar.org https://horizon-mainnet.stellar.org` - Allow connections to WebSocket and Stellar APIs
- **frame-src**: `'none'` - Disallow iframes
- **object-src**: `'none'` - Disallow plugins
- **base-uri**: `'self'` - Restrict base tag to same origin
- **form-action**: `'self'` - Restrict form submissions to same origin
- **frame-ancestors**: `'none'` - Prevent clickjacking
- **upgrade-insecure-requests**: - Force HTTPS in production

### Frontend CSP Configuration
The frontend includes CSP meta tags in `frontend/public/index.html` for additional protection.

### Build Configuration
- Custom webpack overrides in `frontend/config-overrides.js` ensure CSP headers are properly injected during production builds
- Uses `customize-cra` and `react-app-rewired` for build customization

## Security Benefits

1. **XSS Protection**: Prevents execution of malicious scripts
2. **Clickjacking Prevention**: `frame-ancestors 'none'` prevents site from being embedded in iframes
3. **Data Injection Protection**: Restricts resource loading to trusted sources
4. **Mixed Content Prevention**: `upgrade-insecure-requests` forces HTTPS in production
5. **Plugin Security**: `object-src 'none'` prevents dangerous plugin execution

## Development vs Production

### Development Mode
- CSP headers are disabled in backend to allow for hot reloading and development tools
- Frontend meta tag includes `'unsafe-eval'` and `'unsafe-inline'` for React development

### Production Mode
- Full CSP headers enforced in backend
- Stricter policies applied for maximum security

## Testing CSP Headers

### Method 1: Browser DevTools
1. Open browser devtools
2. Check Network tab for response headers
3. Look for `Content-Security-Policy` header

### Method 2: curl Command
```bash
curl -I https://your-domain.com/api/health
```

### Method 3: Online CSP Testers
Use services like:
- CSP Evaluator (Google)
- Security Headers Scanner

## Deployment Considerations

1. **Environment Variables**: Ensure `NODE_ENV=production` is set in production
2. **Domain Whitelisting**: Update `connect-src` with actual production domains
3. **Monitoring**: Monitor CSP violation reports
4. **Testing**: Test all functionality works with CSP enabled

## Troubleshooting

### Common Issues
1. **Inline Styles**: Move inline styles to CSS files or use style attributes with nonce
2. **Dynamic Scripts**: Use nonce or hash for dynamic script loading
3. **Third-party APIs**: Add API domains to `connect-src`
4. **Font Loading**: Ensure font domains are whitelisted

### CSP Violation Reports
Monitor browser console for CSP violations and update policies accordingly.

## Future Enhancements

1. **Report-Only Mode**: Implement CSP report-uri for monitoring
2. **Nonce-based Policies**: Use nonces for dynamic content
3. **Strict-dynamic**: Adopt strict-dynamic for better security
4. **CSP Monitoring**: Implement automated CSP violation monitoring

## Compliance

This CSP implementation helps with:
- OWASP Top 10 (A3: Injection)
- Security best practices
- Modern web security standards
- GDPR compliance recommendations
