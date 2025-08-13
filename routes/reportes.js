// routes/reportes.js
const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');

// ✅ Reporte: Ventas por vendedor 
router.get('/ventas-por-vendedor', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    
    let whereClause = '';
    if (fechaInicio && fechaFin) {
      whereClause = `WHERE DATE(t.fecha) BETWEEN '${fechaInicio}' AND '${fechaFin}'`;
    } else {
      whereClause = `WHERE t.fecha >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`;
    }

    const query = `
      SELECT 
        COALESCE(u.nombre, 'Sistema') as vendedor,
        COUNT(t.id_ticket) as cantidadVentas,
        ROUND(SUM(t.total), 2) as totalVentas,
        ROUND(AVG(t.total), 2) as promedioVenta
      FROM tickets t
      LEFT JOIN usuarios u ON t.id_vendedor = u.id_usuario
      ${whereClause}
      GROUP BY t.id_vendedor, u.nombre
      ORDER BY totalVentas DESC
    `;

    const resultados = await sequelize.query(query, { type: QueryTypes.SELECT });
    
    console.log('✅ Ventas por vendedor:', resultados.length, 'registros');
    res.json(resultados);

  } catch (error) {
    console.error('❌ Error ventas-por-vendedor:', error);
    res.status(500).json({ 
      error: 'Error al generar reporte de ventas por vendedor',
      details: error.message 
    });
  }
});

// ✅ Reporte: Ventas por cliente
router.get('/ventas-por-usuario', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    
    let whereClause = '';
    if (fechaInicio && fechaFin) {
      whereClause = `WHERE DATE(fecha) BETWEEN '${fechaInicio}' AND '${fechaFin}'`;
    } else {
      whereClause = `WHERE fecha >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`;
    }

    const query = `
      SELECT 
        'Cliente Genérico' as usuario,
        COUNT(*) as cantidadCompras,
        ROUND(SUM(total), 2) as totalVentas,
        ROUND(AVG(total), 2) as promedioCompra
      FROM tickets
      ${whereClause}
      HAVING COUNT(*) > 0
      ORDER BY totalVentas DESC
    `;

    const resultados = await sequelize.query(query, { type: QueryTypes.SELECT });
    
    console.log('✅ Ventas por usuario:', resultados.length, 'registros');
    res.json(resultados);

  } catch (error) {
    console.error('❌ Error ventas-por-usuario:', error);
    res.status(500).json({ 
      error: 'Error al generar reporte de ventas por usuario',
      details: error.message 
    });
  }
});

// ✅ Reporte: Productos más vendidos (desde JSON de tickets)
router.get('/productos-mas-vendidos', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    
    let whereClause = '';
    if (fechaInicio && fechaFin) {
      whereClause = `WHERE DATE(fecha) BETWEEN '${fechaInicio}' AND '${fechaFin}'`;
    } else {
      whereClause = `WHERE fecha >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`;
    }

    // Obtener todos los tickets del periodo
    const queryTickets = `
      SELECT id_ticket, productos, total, fecha
      FROM tickets 
      ${whereClause}
      ORDER BY fecha DESC
    `;

    const tickets = await sequelize.query(queryTickets, { type: QueryTypes.SELECT });
    
    // Procesar los productos desde el JSON
    const productosVendidos = {};
    
    tickets.forEach(ticket => {
      try {
        if (ticket.productos) {
          const productos = JSON.parse(ticket.productos);
          
          if (Array.isArray(productos)) {
            productos.forEach(producto => {
              const codigo = producto.codigo_barras || producto.codigo;
              const nombre = producto.nombre || 'Producto sin nombre';
              const cantidad = producto.cantidad || 1;
              const precio = producto.precio || 0;
              
              if (!productosVendidos[codigo]) {
                productosVendidos[codigo] = {
                  producto: nombre,
                  codigo_barras: codigo,
                  cantidadVendida: 0,
                  totalVendido: 0,
                  precioPromedio: precio
                };
              }
              
              productosVendidos[codigo].cantidadVendida += cantidad;
              productosVendidos[codigo].totalVendido += (cantidad * precio);
              productosVendidos[codigo].precioPromedio = 
                productosVendidos[codigo].totalVendido / productosVendidos[codigo].cantidadVendida;
            });
          }
        }
      } catch (parseError) {
        console.error('Error parseando productos del ticket:', ticket.id_ticket, parseError);
      }
    });

    // Convertir a array y ordenar
    const resultados = Object.values(productosVendidos)
      .sort((a, b) => b.cantidadVendida - a.cantidadVendida)
      .slice(0, 20)
      .map(item => ({
        ...item,
        totalVendido: Math.round(item.totalVendido * 100) / 100,
        precioPromedio: Math.round(item.precioPromedio * 100) / 100
      }));

    console.log('✅ Productos más vendidos:', resultados.length, 'productos');
    res.json(resultados);

  } catch (error) {
    console.error('❌ Error productos-mas-vendidos:', error);
    res.status(500).json({ 
      error: 'Error al generar reporte de productos más vendidos',
      details: error.message 
    });
  }
});

