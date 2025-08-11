// /models|Producto.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Producto = sequelize.define('Producto', {
    codigo_barras: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      allowNull: false
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    precio: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    precio_lista2: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    id_rubro: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    imagen_url: {  
      type: DataTypes.TEXT,
      allowNull: true
    },
    es_variable: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    precio_base: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'productos',
    timestamps: false,
    hooks: {
      // ✅ HOOK: Auto-calcular precio_lista2 antes de crear/actualizar
      beforeSave: (producto) => {
        if (producto.precio && (!producto.precio_lista2 || producto.precio_lista2 === 0)) {
          const precioConAumento = producto.precio * 1.05;
          const precioRedondeado = Math.round(precioConAumento);
          
          // Redondear para que termine en 00 o 50
          const resto = precioRedondeado % 100;
          if (resto < 50) {
            producto.precio_lista2 = Math.floor(precioRedondeado / 50) * 50;
          } else {
            producto.precio_lista2 = Math.ceil(precioRedondeado / 100) * 100;
          }
        }
      }
    }
  });
  
  Producto.associate = (models) => {
    Producto.hasMany(models.Ticket, { foreignKey: 'producto_id' });
  };

module.exports = Producto;
