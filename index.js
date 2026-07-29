require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const Usuario = require('./models/Usuario');
const Ticket = require('./models/Ticket');
const Producto = require('./models/Producto');
const Cliente = require('./models/Cliente');
const MovimientoCuentaCorriente = require('./models/MovimientoCuentaCorriente');
const PedidoOnline = require('./models/PedidoOnline');

const mercadoPagoRoutes = require('./routes/mercadoPagoRoutes');
const clienteRoutes = require('./routes/clientes');
const authRoutes = require('./routes/auth');
const productosRoutes = require('./routes/productos');
const rubrosRouter = require('./routes/rubros');
const ticketRoutes = require('./routes/tickets');
const reportesRoutes = require('./routes/reportes');
const imagenAndroidRoutes = require("./routes/imagenAndroidRoutes");
const pedidosOnlineRoutes = require('./routes/pedidosOnline');
const facturacionRoutes = require('./routes/facturacion');

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'http://localhost:3000',
  'https://www.supermitre.com.ar',
  'https://supermitre.com.ar',
  'https://cacmarcos.alwaysdata.net'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Origen no permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'Cache-Control'],
  maxAge: 86400
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/rubros', rubrosRouter);
app.use('/api/tickets', ticketRoutes);
app.use('/api/reportes', reportesRoutes);
app.use("/api/mercadopago", mercadoPagoRoutes);
app.use("/api/imagenAndroid", imagenAndroidRoutes);
app.use("/api/pedidos-online", pedidosOnlineRoutes);
app.use("/api/facturacion", facturacionRoutes);

app.get('/api/test-cors', (req, res) => {
  res.json({
    message: 'CORS funcionando correctamente',
    origin: req.headers.origin,
    timestamp: new Date().toISOString(),
    allowedOrigins
  });
});

sequelize
  .authenticate()
  .then(async () => {
    console.log('Conexión a la base de datos exitosa.');
    try {
      const tablas = await sequelize.getQueryInterface().showAllTables();
      if (tablas.includes('clientes')) {
        const countClientes = await Cliente.count();
        console.log(`Clientes en BD: ${countClientes}`);
      }
    } catch (error) {
      console.error('Error al verificar tablas:', error.message);
    }
  })
  .catch((err) => {
    console.error('Error al conectar a la base de datos:', err.message);
  });

app.get('/', (req, res) => {
  res.json({
    message: 'API funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

app.get("/success", (req, res) => { res.send("Pago exitoso"); });
app.get("/failure", (req, res) => { res.send("Pago fallido"); });
app.get("/pending", (req, res) => { res.send("Pago pendiente"); });

function establecerRelaciones() {
  try {
    if (!Cliente.associations.tickets) {
      Cliente.hasMany(Ticket, { foreignKey: 'id_cliente', as: 'tickets' });
    }
    if (!Cliente.associations.movimientos) {
      Cliente.hasMany(MovimientoCuentaCorriente, { foreignKey: 'id_cliente', as: 'movimientos' });
    }
    if (!Ticket.associations.cliente) {
      Ticket.belongsTo(Cliente, { foreignKey: 'id_cliente', as: 'cliente' });
    }
    if (!Ticket.associations.vendedor) {
      Ticket.belongsTo(Usuario, { foreignKey: 'id_vendedor', as: 'vendedor' });
    }
    if (!MovimientoCuentaCorriente.associations.cliente) {
      MovimientoCuentaCorriente.belongsTo(Cliente, { foreignKey: 'id_cliente', as: 'cliente' });
    }
    if (!MovimientoCuentaCorriente.associations.ticket) {
      MovimientoCuentaCorriente.belongsTo(Ticket, { foreignKey: 'id_ticket', as: 'ticket' });
    }
    if (!MovimientoCuentaCorriente.associations.usuario_registro) {
      MovimientoCuentaCorriente.belongsTo(Usuario, { foreignKey: 'id_usuario_registro', as: 'usuario_registro' });
    }
    if (!Usuario.associations.tickets_vendidos) {
      Usuario.hasMany(Ticket, { foreignKey: 'id_vendedor', as: 'tickets_vendidos' });
    }
    if (!Usuario.associations.movimientos_registrados) {
      Usuario.hasMany(MovimientoCuentaCorriente, { foreignKey: 'id_usuario_registro', as: 'movimientos_registrados' });
    }
    console.log('Relaciones de base de datos establecidas');
  } catch (error) {
    console.error('Error al establecer relaciones:', error.message);
  }
}

sequelize.sync({ force: false })
  .then(() => {
    console.log('Modelos sincronizados con la base de datos.');
    establecerRelaciones();
  })
  .catch((err) => {
    console.error('Error al sincronizar la base de datos:', err.message);
    establecerRelaciones();
  });

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

process.on('uncaughtException', (error) => {
  console.error('Excepción no capturada:', error.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('Promesa rechazada no manejada:', reason.message || reason);
});
