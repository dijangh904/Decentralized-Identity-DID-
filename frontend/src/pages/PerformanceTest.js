import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Paper,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab
} from '@mui/material';
import {
  Speed,
  Memory,
  Timer,
  Assessment,
  PlayArrow,
  Refresh,
  TrendingUp,
  CheckCircle,
  Warning
} from '@mui/icons-material';
import CredentialList from '../components/CredentialList';
import performanceMetrics, { usePerformanceMonitor, useDebouncedScroll } from '../utils/performanceTest';

const PerformanceTest = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [testRunning, setTestRunning] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [performanceReport, setPerformanceReport] = useState(null);
  const [credentialCount, setCredentialCount] = useState(75);
  
  const credentialListRef = useRef(null);
  const virtualScrollRef = useRef(null);
  
  const componentMetrics = usePerformanceMonitor('PerformanceTest');
  const debouncedScroll = useDebouncedScroll(() => {
    console.log('Debounced scroll event');
  });

  const runPerformanceTest = async () => {
    setTestRunning(true);
    setTestResults(null);
    setPerformanceReport(null);

    try {
      console.log('🚀 Starting performance test...');
      
      // Test 1: Virtual Scrolling Performance
      const virtualScrollResults = await performanceMetrics.testVirtualScrolling(
        virtualScrollRef,
        credentialCount
      );

      // Test 2: Memory Usage Analysis
      const initialMemory = performanceMetrics.getMemoryUsage();
      
      // Simulate heavy scrolling
      if (credentialListRef.current) {
        const container = credentialListRef.current.querySelector('[role="region"]') || 
                         credentialListRef.current.querySelector('.MuiBox-root');
        if (container) {
          for (let i = 0; i < 10; i++) {
            container.scrollTop = i * 200;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }
      
      const finalMemory = performanceMetrics.getMemoryUsage();

      // Test 3: Render Performance
      const renderMetrics = performanceMetrics.measureRenderTime(
        'CredentialList',
        () => {
          // Simulate credential list rendering
          return Array.from({ length: Math.min(20, credentialCount) }, (_, i) => ({
            id: `test-${i}`,
            renderTime: Math.random() * 10
          }));
        }
      );

      // Test 4: Pagination vs Virtual Scrolling Comparison
      const comparisonResults = await performanceMetrics.comparePerformance(
        credentialListRef,
        virtualScrollRef,
        credentialCount
      );

      const results = {
        virtualScroll: virtualScrollResults,
        memoryAnalysis: {
          initial: initialMemory,
          final: finalMemory,
          increase: finalMemory && initialMemory ? 
            finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize : 0
        },
        renderPerformance: renderMetrics,
        comparison: comparisonResults,
        timestamp: new Date().toISOString()
      };

      setTestResults(results);

      // Generate performance report
      const report = performanceMetrics.generateReport(results);
      setPerformanceReport(report);
      
      performanceMetrics.logResults(report);

    } catch (error) {
      console.error('Performance test failed:', error);
    } finally {
      setTestRunning(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const formatMemorySize = (bytes) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatTime = (ms) => {
    return `${ms.toFixed(2)} ms`;
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Credential List Performance Testing
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Test virtual scrolling and pagination performance with large credential datasets
      </Typography>

      {/* Test Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6">Performance Test Controls</Typography>
            <Box display="flex" gap={2}>
              <Button
                variant="contained"
                startIcon={<PlayArrow />}
                onClick={runPerformanceTest}
                disabled={testRunning}
                size="large"
              >
                {testRunning ? 'Running Test...' : 'Run Performance Test'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={() => {
                  setTestResults(null);
                  setPerformanceReport(null);
                }}
              >
                Clear Results
              </Button>
            </Box>
          </Box>

          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <Typography variant="body2" color="text.secondary">
                Test Dataset Size
              </Typography>
              <Chip 
                label={`${credentialCount} Credentials`} 
                color="primary" 
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="body2" color="text.secondary">
                Component Render Count
              </Typography>
              <Chip 
                label={componentMetrics.renderCount} 
                color="secondary" 
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="body2" color="text.secondary">
                Average Render Time
              </Typography>
              <Chip 
                label={formatTime(componentMetrics.averageRenderTime)} 
                color="success" 
                variant="outlined"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Test Status */}
      {testRunning && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Box display="flex" alignItems="center">
            <CircularProgress size={20} sx={{ mr: 2 }} />
            Performance test is running... Please wait.
          </Box>
        </Alert>
      )}

      {/* Results */}
      {testResults && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />
              Test Results
            </Typography>
            
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tabs value={activeTab} onChange={handleTabChange}>
                <Tab label="Summary" />
                <Tab label="Memory Analysis" />
                <Tab label="Scroll Performance" />
                <Tab label="Comparison" />
              </Tabs>
            </Box>

            {/* Summary Tab */}
            {activeTab === 0 && performanceReport && (
              <Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        <Timer sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Performance Metrics
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableBody>
                            <TableRow>
                              <TableCell>Average Scroll Time</TableCell>
                              <TableCell align="right">
                                {performanceReport.summary.averageScrollTime ? 
                                  formatTime(performanceReport.summary.averageScrollTime) : 'N/A'}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Memory Increase</TableCell>
                              <TableCell align="right">
                                {performanceReport.summary.memoryIncrease ? 
                                  formatMemorySize(performanceReport.summary.memoryIncrease) : 'N/A'}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Last Render Time</TableCell>
                              <TableCell align="right">
                                {formatTime(componentMetrics.lastRenderTime)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        <TrendingUp sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Recommendations
                      </Typography>
                      {performanceReport.recommendations.map((rec, index) => (
                        <Box key={index} display="flex" alignItems="center" mb={1}>
                          {rec.includes('optimal') ? (
                            <CheckCircle color="success" sx={{ mr: 1, fontSize: 20 }} />
                          ) : (
                            <Warning color="warning" sx={{ mr: 1, fontSize: 20 }} />
                          )}
                          <Typography variant="body2">{rec}</Typography>
                        </Box>
                      ))}
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* Memory Analysis Tab */}
            {activeTab === 1 && testResults.memoryAnalysis && (
              <Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Memory sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                      <Typography variant="h6">
                        {formatMemorySize(testResults.memoryAnalysis.initial?.usedJSHeapSize)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Initial Memory
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Memory sx={{ fontSize: 40, color: 'secondary.main', mb: 1 }} />
                      <Typography variant="h6">
                        {formatMemorySize(testResults.memoryAnalysis.final?.usedJSHeapSize)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Final Memory
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <TrendingUp sx={{ fontSize: 40, color: testResults.memoryAnalysis.increase > 0 ? 'warning.main' : 'success.main', mb: 1 }} />
                      <Typography variant="h6">
                        {formatMemorySize(testResults.memoryAnalysis.increase)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Memory Increase
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
                
                {testResults.memoryAnalysis.initial && (
                  <Box mt={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      Detailed Memory Usage
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Metric</TableCell>
                            <TableCell align="right">Initial</TableCell>
                            <TableCell align="right">Final</TableCell>
                            <TableCell align="right">Change</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell>Used Heap Size</TableCell>
                            <TableCell align="right">
                              {formatMemorySize(testResults.memoryAnalysis.initial.usedJSHeapSize)}
                            </TableCell>
                            <TableCell align="right">
                              {formatMemorySize(testResults.memoryAnalysis.final.usedJSHeapSize)}
                            </TableCell>
                            <TableCell align="right">
                              {formatMemorySize(testResults.memoryAnalysis.increase)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Total Heap Size</TableCell>
                            <TableCell align="right">
                              {formatMemorySize(testResults.memoryAnalysis.initial.totalJSHeapSize)}
                            </TableCell>
                            <TableCell align="right">
                              {formatMemorySize(testResults.memoryAnalysis.final.totalJSHeapSize)}
                            </TableCell>
                            <TableCell align="right">
                              {formatMemorySize(testResults.memoryAnalysis.final.totalJSHeapSize - testResults.memoryAnalysis.initial.totalJSHeapSize)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}
              </Box>
            )}

            {/* Scroll Performance Tab */}
            {activeTab === 2 && testResults.virtualScroll && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  <Speed sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Virtual Scrolling Performance
                </Typography>
                {testResults.virtualScroll.scrollTests && testResults.virtualScroll.scrollTests.length > 0 ? (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Scroll Position</TableCell>
                          <TableCell align="right">Scroll Time</TableCell>
                          <TableCell align="right">Estimated FPS</TableCell>
                          <TableCell align="right">Performance</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {testResults.virtualScroll.scrollTests.map((test, index) => (
                          <TableRow key={index}>
                            <TableCell>{test.position}px</TableCell>
                            <TableCell align="right">{formatTime(test.scrollTime)}</TableCell>
                            <TableCell align="right">{test.framesPerSecond.toFixed(1)}</TableCell>
                            <TableCell align="right">
                              <Chip 
                                label={test.scrollTime < 16 ? 'Good' : test.scrollTime < 33 ? 'Fair' : 'Poor'}
                                color={test.scrollTime < 16 ? 'success' : test.scrollTime < 33 ? 'warning' : 'error'}
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Alert severity="info">
                    No scroll performance data available. Make sure to run the performance test first.
                  </Alert>
                )}
              </Box>
            )}

            {/* Comparison Tab */}
            {activeTab === 3 && testResults.comparison && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  <Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Pagination vs Virtual Scrolling
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Pagination Performance
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableBody>
                            <TableRow>
                              <TableCell>Total Time</TableCell>
                              <TableCell align="right">
                                {formatTime(testResults.comparison.pagination?.totalTime || 0)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Average Page Load</TableCell>
                              <TableCell align="right">
                                {formatTime(testResults.comparison.pagination?.averagePageLoad || 0)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Virtual Scroll Performance
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableBody>
                            <TableRow>
                              <TableCell>Total Time</TableCell>
                              <TableCell align="right">
                                {formatTime(testResults.comparison.virtualScroll?.totalTime || 0)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Winner</TableCell>
                              <TableCell align="right">
                                <Chip 
                                  label={testResults.comparison.paginationFaster ? 'Pagination' : 'Virtual Scroll'}
                                  color="primary"
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Live Credential List for Testing */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Live Credential List (Test Interface)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This is the actual credential list component being tested. Try scrolling and filtering to see performance in action.
          </Typography>
          
          <Box ref={credentialListRef}>
            <CredentialList 
              onCredentialSelect={(credential) => console.log('Selected:', credential)}
              ref={virtualScrollRef}
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PerformanceTest;
