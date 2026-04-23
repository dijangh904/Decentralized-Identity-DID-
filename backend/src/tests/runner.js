#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const ora = require('ora');
const Table = require('cli-table3');

/**
 * Test Runner
 * Comprehensive test execution and reporting system
 */

class TestRunner {
  constructor() {
    this.config = require('./config/test-config');
    this.results = {
      unit: { passed: 0, failed: 0, skipped: 0, duration: 0 },
      integration: { passed: 0, failed: 0, skipped: 0, duration: 0 },
      performance: { passed: 0, failed: 0, skipped: 0, duration: 0 },
      security: { passed: 0, failed: 0, skipped: 0, duration: 0 },
      api: { passed: 0, failed: 0, skipped: 0, duration: 0 },
      graphql: { passed: 0, failed: 0, skipped: 0, duration: 0 }
    };
    this.startTime = Date.now();
  }

  /**
   * Run all tests
   */
  async runAll(options = {}) {
    console.log(chalk.blue.bold('\n🧪 Stellar DID Platform - Test Suite\n'));
    
    const testSuites = [
      { name: 'unit', description: 'Unit Tests', required: true },
      { name: 'api', description: 'REST API Tests', required: true },
      { name: 'graphql', description: 'GraphQL API Tests', required: true },
      { name: 'integration', description: 'Integration Tests', required: false },
      { name: 'performance', description: 'Performance Tests', required: false },
      { name: 'security', description: 'Security Tests', required: false }
    ];

    if (options.suite) {
      // Run specific suite
      const suite = testSuites.find(s => s.name === options.suite);
      if (suite) {
        await this.runSuite(suite.name, suite.description, options);
      } else {
        console.error(chalk.red(`Unknown test suite: ${options.suite}`));
        process.exit(1);
      }
    } else {
      // Run all suites
      for (const suite of testSuites) {
        await this.runSuite(suite.name, suite.description, options);
        
        if (suite.required && this.results[suite.name].failed > 0 && !options.continue) {
          console.error(chalk.red(`\n❌ Required test suite '${suite.name}' failed. Stopping execution.`));
          process.exit(1);
        }
      }
    }

    this.generateReport();
    this.exit();
  }

  /**
   * Run specific test suite
   */
  async runSuite(suiteName, description, options = {}) {
    const spinner = ora(`Running ${description}...`).start();
    
    try {
      const startTime = Date.now();
      
      // Setup test environment
      await this.config.setupEnvironment();
      
      // Determine test files
      const testFiles = this.getTestFiles(suiteName);
      
      if (testFiles.length === 0) {
        spinner.warn(`No test files found for ${suiteName}`);
        this.results[suiteName].skipped = 1;
        return;
      }
      
      // Build mocha command
      const mochaArgs = this.buildMochaArgs(suiteName, testFiles, options);
      
      // Run tests
      const result = this.runMocha(mochaArgs);
      
      // Parse results
      const testResults = this.parseTestResults(result);
      
      // Update results
      this.results[suiteName] = {
        ...testResults,
        duration: Date.now() - startTime
      };
      
      // Cleanup test environment
      await this.config.cleanupEnvironment();
      
      // Display results
      spinner.stop();
      this.displaySuiteResults(suiteName, description, testResults);
      
    } catch (error) {
      spinner.fail(`Failed to run ${description}: ${error.message}`);
      this.results[suiteName].failed = 1;
      this.results[suiteName].duration = Date.now() - startTime;
    }
  }

  /**
   * Get test files for suite
   */
  getTestFiles(suiteName) {
    const testDirs = {
      unit: ['unit/**/*.test.js'],
      api: ['api/**/*.test.js'],
      graphql: ['api/graphql.test.js'],
      integration: ['integration/**/*.test.js'],
      performance: ['performance/**/*.test.js'],
      security: ['security/**/*.test.js']
    };

    const patterns = testDirs[suiteName] || [];
    const testFiles = [];

    patterns.forEach(pattern => {
      const glob = require('glob');
      const files = glob.sync(path.join(__dirname, pattern));
      testFiles.push(...files);
    });

    return testFiles.sort();
  }

  /**
   * Build mocha arguments
   */
  buildMochaArgs(suiteName, testFiles, options) {
    const config = this.config.getTestConfig(suiteName);
    const args = [
      './node_modules/.bin/mocha',
      '--timeout', config.timeout,
      '--reporter', 'json',
      '--reporter-options', 'stdout=false',
      '--require', '@babel/register',
      '--require', path.join(__dirname, 'setup.js')
    ];

    if (config.parallel) {
      args.push('--parallel');
    }

    if (config.retries > 0) {
      args.push('--retries', config.retries);
    }

    if (config.bail) {
      args.push('--bail');
    }

    if (options.grep) {
      args.push('--grep', options.grep);
    }

    if (options.coverage && suiteName === 'unit') {
      args.unshift(
        './node_modules/.bin/nyc',
        '--reporter', 'text',
        '--reporter', 'html',
        '--reporter', 'lcov',
        '--exclude', '**/node_modules/**',
        '--exclude', '**/tests/**'
      );
    }

    args.push(...testFiles);

    return args;
  }

