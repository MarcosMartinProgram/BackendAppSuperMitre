const { Sequelize } = require('sequelize');

const DB_HOST = process.env.DB_HOST || 'cacmarcos.alwaysdata.net';
const DB_NAME = process.env.DB_NAME || 'cacmarcos_supermitre';
const DB_USER = process.env.DB_USER || 'cacmarcos_admin';
const DB_PASSWORD = process.env.DB_PASSWORD || 'Supermitre2025!';

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: 3306,
  dialect: 'mysql',
  logging: false,
});

async function migrate() {
  try {
    console.log('🔍 Conectando a:', DB_HOST, DB_NAME, DB_USER);
    await sequelize.authenticate();
    console.log('✅ Conectado a la base de datos');

    // Verificar valores actuales del ENUM
    const [result] = await sequelize.query(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = '${DB_NAME}' 
      AND TABLE_NAME = 'tickets' 
      AND COLUMN_NAME = 'tipo_pago'
    `);
    
    console.log('📋 ENUM actual:', result[0]?.COLUMN_TYPE);

    // Alterar ENUM con todos los valores necesarios
    await sequelize.query(`
      ALTER TABLE tickets 
      MODIFY COLUMN tipo_pago ENUM(
        'contado', 
        'cuenta_corriente', 
        'contado_parcial', 
        'cuenta_corriente_parcial', 
        'mercadopago_qr'
      ) DEFAULT 'contado'
    `);

    console.log('✅ ENUM actualizado exitosamente');
    
    // Verificar cambios
    const [nuevo] = await sequelize.query(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = '${DB_NAME}' 
      AND TABLE_NAME = 'tickets' 
      AND COLUMN_NAME = 'tipo_pago'
    `);
    
    console.log('📋 ENUM nuevo:', nuevo[0]?.COLUMN_TYPE);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

migrate();
