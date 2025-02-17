const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Usuario = sequelize.define('Usuario', {
  id_usuario: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  rol: {
    type: DataTypes.ENUM('master', 'vendedor', 'cliente'),
    defaultValue: 'vendedor',
  },
  fecha_registro: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'usuarios_app', // Especificar el nombre exacto de la tabla
  timestamps: false, // Si no tienes columnas createdAt/updatedAt
});
Usuario.associate = (models) => {
  Usuario.hasMany(models.Ticket, { foreignKey: 'usuario_id' });
};

module.exports = Usuario;