// ✅ Reporte: Ventas por rubro (desde JSON + productos)
router.get('/ventas-por-rubro', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    
    let whereClause = '';
    if (fechaInicio && fechaFin) {
      whereClause = `WHERE DATE(fecha) BETWEEN '${fechaInicio}' AND '${fechaFin}'`;
    } else {
      whereClause = `WHERE fecha >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`;
    }

    // Obtener tickets
    const queryTickets = `
      SELECT productos FROM tickets ${whereClause}
    `;
    const tickets = await sequelize.query(queryTickets, { type: QueryTypes.SELECT });
    
    // Obtener información de rubros
    const queryRubros = `
      SELECT p.codigo_barras, r.nombre as rubro_nombre
      FROM productos p
      LEFT JOIN rubros r ON p.id_rubro = r.id_rubro
    `;
    const productosRubros = await sequelize.query(queryRubros, { type: QueryTypes.SELECT });
    
    // Crear mapa de productos a rubros
    const mapaRubros = {};
    productosRubros.forEach(item => {
      mapaRubros[item.codigo_barras] = item.rubro_nombre || 'Sin rubro';
    });

    // Procesar ventas por rubro
    const ventasPorRubro = {};
    
    tickets.forEach(ticket => {
      try {
        if (ticket.productos) {
          const productos = JSON.parse(ticket.productos);
          
          if (Array.isArray(productos)) {
            productos.forEach(producto => {
              const codigo = producto.codigo_barras || producto.codigo;
              const cantidad = producto.cantidad || 1;
              const precio = producto.precio || 0;
              const rubro = mapaRubros[codigo] || 'Sin rubro';
              
              if (!ventasPorRubro[rubro]) {
                ventasPorRubro[rubro] = {
                  rubro: rubro,
                  cantidadProductos: 0,
                  totalVendido: 0,
                  unidadesVendidas: 0
                };
              }
              
              ventasPorRubro[rubro].cantidadProductos += 1;
              ventasPorRubro[rubro].totalVendido += (cantidad * precio);
              ventasPorRubro[rubro].unidadesVendidas += cantidad;
            });
          }
        }
      } catch (parseError) {
        console.error('Error parseando productos para rubros:', parseError);
      }
    });

    // Convertir a array y ordenar
    const resultados = Object.values(ventasPorRubro)
      .sort((a, b) => b.totalVendido - a.totalVendido)
      .map(item => ({
        ...item,
        totalVendido: Math.round(item.totalVendido * 100) / 100
      }));

    console.log('✅ Ventas por rubro:', resultados.length, 'rubros');
    res.json(resultados);

  } catch (error) {
    console.error('❌ Error ventas-por-rubro:', error);
    res.status(500).json({ 
      error: 'Error al generar reporte de ventas por rubro',
      details: error.message 
    });
  }
});

// ✅ Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const queries = {
      ventasHoy: `
        SELECT 
          COUNT(*) as ventas, 
          COALESCE(SUM(total), 0) as total
        FROM tickets 
        WHERE DATE(fecha) = CURDATE()
      `,
      ventasMes: `
        SELECT 
          COUNT(*) as ventas, 
          COALESCE(SUM(total), 0) as total
        FROM tickets 
        WHERE MONTH(fecha) = MONTH(CURDATE()) 
        AND YEAR(fecha) = YEAR(CURDATE())
      `,
      productosStock: `
        SELECT 
          COUNT(*) as total, 
          COUNT(CASE WHEN stock > 0 THEN 1 END) as conStock,
          COUNT(CASE WHEN stock <= 5 THEN 1 END) as stockBajo
        FROM productos
      `,
      clientesActivos: `
        SELECT COUNT(*) as clientes
        FROM tickets 
        WHERE fecha >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `,
      ventasUltimos7Dias: `
        SELECT 
          DATE(fecha) as fecha,
          COUNT(*) as ventas,
          ROUND(SUM(total), 2) as total
        FROM tickets
        WHERE fecha >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(fecha)
        ORDER BY fecha DESC
      `,
      ticketPromedio: `
        SELECT 
          ROUND(AVG(total), 2) as promedio,
          MAX(total) as maximo,
          MIN(total) as minimo
        FROM tickets
        WHERE fecha >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `
    };

    const dashboard = {};
    
    for (const [key, query] of Object.entries(queries)) {
      try {
        const resultado = await sequelize.query(query, { type: QueryTypes.SELECT });
        
        if (key === 'ventasUltimos7Dias') {
          dashboard[key] = resultado;
        } else {
          dashboard[key] = resultado[0] || {};
        }
        
      } catch (queryError) {
        console.error(`❌ Error en query ${key}:`, queryError);
        dashboard[key] = key === 'ventasUltimos7Dias' ? [] : {};
      }
    }

    console.log('📊 Dashboard generado exitosamente');
    res.json(dashboard);

  } catch (error) {
    console.error('❌ Error en dashboard:', error);
    res.status(500).json({ 
      error: 'Error al generar dashboard',
      details: error.message 
    });
  }
});

// ✅ Test
router.get('/test', async (req, res) => {
  try {
    const testQuery = `
      SELECT 
        id_ticket,
        fecha,
        total,
        descuento,
        LEFT(productos, 100) as productos_preview
      FROM tickets 
      ORDER BY fecha DESC 
      LIMIT 5
    `;
    
    const resultados = await sequelize.query(testQuery, { type: QueryTypes.SELECT });

    res.json({
      mensaje: 'Test de reportes - Estructura de tickets',
      timestamp: new Date().toISOString(),
      ticketsEjemplo: resultados,
      totalTablas: {
        tickets: await sequelize.query('SELECT COUNT(*) as total FROM tickets', { type: QueryTypes.SELECT }),
        productos: await sequelize.query('SELECT COUNT(*) as total FROM productos', { type: QueryTypes.SELECT }),
        usuarios: await sequelize.query('SELECT COUNT(*) as total FROM usuarios', { type: QueryTypes.SELECT })
      }
    });

  } catch (error) {
    console.error('❌ Error en test:', error);
    res.status(500).json({ error: 'Error en test de reportes' });
  }
});

module.exports = router;