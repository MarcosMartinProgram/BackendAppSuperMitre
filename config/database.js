const { Sequelize } = require('sequelize');
require('dotenv').config();


const sequelize = new Sequelize(
  process.env.DB_NAME, // Nombre de la base de datos
  process.env.DB_USER, // Usuario de la base de datos
  process.env.DB_PASSWORD, // Contraseña
  {
    host: process.env.DB_HOST, // Dirección del servidor
    dialect: 'mysql',
    logging: false, // Para evitar logs extensos
  }
);

module.exports = sequelize;
