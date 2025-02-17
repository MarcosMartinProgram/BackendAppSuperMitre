const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

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
}, {
  tableName: 'tickets',
  timestamps: false,
});

Ticket.associate = (models) => {
  Ticket.belongsTo(models.Usuario, { foreignKey: 'usuario_id' });
  Ticket.belongsTo(models.Producto, { foreignKey: 'producto_id' });
};

module.exports = Ticket;