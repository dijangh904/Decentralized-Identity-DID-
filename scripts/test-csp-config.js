#!/usr/bin/env node

/**
 * CSP Configuration Test Script
 * Tests that CSP configuration is properly defined in the code
 */

const fs = require('fs');
const path = require('path');

function testServerConfig() {
  const serverPath = path.join(__dirname, '../backend/src/server.js');
  
  if (!fs.existsSync(serverPath)) {
    console.log('❌ Server file not found');
    return false;
  }
  
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  
  const checks = {
    'Helmet imported': serverContent.includes('const helmet = require("helmet")'),
    'CSP directives defined': serverContent.includes('cspDirectives'),
    'default-src self': serverContent.includes("defaultSrc: [\"'self'\"]"),
    'script-src self': serverContent.includes('scriptSrc'),
    'object-src none': serverContent.includes("objectSrc: [\"'none'\"]"),
    'frame-ancestors none': serverContent.includes("frameAncestors: [\"'none'\"]"),
    'Production CSP enabled': serverContent.includes('contentSecurityPolicy: process.env.NODE_ENV === \'production\''),
    'Stellar domains whitelisted': serverContent.includes('stellar.org')
  };
  
  console.log('=== Backend Server CSP Configuration ===');
  Object.entries(checks).forEach(([check, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${check}`);
  });
  
  return Object.values(checks).every(Boolean);
}

function testHtmlCsp() {
  const htmlPath = path.join(__dirname, '../frontend/public/index.html');
  
  if (!fs.existsSync(htmlPath)) {
    console.log('❌ HTML file not found');
    return false;
  }
  
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  
  const checks = {
    'CSP meta tag present': htmlContent.includes('Content-Security-Policy'),
    'default-src self': htmlContent.includes("default-src 'self'"),
    'script-src defined': htmlContent.includes('script-src'),
    'object-src none': htmlContent.includes("object-src 'none'"),
    'frame-ancestors none': htmlContent.includes("frame-ancestors 'none'"),
    'Stellar domains allowed': htmlContent.includes('stellar.org')
  };
  
  console.log('\n=== Frontend HTML CSP Configuration ===');
  Object.entries(checks).forEach(([check, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${check}`);
  });
  
  return Object.values(checks).every(Boolean);
}

function testPackageConfig() {
  const frontendPackagePath = path.join(__dirname, '../frontend/package.json');
  const rootPackagePath = path.join(__dirname, '../package.json');
  
  const frontendPackage = JSON.parse(fs.readFileSync(frontendPackagePath, 'utf8'));
  const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
  
  const checks = {
    'CSP test script in root package': rootPackage.scripts && rootPackage.scripts['test:csp'],
    'customize-cra dependency': frontendPackage.devDependencies && frontendPackage.devDependencies['customize-cra'],
    'react-app-rewired dependency': frontendPackage.devDependencies && frontendPackage.devDependencies['react-app-rewired'],
    'build:prod script': frontendPackage.scripts && frontendPackage.scripts['build:prod']
  };
  
  console.log('\n=== Package Configuration ===');
  Object.entries(checks).forEach(([check, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${check}`);
  });
  
  return Object.values(checks).every(Boolean);
}

function testConfigOverrides() {
  const configPath = path.join(__dirname, '../frontend/config-overrides.js');
  
  if (!fs.existsSync(configPath)) {
    console.log('❌ Config overrides file not found');
    return false;
  }
  
  const configContent = fs.readFileSync(configPath, 'utf8');
  
  const checks = {
    'File exists': true,
    'Exports override function': configContent.includes('module.exports = override'),
    'Handles production mode': configContent.includes('config.mode === \'production\''),
    'Modifies HTML plugin': configContent.includes('HtmlWebpackPlugin'),
    'Adds CSP meta tag': configContent.includes('Content-Security-Policy')
  };
  
  console.log('\n=== Build Configuration Overrides ===');
  Object.entries(checks).forEach(([check, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${check}`);
  });
  
  return Object.values(checks).every(Boolean);
}

function runAllTests() {
  console.log('🔒 Testing CSP Configuration Implementation');
  console.log('==========================================\n');
  
  const results = {
    'Backend Server': testServerConfig(),
    'Frontend HTML': testHtmlCsp(),
    'Package Configuration': testPackageConfig(),
    'Build Overrides': testConfigOverrides()
  };
  
  console.log('\n=== Summary ===');
  const passedCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;
  
  Object.entries(results).forEach(([component, passed]) => {
    console.log(`${component}: ${passed ? '✅' : '❌'}`);
  });
  
  console.log(`\nOverall: ${passedCount}/${totalCount} components properly configured`);
  
  if (passedCount === totalCount) {
    console.log('🎉 CSP implementation is complete and properly configured!');
    console.log('\nNext steps:');
    console.log('1. Install missing dependencies');
    console.log('2. Test with running servers');
    console.log('3. Deploy to production to enable CSP headers');
  } else {
    console.log('⚠️  Some CSP configuration is missing');
  }
}

if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };
