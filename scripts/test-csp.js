#!/usr/bin/env node

/**
 * CSP Headers Test Script
 * Tests that CSP headers are properly implemented in both development and production
 */

const http = require('http');
const https = require('https');

const testUrls = [
  'http://localhost:3001/health',
  'http://localhost:3000'
];

function testCspHeaders(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const request = client.request(url, (response) => {
      const cspHeader = response.headers['content-security-policy'];
      const helmetCsp = response.headers['x-content-security-policy'];
      
      console.log(`\n=== Testing ${url} ===`);
      console.log(`Status: ${response.statusCode}`);
      console.log(`CSP Header: ${cspHeader || 'Not found'}`);
      console.log(`Helmet CSP: ${helmetCsp || 'Not found'}`);
      
      if (cspHeader) {
        const directives = cspHeader.split(';').map(d => d.trim());
        console.log('\nCSP Directives:');
        directives.forEach(directive => {
          if (directive) {
            console.log(`  - ${directive}`);
          }
        });
        
        // Check for important security directives
        const securityChecks = {
          'default-src': cspHeader.includes("default-src 'self'"),
          'script-src': cspHeader.includes('script-src'),
          'object-src': cspHeader.includes("object-src 'none'"),
          'frame-ancestors': cspHeader.includes("frame-ancestors 'none'")
        };
        
        console.log('\nSecurity Checks:');
        Object.entries(securityChecks).forEach(([directive, present]) => {
          console.log(`  - ${directive}: ${present ? '✅' : '❌'}`);
        });
      }
      
      resolve({
        url,
        hasCsp: !!cspHeader,
        statusCode: response.statusCode,
        headers: response.headers
      });
    });
    
    request.on('error', (error) => {
      console.error(`Error testing ${url}:`, error.message);
      resolve({
        url,
        hasCsp: false,
        error: error.message
      });
    });
    
    request.end();
  });
}

async function runTests() {
  console.log('🔒 Testing CSP Headers Implementation');
  console.log('=====================================');
  
  const results = [];
  
  for (const url of testUrls) {
    try {
      const result = await testCspHeaders(url);
      results.push(result);
    } catch (error) {
      console.error(`Failed to test ${url}:`, error);
    }
  }
  
  console.log('\n=== Summary ===');
  results.forEach(result => {
    const status = result.hasCsp ? '✅ CSP Present' : '❌ CSP Missing';
    const error = result.error ? ` (Error: ${result.error})` : '';
    console.log(`${result.url}: ${status}${error}`);
  });
  
  const cspCount = results.filter(r => r.hasCsp).length;
  console.log(`\nCSP Headers: ${cspCount}/${results.length} services configured`);
  
  if (cspCount === results.length) {
    console.log('🎉 All services have CSP headers configured!');
  } else {
    console.log('⚠️  Some services missing CSP headers');
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testCspHeaders, runTests };
