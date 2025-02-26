// /index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sequelize = require('./config/database');
const Usuario = require('./models/Usuario');
const Ticket = require('./models/Ticket');
const Producto = require('./models/Producto');
const mercadoPagoRoutes = require("./routes/mercadoPagoRoutes");

const clienteRoutes = require('./routes/clientes');
const authRoutes = require('./routes/auth');
const productosRoutes = require('./routes/productos');
const rubrosRouter = require('./routes/rubros'); // Asegúrate de importar correctamente
const ticketRoutes = require('./routes/tickets');
const productoRoutes = require('./routes/productos');
const reportesRoutes = require('./routes/reportes');
const imagenesRoutes = require("./routes/imagenes");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/rubros', rubrosRouter);
app.use('/api/tickets', ticketRoutes);
//app.use('/api/productos', productoRoutes);
app.use('/api/reportes', reportesRoutes);
app.use("/api/mercadopago", mercadoPagoRoutes);
app.use("/api/imagenes", imagenesRoutes);

// Verificar conexión a la base de datos
sequelize
  .authenticate()
  .then(() => console.log('Conexión a la base de datos exitosa.'))
  .catch((err) => console.error('Error al conectar a la base de datos:', err));


 // Rutas principales
app.get('/', (req, res) => {
  res.send('API funcionando correctamente.');
});


// Rutas para back_urls
app.get("/success", (req, res) => {
  res.send("Pago exitoso");
});

app.get("/failure", (req, res) => {
  res.send("Pago fallido");
});

app.get("/pending", (req, res) => {
  res.send("Pago pendiente");
});

// Sincronizar base de datos (una sola vez)
sequelize.sync({ alter: true }) // Usa `alter: true` para actualizar o crear tablas sin perder datos
  .then(() => console.log('Modelos sincronizados con la base de datos.'))
  .catch((err) => console.error('Error al sincronizar la base de datos:', err));

// Levantar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