  /**
   * Run mocha and capture output
   */
  runMocha(args) {
    try {
      const output = execSync(args.join(' '), {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: path.join(__dirname, '../..')
      });
      
      return { success: true, output };
    } catch (error) {
      return { 
        success: false, 
        output: error.stdout || error.message,
        error: error.stderr || error.message 
      };
    }
  }

  /**
   * Parse test results from mocha JSON output
   */
  parseTestResults(result) {
    try {
      const lines = result.output.split('\n');
      const jsonLine = lines.find(line => line.startsWith('{') && line.endsWith('}'));
      
      if (jsonLine) {
        const mochaResults = JSON.parse(jsonLine);
        
        return {
          passed: mochaResults.stats.passes || 0,
          failed: mochaResults.stats.failures || 0,
          skipped: mochaResults.stats.pending || 0,
          total: mochaResults.stats.tests || 0,
          duration: mochaResults.stats.duration || 0
        };
      }
      
      // Fallback: parse from text output
      return this.parseTextResults(result.output);
    } catch (error) {
      console.warn('Failed to parse JSON results, falling back to text parsing');
      return this.parseTextResults(result.output);
    }
  }

  /**
   * Parse test results from text output
   */
  parseTextResults(output) {
    const lines = output.split('\n');
    const results = { passed: 0, failed: 0, skipped: 0, total: 0, duration: 0 };
    
    lines.forEach(line => {
      if (line.includes('passing')) {
        const match = line.match(/(\d+)\s+passing/);
        if (match) results.passed = parseInt(match[1]);
      }
      if (line.includes('failing')) {
        const match = line.match(/(\d+)\s+failing/);
        if (match) results.failed = parseInt(match[1]);
      }
      if (line.includes('pending')) {
        const match = line.match(/(\d+)\s+pending/);
        if (match) results.skipped = parseInt(match[1]);
      }
    });
    
    results.total = results.passed + results.failed + results.skipped;
    
    return results;
  }

