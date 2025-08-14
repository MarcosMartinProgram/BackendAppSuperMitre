// /models/Ticket.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Cliente = require('./Cliente');
const Usuario = require('./Usuario');

const Ticket = sequelize.define('Ticket', {
  id_ticket: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  fecha: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  productos: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  descuento: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  // ✅ AGREGADO: Campos para cliente y tipo de pago
  id_cliente: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Cliente,
      key: 'id_cliente',
    },
  },
  tipo_pago: {
    type: DataTypes.ENUM('contado', 'cuenta_corriente'),
    defaultValue: 'contado',
  },
  id_vendedor: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Usuario,
      key: 'id_usuario',
    },
  },
  // ✅ AGREGADO: Campos adicionales para el control de pagos
  pago_recibido: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  vuelto: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  entrega: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
}, {
  tableName: 'tickets',
  timestamps: false,
});

// ✅ RELACIONES
Ticket.belongsTo(Cliente, { foreignKey: 'id_cliente', as: 'cliente' });
Ticket.belongsTo(Usuario, { foreignKey: 'id_vendedor', as: 'vendedor' });

module.exports = Ticket;