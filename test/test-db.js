// test-db.js (temporal)
require('dotenv').config();
const { Sequelize } = require('sequelize');
const config = require('../config/environment');

const sequelize = new Sequelize(
  config.DB_NAME,
  config.DB_USER,
  config.DB_PASSWORD,
  {
    host: config.DB_HOST,
    port: config.DB_PORT,
    dialect: 'mysql',
    logging: console.log
  }
);

async function testConnection() {
  try {
    console.log('🔄 Conectando a base de datos de producción...');
    console.log('📍 Host:', config.DB_HOST);
    console.log('🗄️ Database:', config.DB_NAME);
    
    await sequelize.authenticate();
    console.log('✅ Conexión exitosa');
    
    const [results] = await sequelize.query('SELECT * FROM usuarios LIMIT 3');
    console.log(`✅ Tabla usuarios: ${results.length} registros encontrados`);
    
    if (results.length > 0) {
      console.log('👤 Usuarios ejemplo:');
      results.forEach(user => {
        console.log(`- ${user.nombre} (${user.email}) - Rol: ${user.rol}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

testConnection();