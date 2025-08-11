const { Sequelize } = require('sequelize');
const config = require('./config/environment'); // ✅ Usar configuración dinámica

const sequelize = new Sequelize(
  config.DB_NAME,
  config.DB_USER, 
  config.DB_PASSWORD,
  {
    host: config.DB_HOST,
    port: config.DB_PORT,
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      connectTimeout: 60000,
    }
  }
);

module.exports = sequelize;
