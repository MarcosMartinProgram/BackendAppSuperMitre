const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PedidoOnline = sequelize.define('PedidoOnline', {
  id_pedido: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  mp_payment_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  mp_preference_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  mp_external_reference: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  mp_status: {
    type: DataTypes.STRING(30),
    defaultValue: 'pending',
  },
  cliente_nombre: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  cliente_email: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  cliente_telefono: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  cliente_direccion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  id_usuario: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'usuarios',
      key: 'id_usuario',
    },
  },
  items: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() {
      const raw = this.getDataValue('items');
      try { return JSON.parse(raw); } catch { return raw; }
    },
    set(val) {
      this.setDataValue('items', JSON.stringify(val));
    },
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  estado: {
    type: DataTypes.ENUM('pendiente', 'en_preparacion', 'entregado', 'cancelado'),
    defaultValue: 'pendiente',
  },
  notificado_whatsapp: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  notas: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  origen: {
    type: DataTypes.STRING(30),
    defaultValue: 'web',
    allowNull: false,
  },
}, {
  tableName: 'pedidos_online',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = PedidoOnline;
