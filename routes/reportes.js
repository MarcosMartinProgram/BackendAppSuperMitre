// routes/reportes.js
const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket'); // Asegúrate de importar el modelo de Ticket
const sequelize = require('../config/database');
const Usuario = require('../models/Usuario');
const Producto = require('../models/Producto');
const Rubro = require('../models/Rubro');



// Reporte de ventas por vendedor
router.get('/ventas-por-vendedor', async (req, res) => {
    try {
      const ventasPorVendedor = await Ticket.findAll({
        attributes: [
          'id_vendedor',
          [sequelize.fn('SUM', sequelize.col('total')), 'totalVentas'],
        ],
        group: ['id_vendedor'],
        include: [
          {
            model: Usuario, // Asegúrate de importar el modelo Usuario
            as: 'vendedor',
            attributes: ['nombre'],
          },
        ],
      });
      console.log('Ventas por vendedor:', ventasPorVendedor);
      res.status(200).json(ventasPorVendedor);
    } catch (error) {
      console.error('Error al obtener ventas por vendedor:', error);
      res.status(500).json({ error: 'Error al obtener ventas por vendedor' });
    }
  });
// Reporte de ventas por usuario comprador
router.get('/ventas-por-usuario', async (req, res) => {
    try {
      const ventasPorUsuario = await Ticket.findAll({
        attributes: [
          'id_usuario',
          [sequelize.fn('SUM', sequelize.col('total')), 'totalVentas'],
        ],
        group: ['id_usuario'],
        include: [
          {
            model: Usuario, // Asegúrate de importar el modelo Usuario
            as: 'usuario',
            attributes: ['nombre'],
          },
        ],
      });
      console.log('Ventas por usuario:', ventasPorUsuario); // Agrega un log para depurar

      res.status(200).json(ventasPorUsuario);
    } catch (error) {
      console.error('Error al obtener ventas por usuario:', error);
      res.status(500).json({ error: 'Error al obtener ventas por usuario' });
    }
  });

  // Reporte de ventas por rubros
  router.get('/ventas-por-rubro', async (req, res) => {
    try {
      const ventasPorRubro = await Ticket.findAll({
        attributes: [
          [sequelize.literal('"producto"."id_rubro"'), 'id_rubro'],
          [sequelize.fn('SUM', sequelize.literal('"productos"."cantidad"')), 'totalVentas'],
        ],
        include: [
          {
            model: Producto, // Asegúrate de importar el modelo Producto
            as: 'producto',
            attributes: [],
            include: [
              {
                model: Rubro, // Asegúrate de importar el modelo Rubro
                as: 'rubro',
                attributes: ['nombre'],
              },
            ],
          },
        ],
        group: ['producto.id_rubro'],
      });
      res.status(200).json(ventasPorRubro);
    } catch (error) {
      console.error('Error al obtener ventas por rubro:', error);
      res.status(500).json({ error: 'Error al obtener ventas por rubro' });
    }
  });

  // Reporte de productos más vendidos
  router.get('/productos-mas-vendidos', async (req, res) => {
    try {
      const productosMasVendidos = await Ticket.findAll({
        attributes: [
          [sequelize.literal('"productos"."id_producto"'), 'id_producto'],
          [sequelize.fn('SUM', sequelize.literal('"productos"."cantidad"')), 'totalVendido'],
        ],
        include: [
          {
            model: Producto, // Asegúrate de importar el modelo Producto
            as: 'producto',
            attributes: ['nombre'],
          },
        ],
        group: ['productos.id_producto'],
        order: [[sequelize.literal('totalVendido'), 'DESC']],
      });
      res.status(200).json(productosMasVendidos);
    } catch (error) {
      console.error('Error al obtener productos más vendidos:', error);
      res.status(500).json({ error: 'Error al obtener productos más vendidos' });
    }
  });

module.exports = router;