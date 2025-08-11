// backend/models/Usuario.js
const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Usuario = sequelize.define('Usuario', {
  id_usuario: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.TEXT, // ✅ Importante: TEXT para passwords hasheadas
    allowNull: false
  },
  rol: {
    type: DataTypes.ENUM('cliente', 'vendedor', 'master'),
    defaultValue: 'cliente',
    allowNull: false
  },
  numero_whatsapp: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  direccion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  fecha_registro: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'usuarios',
  timestamps: false, // ✅ Importante: Desactivar timestamps automáticos
});

module.exports = Usuario;
