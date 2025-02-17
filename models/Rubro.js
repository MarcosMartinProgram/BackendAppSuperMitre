// /models/Rubro.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Asegúrate de que apunta a Sequelize

const Rubro = sequelize.define('Rubro', {
  id_rubro: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
}, {
  tableName: 'rubros',
  timestamps: false, // Si no tienes columnas createdAt y updatedAt
});

module.exports = Rubro;
