require('dotenv').config();
const { Sequelize } = require('sequelize');

console.log('🔍 Configuración de base de datos:');
console.log('- DB_HOST:', process.env.DB_HOST);
console.log('- DB_NAME:', process.env.DB_NAME);
console.log('- DB_USER:', process.env.DB_USER);
console.log('- DB_PASSWORD:', process.env.DB_PASSWORD ? '✅ CONFIGURADA' : '❌ NO CONFIGURADA');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: 3306, // ✅ PUERTO FIJO 3306 para MySQL (no usar process.env.PORT)
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
