// /index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sequelize = require('./config/database');
const Usuario = require('./models/Usuario');
const Ticket = require('./models/Ticket');
const Producto = require('./models/Producto');
const mercadoPagoRoutes = require('./routes/mercadoPagoRoutes');

const clienteRoutes = require('./routes/clientes');
const authRoutes = require('./routes/auth');
const productosRoutes = require('./routes/productos');
const rubrosRouter = require('./routes/rubros');
const ticketRoutes = require('./routes/tickets');
const productoRoutes = require('./routes/productos');
const reportesRoutes = require('./routes/reportes');
const imagenAndroidRoutes = require("./routes/imagenAndroidRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ CONFIGURACIÓN CORS CORREGIDA
const corsOptions = {
  origin: [
    'http://localhost:3000',           // Desarrollo local
    'https://www.supermitre.com.ar',   // Tu dominio con www
    'https://supermitre.com.ar',       // Tu dominio sin www
    'https://cacmarcos.alwaysdata.net' // Tu API
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With', 
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control'
  ]
};

// ✅ APLICAR CORS CON OPCIONES
app.use(cors(corsOptions));

// ✅ MIDDLEWARE ADICIONAL PARA CORS MANUAL
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'https://www.supermitre.com.ar',
    'https://supermitre.com.ar',
    'https://cacmarcos.alwaysdata.net'
  ];

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // ✅ MANEJAR PREFLIGHT REQUESTS
  if (req.method === 'OPTIONS') {
    console.log('🔄 Preflight request desde:', origin);
    res.status(200).end();
    return;
  }

  next();
});

// ✅ LOGGING MEJORADO DE REQUESTS
app.use((req, res, next) => {
  const start = Date.now();
  
  console.log(`📨 ${req.method} ${req.path}`);
  console.log(`   Origin: ${req.headers.origin || 'sin origin'}`);
  console.log(`   User-Agent: ${req.headers['user-agent'] || 'sin user-agent'}`);
  
  // ✅ LOG CUANDO LA REQUEST TERMINE
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusIcon = status >= 400 ? '❌' : '✅';
    
    console.log(`${statusIcon} ${req.method} ${req.path} - ${status} (${duration}ms)`);
  });
  
  next();
});

// Middleware de parseo
app.use(bodyParser.json());
app.use(express.json());

// Log de configuración CORS
console.log('🌐 CORS configurado para dominios:');
corsOptions.origin.forEach(origin => console.log(`  ✅ ${origin}`));

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/rubros', rubrosRouter);
app.use('/api/tickets', ticketRoutes);
app.use('/api/reportes', reportesRoutes);
app.use("/api/mercadopago", mercadoPagoRoutes);
app.use("/api/imagenAndroid", imagenAndroidRoutes);

// ✅ RUTA DE PRUEBA CORS
app.get('/api/test-cors', (req, res) => {
  res.json({ 
    message: 'CORS funcionando correctamente', 
    origin: req.headers.origin,
    timestamp: new Date().toISOString(),
    allowedOrigins: corsOptions.origin
  });
});

// Verificar conexión a la base de datos
sequelize
  .authenticate()
  .then(async () => {
    console.log('✅ Conexión a la base de datos exitosa.');
    
    // ✅ VERIFICAR TABLAS IMPORTANTES
    try {
      const tablas = await sequelize.getQueryInterface().showAllTables();
      console.log('📊 Tablas disponibles:', tablas);
      
      if (tablas.includes('clientes')) {
        const countClientes = await Cliente.count();
        console.log(`👥 Total de clientes en la base de datos: ${countClientes}`);
      } else {
        console.log('⚠️  Tabla "clientes" no encontrada');
      }
    } catch (error) {
      console.error('❌ Error al verificar tablas:', error.message);
    }
  })
  .catch((err) => console.error('❌ Error al conectar a la base de datos:', err));

// Rutas principales
app.get('/', (req, res) => {
  res.json({
    message: 'API funcionando correctamente',
    timestamp: new Date().toISOString(),
    cors: 'Configurado para múltiples dominios'
  });
});

// Rutas para back_urls de MercadoPago
app.get("/success", (req, res) => {
  res.send("Pago exitoso");
});

app.get("/failure", (req, res) => {
  res.send("Pago fallido");
});

app.get("/pending", (req, res) => {
  res.send("Pago pendiente");
});

// ✅ ESTABLECER TODAS LAS RELACIONES DESPUÉS DE IMPORTAR TODOS LOS MODELOS
const Cliente = require('./models/Cliente');
const Ticket = require('./models/Ticket');
const MovimientoCuentaCorriente = require('./models/MovimientoCuentaCorriente');
const Usuario = require('./models/Usuario');

// Establecer relaciones
Cliente.hasMany(Ticket, { foreignKey: 'id_cliente', as: 'tickets' });
Cliente.hasMany(MovimientoCuentaCorriente, { foreignKey: 'id_cliente', as: 'movimientos' });

Ticket.belongsTo(Cliente, { foreignKey: 'id_cliente', as: 'cliente' });
Ticket.belongsTo(Usuario, { foreignKey: 'id_vendedor', as: 'vendedor' });

MovimientoCuentaCorriente.belongsTo(Cliente, { foreignKey: 'id_cliente', as: 'cliente' });
MovimientoCuentaCorriente.belongsTo(Ticket, { foreignKey: 'id_ticket', as: 'ticket' });
MovimientoCuentaCorriente.belongsTo(Usuario, { foreignKey: 'id_usuario_registro', as: 'usuario_registro' });

Usuario.hasMany(Ticket, { foreignKey: 'id_vendedor', as: 'tickets_vendidos' });

// Sincronizar base de datos
sequelize.sync({ alter: true })
  .then(() => console.log('✅ Modelos sincronizados con la base de datos.'))
  .catch((err) => console.error('❌ Error al sincronizar la base de datos:', err));

// Levantar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🔗 API disponible en: https://cacmarcos.alwaysdata.net`);
  console.log("🔐 Variables de entorno:");
  console.log("- DB_HOST:", process.env.DB_HOST ? "✅" : "❌");
  console.log("- MP_ACCESS_TOKEN:", process.env.MP_ACCESS_TOKEN ? "✅" : "❌");
  console.log("- SECRET_KEY:", process.env.SECRET_KEY ? "✅" : "❌");
});

// Manejo de errores globales
process.on('uncaughtException', (error) => {
  console.error('💥 Excepción no capturada:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Promesa rechazada no manejada:', reason);
});
