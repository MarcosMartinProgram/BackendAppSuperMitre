const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Licencia = sequelize.define('Licencia', {
  id_licencia: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  license_key: {
    type: DataTypes.STRING(128),
    allowNull: false,
    unique: true,
  },
  hwid: {
    type: DataTypes.STRING(64),
    allowNull: true,
    defaultValue: null,
  },
  client_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'licencias',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Licencia;
