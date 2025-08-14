// ✅ NUEVO ARCHIVO: backend/models/MovimientoCuentaCorriente.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MovimientoCuentaCorriente = sequelize.define(
  'MovimientoCuentaCorriente',
  {
    id_movimiento: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_cliente: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'clientes', // ✅ Usar string para evitar referencias circulares
        key: 'id_cliente',
      },
    },
    id_ticket: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'tickets',
        key: 'id_ticket',
      },
    },
    tipo_movimiento: {
      type: DataTypes.ENUM('venta', 'pago', 'entrega_parcial', 'ajuste'),
      allowNull: false,
    },
    monto: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    fecha: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    id_usuario_registro: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'usuarios',
        key: 'id_usuario',
      },
    },
    saldo_anterior: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00,
    },
    saldo_actual: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00,
    },
  },
  {
    timestamps: false,
    tableName: 'movimientos_cuenta_corriente',
  }
);

// ✅ EXPORTAR PRIMERO, ESTABLECER RELACIONES DESPUÉS
module.exports = MovimientoCuentaCorriente;

// ✅ ESTABLECER RELACIONES DESPUÉS DE EXPORTAR (evita referencias circulares)
const Cliente = require('./Cliente');
const Ticket = require('./Ticket');
const Usuario = require('./Usuario');

MovimientoCuentaCorriente.belongsTo(Cliente, { foreignKey: 'id_cliente', as: 'cliente' });
MovimientoCuentaCorriente.belongsTo(Ticket, { foreignKey: 'id_ticket', as: 'ticket' });
MovimientoCuentaCorriente.belongsTo(Usuario, { foreignKey: 'id_usuario_registro', as: 'usuario_registro' });