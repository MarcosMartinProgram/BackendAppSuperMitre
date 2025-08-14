// ✅ NUEVO ARCHIVO: backend/models/MovimientoCuentaCorriente.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Cliente = require('./Cliente');
const Ticket = require('./Ticket');
const Usuario = require('./Usuario');

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
        model: Cliente,
        key: 'id_cliente',
      },
    },
    id_ticket: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Ticket,
        key: 'id_ticket',
      },
    },
    tipo_movimiento: {
      type: DataTypes.ENUM('venta', 'pago', 'entrega', 'ajuste'),
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
        model: Usuario,
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

// ✅ ESTABLECER RELACIONES
MovimientoCuentaCorriente.belongsTo(Cliente, { foreignKey: 'id_cliente', as: 'cliente' });
MovimientoCuentaCorriente.belongsTo(Ticket, { foreignKey: 'id_ticket', as: 'ticket' });
MovimientoCuentaCorriente.belongsTo(Usuario, { foreignKey: 'id_usuario_registro', as: 'usuario_registro' });

module.exports = MovimientoCuentaCorriente;