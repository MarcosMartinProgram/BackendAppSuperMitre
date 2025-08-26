// /index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sequelize = require('./config/database');
const Usuario = require('./models/Usuario');
const Ticket = require('./models/Ticket');
const Producto = require('./models/Producto');
// ✅ AGREGAR LOS NUEVOS MODELOS
const Cliente = require('./models/Cliente');
const MovimientoCuentaCorriente = require('./models/MovimientoCuentaCorriente');

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

// ✅ LOGGING DE REQUESTS (temporal para debug)
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} desde ${req.headers.origin || 'sin origin'}`);
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
// ✅ AGREGAR esta línea para las rutas de envío
app.use('/api/tickets', require('./routes/envioTickets'));

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
      establecerRelaciones();
    } catch (error) {
      console.error('❌ Error al verificar tablas:', error.message);
      establecerRelaciones();
    }
  })
  .catch((err) => {
    console.error('❌ Error al conectar a la base de datos:', err);
    // ✅ AGREGAR ESTA LÍNEA QUE FALTA:
    establecerRelaciones();
  });
  

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
// ✅ ESTABLECER RELACIONES SIN DUPLICADOS
const establecerRelaciones = () => {
  try {
    console.log('🔗 Estableciendo relaciones de base de datos...');
    
    // ✅ VERIFICAR SI LAS RELACIONES YA EXISTEN ANTES DE CREARLAS
    
    // Relación Cliente -> Tickets (si no existe)
    if (!Cliente.associations.tickets) {
      Cliente.hasMany(Ticket, { foreignKey: 'id_cliente', as: 'tickets' });
    }
    
    // Relación Cliente -> Movimientos (si no existe)
    if (!Cliente.associations.movimientos) {
      Cliente.hasMany(MovimientoCuentaCorriente, { foreignKey: 'id_cliente', as: 'movimientos' });
    }

    // Relación Ticket -> Cliente (si no existe)
    if (!Ticket.associations.cliente) {
      Ticket.belongsTo(Cliente, { foreignKey: 'id_cliente', as: 'cliente' });
    }
    
    // Relación Ticket -> Usuario/Vendedor (si no existe)
    if (!Ticket.associations.vendedor) {
      Ticket.belongsTo(Usuario, { foreignKey: 'id_vendedor', as: 'vendedor' });
    }

    // Relación MovimientoCuentaCorriente -> Cliente (si no existe)
    if (!MovimientoCuentaCorriente.associations.cliente) {
      MovimientoCuentaCorriente.belongsTo(Cliente, { foreignKey: 'id_cliente', as: 'cliente' });
    }
    
    // Relación MovimientoCuentaCorriente -> Ticket (si no existe)
    if (!MovimientoCuentaCorriente.associations.ticket) {
      MovimientoCuentaCorriente.belongsTo(Ticket, { foreignKey: 'id_ticket', as: 'ticket' });
    }
    
    // Relación MovimientoCuentaCorriente -> Usuario (si no existe)
    if (!MovimientoCuentaCorriente.associations.usuario_registro) {
      MovimientoCuentaCorriente.belongsTo(Usuario, { foreignKey: 'id_usuario_registro', as: 'usuario_registro' });
    }

    // Relación Usuario -> Tickets vendidos (si no existe y con alias único)
    if (!Usuario.associations.tickets_vendidos) {
      Usuario.hasMany(Ticket, { foreignKey: 'id_vendedor', as: 'tickets_vendidos' });
    }
    
    // Relación Usuario -> Movimientos registrados (si no existe)
    if (!Usuario.associations.movimientos_registrados) {
      Usuario.hasMany(MovimientoCuentaCorriente, { foreignKey: 'id_usuario_registro', as: 'movimientos_registrados' });
    }

    console.log('✅ Relaciones de base de datos establecidas correctamente');
    
  } catch (error) {
    console.error('❌ Error al establecer relaciones:', error.message);
    console.log('⚠️  Continuando sin establecer todas las relaciones...');
  }
};

// Sincronizar base de datos
/*sequelize.sync({ force: false }) // Cambiar a true solo para desarrollo
  then(() => {
    console.log('✅ Modelos sincronizados con la base de datos.');
    // ✅ ESTABLECER RELACIONES DESPUÉS DE SINCRONIZAR
    establecerRelaciones();
  })
  .catch((err) => {
    console.error('❌ Error al sincronizar la base de datos:', err);
    // ✅ CONTINUAR EJECUTANDO AUNQUE FALLE LA SINCRONIZACIÓN
    console.log('⚠️  Continuando sin sincronización automática...');
    establecerRelaciones();
  });*/

// Levantar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🔗 API disponible en: http://localhost:${PORT}`);
  console.log("🔐 Variables de entorno:");
  console.log("- DB_HOST:", process.env.DB_HOST ? "✅" : "❌");
  console.log("- MP_ACCESS_TOKEN:", process.env.MP_ACCESS_TOKEN ? "✅" : "❌");
  console.log("- SECRET_KEY:", process.env.SECRET_KEY ? "✅" : "❌");
  console.log('🌍 CORS habilitado para:', corsOptions.origin);
});

// Manejo de errores globales
process.on('uncaughtException', (error) => {
  console.error('💥 Excepción no capturada:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Promesa rechazada no manejada:', reason);
});
