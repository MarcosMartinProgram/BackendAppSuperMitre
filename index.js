// /index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');

const app = express();

// ✅ CONFIGURACIÓN CORS ESPECÍFICA Y SIMPLIFICADA
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'https://www.supermitre.com.ar',
    'https://supermitre.com.ar'
  ];

  console.log(`🔄 Request: ${req.method} ${req.path} from ${origin || 'no-origin'}`);

  // ✅ PERMITIR ORIGIN SI ESTÁ EN LA LISTA O NO HAY ORIGIN
  if (!origin || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 horas

  // ✅ RESPONDER INMEDIATAMENTE A OPTIONS
  if (req.method === 'OPTIONS') {
    console.log('✅ Preflight response sent');
    return res.status(200).end();
  }

  next();
});

// ✅ MIDDLEWARE BÁSICO
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ RUTA DE PRUEBA CORS
app.get('/api/test-cors', (req, res) => {
  res.json({ 
    message: 'CORS funcionando', 
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

// ✅ TUS RUTAS (mantener como están)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/reportes', require('./routes/reportes'));

// Resto de tu configuración...
sequelize
  .authenticate()
  .then(() => {
    console.log('✅ Conexión a la base de datos exitosa.');
  })
  .catch((err) => console.error('❌ Error al conectar a la base de datos:', err));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
  console.log('🌍 CORS configurado para:', [
    'http://localhost:3000',
    'https://www.supermitre.com.ar',
    'https://supermitre.com.ar'
  ]);
});
