const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Usuario = require('./Usuario'); // Si hay relación entre clientes y usuarios

const Cliente = sequelize.define(
  'Cliente',
  {
    id_cliente: {
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
    },
    direccion: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    telefono: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: true, // Relación opcional con usuario
      references: {
        model: Usuario,
        key: 'id_usuario',
      },
    },
  },
  {
    timestamps: false,
    tableName: 'clientes',
  }
);

// Establecer relación (si aplica)
Cliente.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario' });

module.exports = Cliente;