  /**
   * Display suite results
   */
  displaySuiteResults(suiteName, description, results) {
    const total = results.passed + results.failed + results.skipped;
    const duration = (results.duration / 1000).toFixed(2);
    
    if (results.failed === 0) {
      console.log(chalk.green(`✅ ${description}: ${results.passed}/${total} passed (${duration}s)`));
    } else {
      console.log(chalk.red(`❌ ${description}: ${results.passed}/${total} passed, ${results.failed} failed (${duration}s)`));
    }
    
    if (results.skipped > 0) {
      console.log(chalk.yellow(`   ⚠️  ${results.skipped} skipped`));
    }
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    const totalDuration = Date.now() - this.startTime;
    const totalTests = Object.values(this.results).reduce((sum, result) => sum + result.passed + result.failed + result.skipped, 0);
    const totalPassed = Object.values(this.results).reduce((sum, result) => sum + result.passed, 0);
    const totalFailed = Object.values(this.results).reduce((sum, result) => sum + result.failed, 0);
    const totalSkipped = Object.values(this.results).reduce((sum, result) => sum + result.skipped, 0);
    
    console.log(chalk.blue.bold('\n📊 Test Results Summary\n'));
    
    // Summary table
    const summaryTable = new Table({
      head: ['Suite', 'Passed', 'Failed', 'Skipped', 'Duration'],
      colWidths: [15, 8, 8, 8, 12]
    });
    
    Object.entries(this.results).forEach(([suite, result]) => {
      const total = result.passed + result.failed + result.skipped;
      const duration = (result.duration / 1000).toFixed(2);
      const status = result.failed === 0 ? chalk.green('✅') : chalk.red('❌');
      
      summaryTable.push([
        `${status} ${suite}`,
        result.passed.toString(),
        result.failed.toString(),
        result.skipped.toString(),
        `${duration}s`
      ]);
    });
    
    console.log(summaryTable.toString());
    
    // Overall summary
    const passRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0;
    const overallStatus = totalFailed === 0 ? chalk.green.bold('✅ ALL TESTS PASSED') : chalk.red.bold(`❌ ${totalFailed} FAILED`);
    
    console.log(chalk.bold(`\nOverall: ${overallStatus}`));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${chalk.green(totalPassed)}`);
    console.log(`Failed: ${chalk.red(totalFailed)}`);
    console.log(`Skipped: ${chalk.yellow(totalSkipped)}`);
    console.log(`Pass Rate: ${passRate}%`);
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    
    // Performance summary
    if (this.results.performance.duration > 0) {
      console.log(chalk.blue.bold('\n⚡ Performance Tests Summary'));
      console.log(`Performance tests completed in ${(this.results.performance.duration / 1000).toFixed(2)}s`);
      
      if (this.results.performance.failed > 0) {
        console.log(chalk.yellow('⚠️  Some performance tests failed. Check individual test output for details.'));
      }
    }
    
    // Coverage report
    if (fs.existsSync(path.join(__dirname, '../../coverage/lcov.info'))) {
      console.log(chalk.blue.bold('\n📋 Coverage Report'));
      console.log('Coverage report generated: ./coverage/lcov.info');
      console.log('HTML coverage report: ./coverage/lcov-report/index.html');
    }
    
    // Save report to file
    this.saveReportToFile({
      summary: {
        total: totalTests,
        passed: totalPassed,
        failed: totalFailed,
        skipped: totalSkipped,
        passRate: parseFloat(passRate),
        duration: totalDuration
      },
      suites: this.results,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Save report to file
   */
  saveReportToFile(reportData) {
    try {
      const reportDir = path.join(__dirname, '../../test-results');
      const reportFile = path.join(reportDir, `test-report-${Date.now()}.json`);
      
      // Ensure directory exists
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      
      fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
      console.log(chalk.blue(`\n📄 Detailed report saved: ${reportFile}`));
    } catch (error) {
      console.warn('Failed to save report to file:', error.message);
    }
  }

  /**
   * Exit with appropriate code
   */
  exit() {
    const totalFailed = Object.values(this.results).reduce((sum, result) => sum + result.failed, 0);
    
    if (totalFailed > 0) {
      console.log(chalk.red.bold('\n💥 Test suite completed with failures'));
      process.exit(1);
    } else {
      console.log(chalk.green.bold('\n🎉 Test suite completed successfully'));
      process.exit(0);
    }
  }

  /**
   * Run coverage analysis
   */
  async runCoverage() {
    console.log(chalk.blue.bold('\n📊 Running Coverage Analysis\n'));
    
    const spinner = ora('Generating coverage report...').start();
    
    try {
      execSync('./node_modules/.bin/nyc report --reporter=html --reporter=text --reporter=lcov', {
        stdio: 'pipe',
        cwd: path.join(__dirname, '../..')
      });
      
      spinner.succeed('Coverage report generated');
      
      if (fs.existsSync(path.join(__dirname, '../../coverage/lcov-report/index.html'))) {
        console.log(chalk.blue('HTML coverage report: ./coverage/lcov-report/index.html'));
      }
      
    } catch (error) {
      spinner.fail('Coverage generation failed');
      console.error(error.message);
    }
  }

  /**
   * Watch mode for development
   */
  async watch() {
    console.log(chalk.blue.bold('\n👁️  Watching for file changes...\n'));
    
    const { spawn } = require('child_process');
    const chokidar = require('chokidar');
    
    // Watch test files and source files
    const watcher = chokidar.watch([
      'src/**/*.js',
      'tests/**/*.js',
      '!tests/**/coverage/**',
      '!tests/**/node_modules/**'
    ], {
      cwd: path.join(__dirname, '../..'),
      ignored: /node_modules/
    });
    
    let isRunning = false;
    
    const runTests = () => {
      if (isRunning) return;
      
      isRunning = true;
      console.log(chalk.blue('\n🔄 Running tests...\n'));
      
      const testProcess = spawn('node', [__filename, '--suite', 'unit'], {
        stdio: 'inherit',
        cwd: path.join(__dirname, '../..')
      });
      
      testProcess.on('close', (code) => {
        isRunning = false;
        if (code === 0) {
          console.log(chalk.green('\n✅ Tests completed\n'));
        } else {
          console.log(chalk.red('\n❌ Tests failed\n'));
        }
      });
    };
    
    watcher.on('change', runTests);
    
    // Run initial tests
    runTests();
    
    console.log(chalk.blue('Watching for changes... Press Ctrl+C to exit'));
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--suite':
        options.suite = args[++i];
        break;
      case '--grep':
        options.grep = args[++i];
        break;
      case '--coverage':
        options.coverage = true;
        break;
      case '--continue':
        options.continue = true;
        break;
      case '--watch':
        options.watch = true;
        break;
      case '--help':
      case '-h':
        console.log(`
Stellar DID Platform Test Runner

Usage: node runner.js [options]

Options:
  --suite <name>     Run specific test suite (unit, api, graphql, integration, performance, security)
  --grep <pattern>    Run tests matching pattern
  --coverage          Generate coverage report (unit tests only)
  --continue          Continue running tests even if required suites fail
  --watch             Watch mode for development
  --help, -h          Show this help message

Examples:
  node runner.js                    # Run all tests
  node runner.js --suite unit       # Run unit tests only
  node runner.js --suite api --grep "DID"  # Run API tests matching "DID"
  node runner.js --coverage         # Run tests with coverage
  node runner.js --watch            # Watch mode
        `);
        process.exit(0);
        break;
    }
  }
  
  const runner = new TestRunner();
  
  if (options.watch) {
    runner.watch();
  } else {
    runner.runAll(options);
  }
}

module.exports = TestRunner;
