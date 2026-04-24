// Performance testing utilities for credential list optimization

export const performanceMetrics = {
  // Measure render time for credential list
  measureRenderTime: (componentName, renderFunction) => {
    const startTime = performance.now();
    const result = renderFunction();
    const endTime = performance.now();
    
    console.log(`${componentName} render time: ${endTime - startTime}ms`);
    return {
      result,
      renderTime: endTime - startTime
    };
  },

  // Measure scroll performance
  measureScrollPerformance: (containerElement, scrollDistance = 1000) => {
    return new Promise((resolve) => {
      const startTime = performance.now();
      
      const scrollHandler = () => {
        const endTime = performance.now();
        const scrollTime = endTime - startTime;
        
        containerElement.removeEventListener('scroll', scrollHandler);
        
        resolve({
          scrollTime,
          scrollDistance,
          framesPerSecond: (1000 / scrollTime) * 60 // Approximate FPS
        });
      };
      
      containerElement.addEventListener('scroll', scrollHandler);
      containerElement.scrollTop = scrollDistance;
    });
  },

  // Memory usage monitoring
  getMemoryUsage: () => {
    if (performance.memory) {
      return {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        usedPercentage: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100
      };
    }
    return null;
  },

  // Test virtual scrolling performance
  testVirtualScrolling: async (containerRef, itemCount) => {
    const container = containerRef.current;
    if (!container) {
      console.error('Container element not found');
      return null;
    }

    const metrics = {
      initialMemory: performanceMetrics.getMemoryUsage(),
      scrollTests: [],
      finalMemory: null
    };

    // Test scrolling to different positions
    const scrollPositions = [100, 500, 1000, 2000, 4000];
    
    for (const position of scrollPositions) {
      if (position >= container.scrollHeight) break;
      
      const scrollResult = await performanceMetrics.measureScrollPerformance(container, position);
      metrics.scrollTests.push({
        position,
        ...scrollResult
      });
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    metrics.finalMemory = performanceMetrics.getMemoryUsage();
    
    return metrics;
  },

  // Compare pagination vs virtual scrolling
  comparePerformance: async (listComponent, virtualComponent, itemCount = 75) => {
    const results = {
      pagination: {},
      virtualScroll: {},
      comparison: {}
    };

    // Test pagination performance
    console.log('Testing pagination performance...');
    const paginationStart = performance.now();
    
    // Simulate pagination operations
    for (let page = 1; page <= 5; page++) {
      // Simulate loading a page of credentials
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    const paginationEnd = performance.now();
    results.pagination.totalTime = paginationEnd - paginationStart;
    results.pagination.averagePageLoad = results.pagination.totalTime / 5;

    // Test virtual scrolling performance
    console.log('Testing virtual scrolling performance...');
    const virtualStart = performance.now();
    
    if (virtualComponent && virtualComponent.current) {
      const virtualMetrics = await performanceMetrics.testVirtualScrolling(virtualComponent, itemCount);
      results.virtualScroll = virtualMetrics;
    }
    
    const virtualEnd = performance.now();
    results.virtualScroll.totalTime = virtualEnd - virtualStart;

    // Calculate comparison metrics
    results.comparison.paginationFaster = results.pagination.totalTime < results.virtualScroll.totalTime;
    results.comparison.speedDifference = Math.abs(results.pagination.totalTime - results.virtualScroll.totalTime);

    return results;
  },

  // Generate performance report
  generateReport: (testResults) => {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {},
      details: testResults,
      recommendations: []
    };

    // Analyze results and generate recommendations
    if (testResults.virtualScroll && testResults.virtualScroll.scrollTests) {
      const avgScrollTime = testResults.virtualScroll.scrollTests.reduce(
        (sum, test) => sum + test.scrollTime, 0
      ) / testResults.virtualScroll.scrollTests.length;

      report.summary.averageScrollTime = avgScrollTime;
      
      if (avgScrollTime > 16) { // 16ms = 60fps
        report.recommendations.push('Consider optimizing virtual scrolling for better performance');
      } else {
        report.recommendations.push('Virtual scrolling performance is optimal');
      }
    }

    if (testResults.pagination && testResults.virtualScroll) {
      if (testResults.pagination.totalTime < testResults.virtualScroll.totalTime) {
        report.recommendations.push('Pagination may be more efficient for small datasets');
      } else {
        report.recommendations.push('Virtual scrolling shows better performance for large datasets');
      }
    }

    // Memory analysis
    if (testResults.virtualScroll && testResults.virtualScroll.initialMemory && testResults.virtualScroll.finalMemory) {
      const memoryIncrease = testResults.virtualScroll.finalMemory.usedJSHeapSize - testResults.virtualScroll.initialMemory.usedJSHeapSize;
      report.summary.memoryIncrease = memoryIncrease;
      
      if (memoryIncrease > 10 * 1024 * 1024) { // 10MB
        report.recommendations.push('Memory usage is high, consider implementing cleanup');
      }
    }

    return report;
  },

  // Log performance results to console
  logResults: (report) => {
    console.group('🚀 Credential List Performance Report');
    console.log('📊 Summary:', report.summary);
    console.log('📈 Detailed Results:', report.details);
    console.log('💡 Recommendations:', report.recommendations);
    console.groupEnd();
  }
};

// Performance monitoring hook for React components
export const usePerformanceMonitor = (componentName) => {
  const [metrics, setMetrics] = React.useState({
    renderCount: 0,
    totalRenderTime: 0,
    averageRenderTime: 0,
    lastRenderTime: 0
  });

  React.useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      setMetrics(prev => ({
        renderCount: prev.renderCount + 1,
        totalRenderTime: prev.totalRenderTime + renderTime,
        averageRenderTime: (prev.totalRenderTime + renderTime) / (prev.renderCount + 1),
        lastRenderTime: renderTime
      }));
    };
  });

  return metrics;
};

// Debounced scroll handler for performance optimization
export const useDebouncedScroll = (callback, delay = 16) => {
  const timeoutRef = React.useRef(null);

  return React.useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
};

export default performanceMetrics;
