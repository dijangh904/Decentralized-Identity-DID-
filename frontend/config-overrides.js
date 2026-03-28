const { override } = require('customize-cra');

module.exports = override(
  (config) => {
    // Add CSP headers to production build
    if (config.mode === 'production') {
      // Ensure HTML plugin has CSP meta tag
      const htmlWebpackPlugin = config.plugins.find(
        plugin => plugin.constructor.name === 'HtmlWebpackPlugin'
      );
      
      if (htmlWebpackPlugin) {
        htmlWebpackPlugin.userOptions = {
          ...htmlWebpackPlugin.userOptions,
          meta: {
            ...htmlWebpackPlugin.userOptions.meta,
            'Content-Security-Policy': {
              'http-equiv': 'Content-Security-Policy',
              content: [
                "default-src 'self'",
                "script-src 'self' 'unsafe-eval'",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
                "img-src 'self' data: https: blob:",
                "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com data:",
                "connect-src 'self' wss: https://*.stellar.org https://horizon-testnet.stellar.org https://horizon-mainnet.stellar.org",
                "frame-src 'none'",
                "object-src 'none'",
                "base-uri 'self'",
                "form-action 'self'",
                "frame-ancestors 'none'",
                "upgrade-insecure-requests"
              ].join('; ')
            }
          }
        };
      }
    }
    
    return config;
  }
);
