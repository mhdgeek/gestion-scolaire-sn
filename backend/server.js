const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connexion MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gestion_scolaire_sn', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/eleves', require('./routes/eleves'));
app.use('/api/classes', require('./routes/classes'));
app.use('/api/notes', require('./routes/notes'));

// Route pour les statistiques
app.get('/api/stats', async (req, res) => {
  try {
    const Eleve = require('./models/Eleve');
    const Classe = require('./models/Classe');
    const Note = require('./models/Note');
    
    const totalEleves = await Eleve.countDocuments();
    const totalClasses = await Classe.countDocuments();
    const totalNotes = await Note.countDocuments();
    
    res.json({ totalEleves, totalClasses, totalNotes });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});

// Route d'importation
app.use('/api/import', require('./routes/import'));

// Servir les fichiers uploads
app.use('/uploads', express.static('uploads'));
// ========== SRE MONITORING ==========
const { setupMetricsMiddleware, trackDBQuery } = require('./monitoring/slo-metrics');

// Initialiser le monitoring
setupMetricsMiddleware(app);

// Exemple d'utilisation pour MongoDB
app.get('/api/students', async (req, res) => {
  const startTime = Date.now();
  try {
    const students = await Student.find();
    trackDBQuery('students', 'find', startTime);
    res.json(students);
  } catch (error) {
    trackDBQuery('students', 'find', startTime);
    res.status(500).json({ error: error.message });
  }
});

// ========== HEALTH CHECKS AVANCÉS ==========
app.get('/health/detailed', async (req, res) => {
  const checks = {
    app: 'healthy',
    database: 'unknown',
    memory: process.memoryUsage(),
    uptime: process.uptime()
  };

  // Vérifier MongoDB
  try {
    await mongoose.connection.db.admin().ping();
    checks.database = 'healthy';
  } catch (error) {
    checks.database = 'unhealthy';
  }

  // Vérifier le disque
  const disk = require('diskusage');
  try {
    const { free, total } = disk.checkSync('/');
    checks.disk = {
      free: Math.round(free / 1024 / 1024) + 'MB',
      total: Math.round(total / 1024 / 1024) + 'MB',
      usage: Math.round((1 - free / total) * 100) + '%'
    };
  } catch (error) {
    checks.disk = 'error';
  }

  const status = checks.database === 'healthy' ? 200 : 503;
  res.status(status).json(checks);
});
