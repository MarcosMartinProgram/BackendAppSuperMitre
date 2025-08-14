// models/Cliente.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Usuario = require('./Usuario');

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
      unique: true,
    },
    direccion: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    telefono: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    saldo_cuenta_corriente: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00,
    },
    limite_credito: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00,
    },
    es_cuenta_corriente: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    fecha_creacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: true,
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

Cliente.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario' });

module.exports = Cliente;
