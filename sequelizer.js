const sequelize = require('./config/database');

sequelize.authenticate()
  .then(() => console.log("✅ Conexión exitosa a la base de datos"))
  .catch(err => console.error("❌ Error al conectar:", err));
