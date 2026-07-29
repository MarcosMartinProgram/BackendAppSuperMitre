const { Sequelize } = require('sequelize');

const DB_HOST = process.env.DB_HOST;
const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;

if (!DB_HOST || !DB_NAME || !DB_USER || !DB_PASSWORD === undefined) {
  console.error('❌ Faltan variables de entorno: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD');
  process.exit(1);
}

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: 3306,
  dialect: 'mysql',
  logging: false,
});

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a la base de datos');

    const [result] = await sequelize.query(
      `SELECT COLUMN_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = :dbName
       AND TABLE_NAME = 'tickets'
       AND COLUMN_NAME = 'tipo_pago'`,
      { replacements: { dbName: DB_NAME } }
    );

    console.log('ENUM actual:', result[0]?.COLUMN_TYPE);

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

    console.log('ENUM actualizado exitosamente');

    const [nuevo] = await sequelize.query(
      `SELECT COLUMN_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = :dbName
       AND TABLE_NAME = 'tickets'
       AND COLUMN_NAME = 'tipo_pago'`,
      { replacements: { dbName: DB_NAME } }
    );

    console.log('ENUM nuevo:', nuevo[0]?.COLUMN_TYPE);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

migrate();
