require('dotenv').config();
const sequelize = require('./config/database');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a la base de datos');

    // Verificar valores actuales del ENUM
    const [result] = await sequelize.query(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' 
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
      WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' 
      AND TABLE_NAME = 'tickets' 
      AND COLUMN_NAME = 'tipo_pago'
    `);
    
    console.log('📋 ENUM nuevo:', nuevo[0]?.COLUMN_TYPE);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

migrate();
