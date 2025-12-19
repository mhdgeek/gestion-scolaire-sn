// backend/monitoring/slo-metrics.js
const client = require('prom-client');
const collectDefaultMetrics = client.collectDefaultMetrics;

// Collecte les métriques par défaut (CPU, mémoire, etc.)
collectDefaultMetrics({ timeout: 5000 });

// ========== SLO 1 : DISPONIBILITÉ > 99.9% ==========
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 1, 2, 5] // Seuils de latence SLO
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// ========== SLO 2 : LATENCE P95 < 500ms ==========
const latencyBuckets = new client.Histogram({
  name: 'api_latency_seconds',
  help: 'API latency distribution',
  labelNames: ['endpoint'],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2]
});

// ========== SLO 3 : TAUX D'ERREUR < 0.1% ==========
const errorRate = new client.Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP errors',
  labelNames: ['method', 'route', 'status_code', 'error_type']
});

// ========== MÉTRIQUES MONGODB ==========
const dbQueryDuration = new client.Histogram({
  name: 'mongodb_query_duration_seconds',
  help: 'Duration of MongoDB queries',
  labelNames: ['collection', 'operation'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1]
});

// ========== MIDDLEWARE DE TRACKING ==========
const setupMetricsMiddleware = (app) => {
  // Middleware pour tracker toutes les requêtes
  app.use((req, res, next) => {
    const start = Date.now();
    
    // Track la requête
    httpRequestTotal.labels(req.method, req.path).inc();
    
    // Hook sur la fin de la réponse
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      
      // Durée de la requête
      httpRequestDuration
        .labels(req.method, req.path, res.statusCode)
        .observe(duration);
      
      // Latence par endpoint
      latencyBuckets.labels(req.path).observe(duration);
      
      // Erreurs (4xx, 5xx)
      if (res.statusCode >= 400) {
        const errorType = res.statusCode >= 500 ? 'server' : 'client';
        errorRate.labels(req.method, req.path, res.statusCode, errorType).inc();
      }
    });
    
    next();
  });
  
  // Endpoint /metrics pour Prometheus
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', client.register.contentType);
      const metrics = await client.register.metrics();
      res.end(metrics);
    } catch (error) {
      res.status(500).end(`Error generating metrics: ${error.message}`);
    }
  });
  
  // Endpoint /health avec métriques détaillées
  app.get('/health', (req, res) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      metrics: {
        total_requests: httpRequestTotal.hashMap[''].value || 0,
        error_rate: (errorRate.hashMap['']?.value || 0) / Math.max(httpRequestTotal.hashMap['']?.value || 1, 1)
      }
    };
    res.json(health);
  });
};

// ========== FONCTIONS UTILITAIRES ==========
const trackDBQuery = (collection, operation, startTime) => {
  const duration = (Date.now() - startTime) / 1000;
  dbQueryDuration.labels(collection, operation).observe(duration);
};

// Calcul du SLO (Service Level Objective)
const calculateSLO = () => {
  const totalRequests = httpRequestTotal.hashMap['']?.value || 0;
  const totalErrors = errorRate.hashMap['']?.value || 0;
  
  if (totalRequests === 0) return 1.0; // 100% si aucune requête
  
  const availability = 1 - (totalErrors / totalRequests);
  return availability;
};

module.exports = {
  setupMetricsMiddleware,
  trackDBQuery,
  calculateSLO,
  metrics: client
};
