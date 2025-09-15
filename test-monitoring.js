/**
 * Quick test script to verify the monitoring system works
 * Run with: node test-monitoring.js
 */

const {
  getLogger,
  getMetricsCollector,
  getHealthChecker,
  BuiltInHealthChecks,
  initializeMonitoring,
  getMonitoringStatus
} = require('./lib/monitoring');

async function testMonitoringSystem() {
  console.log('🔍 Testing Manthan Monitoring System...\n');

  try {
    // Test logger
    console.log('✅ Testing Logger...');
    const logger = getLogger('test');
    logger.info('Logger test successful');
    logger.warn('Test warning message');
    logger.error('Test error message', new Error('Test error'));

    const logStats = logger.getLogStats();
    console.log(`   - Total logs: ${logStats.totalLogs}`);
    console.log(`   - Logs by level:`, logStats.logsByLevel);

    // Test metrics collector
    console.log('\n✅ Testing Metrics Collector...');
    const metricsCollector = getMetricsCollector();

    // Record test metrics
    metricsCollector.incrementCounter('test_counter', { type: 'demo' }, 5);
    metricsCollector.setGauge('test_gauge', 42.5, { component: 'test' });
    metricsCollector.recordHistogram('test_histogram', 150, { operation: 'test' });

    const allMetrics = metricsCollector.getAllMetrics();
    console.log(`   - Metrics collected: ${Object.keys(allMetrics).length}`);
    console.log(`   - Test counter value: ${metricsCollector.getCounterValue('test_counter')}`);
    console.log(`   - Test gauge value: ${metricsCollector.getLatestGaugeValue('test_gauge')}`);

    // Test health checker
    console.log('\n✅ Testing Health Checker...');
    const healthChecker = getHealthChecker();

    // Register a simple test health check
    const testCheck = {
      name: 'test_component',
      description: 'Test component health check',
      check: async () => ({
        status: 'healthy',
        message: 'Test component is working',
        timestamp: new Date()
      })
    };

    healthChecker.registerCheck(testCheck);

    const checkResult = await healthChecker.runCheck('test_component');
    console.log(`   - Test check status: ${checkResult.status}`);
    console.log(`   - Test check message: ${checkResult.message}`);

    const overallHealth = healthChecker.getOverallHealth();
    console.log(`   - Overall system health: ${overallHealth.status}`);

    // Test monitoring system initialization
    console.log('\n✅ Testing Full System Initialization...');
    const initResult = await initializeMonitoring({
      enableSystemMetrics: true,
      enableAlerting: true,
      enableHealthChecks: true
    });

    console.log(`   - Initialization successful: ${initResult}`);

    // Get monitoring status
    const status = getMonitoringStatus();
    console.log('\n📊 Monitoring System Status:');
    console.log(`   - Timestamp: ${status.timestamp}`);
    if (status.components) {
      console.log(`   - Logger: ${status.components.logger.status} (${status.components.logger.totalLogs} logs)`);
      console.log(`   - Metrics: ${status.components.metrics.status} (${status.components.metrics.metricsCount} metrics)`);
      console.log(`   - Health Checker: ${status.components.healthChecker.status} (${status.components.healthChecker.checksCount} checks, ${status.components.healthChecker.overallHealth})`);
      console.log(`   - Alerting: ${status.components.alerting.status} (${status.components.alerting.rulesCount} rules, ${status.components.alerting.activeAlerts} active alerts)`);
    }

    console.log('\n🎉 All monitoring system tests passed!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Start your Next.js application: npm run dev');
    console.log('   2. Visit the health endpoint: http://localhost:3000/api/health');
    console.log('   3. Access the admin dashboard: http://localhost:3000/admin/monitoring');
    console.log('   4. Check metrics API: http://localhost:3000/api/monitoring/metrics');

  } catch (error) {
    console.error('❌ Monitoring system test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testMonitoringSystem();