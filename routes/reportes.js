const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');
const { verificarToken, verificarRol } = require('../middleware/authMiddleware');

function validarFecha(fecha) {
  if (!fecha) return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  return regex.test(fecha) && !isNaN(Date.parse(fecha));
}

router.get('/ventas-por-vendedor', verificarToken, verificarRol('master', 'vendedor'), async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    let query, replacements;

    if (fechaInicio && fechaFin) {
      if (!validarFecha(fechaInicio) || !validarFecha(fechaFin)) {
        return res.status(400).json({ error: 'Formato de fecha inválido (YYYY-MM-DD)' });
      }
      query = `
        SELECT
          COALESCE(u.nombre, 'Sistema') as vendedor,
          COUNT(t.id_ticket) as cantidadVentas,
          ROUND(SUM(t.total), 2) as totalVentas,
          ROUND(AVG(t.total), 2) as promedioVenta
        FROM tickets t
        LEFT JOIN usuarios u ON t.id_vendedor = u.id_usuario
        WHERE DATE(t.fecha) BETWEEN :fechaInicio AND :fechaFin
        GROUP BY t.id_vendedor, u.nombre
        ORDER BY totalVentas DESC
      `;
      replacements = { fechaInicio, fechaFin };
    } else {
      query = `
        SELECT
          COALESCE(u.nombre, 'Sistema') as vendedor,
          COUNT(t.id_ticket) as cantidadVentas,
          ROUND(SUM(t.total), 2) as totalVentas,
          ROUND(AVG(t.total), 2) as promedioVenta
        FROM tickets t
        LEFT JOIN usuarios u ON t.id_vendedor = u.id_usuario
        WHERE t.fecha >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
        GROUP BY t.id_vendedor, u.nombre
        ORDER BY totalVentas DESC
      `;
      replacements = {};
    }

    const resultados = await sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements
    });

    res.json(resultados);

  } catch (error) {
    console.error('Error ventas-por-vendedor:', error);
    res.status(500).json({ error: 'Error al generar reporte de ventas por vendedor' });
  }
});

router.get('/ventas-por-usuario', verificarToken, verificarRol('master', 'vendedor'), async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    let query, replacements;

    if (fechaInicio && fechaFin) {
      if (!validarFecha(fechaInicio) || !validarFecha(fechaFin)) {
        return res.status(400).json({ error: 'Formato de fecha inválido (YYYY-MM-DD)' });
      }
      query = `
        SELECT
          'Cliente Genérico' as usuario,
          COUNT(*) as cantidadCompras,
          ROUND(SUM(total), 2) as totalVentas,
          ROUND(AVG(total), 2) as promedioCompra
        FROM tickets
        WHERE DATE(fecha) BETWEEN :fechaInicio AND :fechaFin
        HAVING COUNT(*) > 0
        ORDER BY totalVentas DESC
      `;
      replacements = { fechaInicio, fechaFin };
    } else {
      query = `
        SELECT
          'Cliente Genérico' as usuario,
          COUNT(*) as cantidadCompras,
          ROUND(SUM(total), 2) as totalVentas,
          ROUND(AVG(total), 2) as promedioCompra
        FROM tickets
        WHERE fecha >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
        HAVING COUNT(*) > 0
        ORDER BY totalVentas DESC
      `;
      replacements = {};
    }

    const resultados = await sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements
    });

    res.json(resultados);

  } catch (error) {
    console.error('Error ventas-por-usuario:', error);
    res.status(500).json({ error: 'Error al generar reporte de ventas por usuario' });
  }
});

router.get('/productos-mas-vendidos', verificarToken, verificarRol('master', 'vendedor'), async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    let whereClause, replacements;

    if (fechaInicio && fechaFin) {
      if (!validarFecha(fechaInicio) || !validarFecha(fechaFin)) {
        return res.status(400).json({ error: 'Formato de fecha inválido (YYYY-MM-DD)' });
      }
      whereClause = 'WHERE DATE(fecha) BETWEEN :fechaInicio AND :fechaFin';
      replacements = { fechaInicio, fechaFin };
    } else {
      whereClause = 'WHERE fecha >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
      replacements = {};
    }

    const queryTickets = `
      SELECT id_ticket, productos, total, fecha
      FROM tickets
      ${whereClause}
      ORDER BY fecha DESC
    `;

    const tickets = await sequelize.query(queryTickets, {
      type: QueryTypes.SELECT,
      replacements
    });

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
        console.error('Error parseando productos del ticket:', ticket.id_ticket, parseError.message);
      }
    });

    const resultados = Object.values(productosVendidos)
      .sort((a, b) => b.cantidadVendida - a.cantidadVendida)
      .slice(0, 20)
      .map(item => ({
        ...item,
        totalVendido: Math.round(item.totalVendido * 100) / 100,
        precioPromedio: Math.round(item.precioPromedio * 100) / 100
      }));

    res.json(resultados);

  } catch (error) {
    console.error('Error productos-mas-vendidos:', error);
    res.status(500).json({ error: 'Error al generar reporte de productos más vendidos' });
  }
});

router.get('/ventas-por-rubro', verificarToken, verificarRol('master', 'vendedor'), async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    let whereClause, replacements;

    if (fechaInicio && fechaFin) {
      if (!validarFecha(fechaInicio) || !validarFecha(fechaFin)) {
        return res.status(400).json({ error: 'Formato de fecha inválido (YYYY-MM-DD)' });
      }
      whereClause = 'WHERE DATE(fecha) BETWEEN :fechaInicio AND :fechaFin';
      replacements = { fechaInicio, fechaFin };
    } else {
      whereClause = 'WHERE fecha >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
      replacements = {};
    }

    const queryTickets = `
      SELECT productos FROM tickets ${whereClause}
    `;
    const tickets = await sequelize.query(queryTickets, {
      type: QueryTypes.SELECT,
      replacements
    });

    const queryRubros = `
      SELECT p.codigo_barras, r.nombre as rubro_nombre
      FROM productos p
      LEFT JOIN rubros r ON p.id_rubro = r.id_rubro
    `;
    const productosRubros = await sequelize.query(queryRubros, { type: QueryTypes.SELECT });

    const mapaRubros = {};
    productosRubros.forEach(item => {
      mapaRubros[item.codigo_barras] = item.rubro_nombre || 'Sin rubro';
    });

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
        console.error('Error parseando productos para rubros:', parseError.message);
      }
    });

    const resultados = Object.values(ventasPorRubro)
      .sort((a, b) => b.totalVendido - a.totalVendido)
      .map(item => ({
        ...item,
        totalVendido: Math.round(item.totalVendido * 100) / 100
      }));

    res.json(resultados);

  } catch (error) {
    console.error('Error ventas-por-rubro:', error);
    res.status(500).json({ error: 'Error al generar reporte de ventas por rubro' });
  }
});

router.get('/dashboard', verificarToken, verificarRol('master', 'vendedor'), async (req, res) => {
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
        console.error(`Error en query ${key}:`, queryError.message);
        dashboard[key] = key === 'ventasUltimos7Dias' ? [] : {};
      }
    }

    res.json(dashboard);

  } catch (error) {
    console.error('Error en dashboard:', error);
    res.status(500).json({ error: 'Error al generar dashboard' });
  }
});

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
    console.error('Error en test:', error);
    res.status(500).json({ error: 'Error en test de reportes' });
  }
});

router.get('/productos-por-rubro', verificarToken, verificarRol('master', 'vendedor'), async (req, res) => {
  try {
    const { incluir_sin_stock, ordenar_por } = req.query;

    let whereClause = '';
    let replacements = {};

    if (incluir_sin_stock !== 'true') {
      whereClause = 'WHERE p.stock > 0';
    }

    let orderBy = 'ORDER BY r.nombre ASC, p.nombre ASC';
    if (ordenar_por === 'precio_asc') {
      orderBy = 'ORDER BY r.nombre ASC, p.precio ASC';
    } else if (ordenar_por === 'precio_desc') {
      orderBy = 'ORDER BY r.nombre ASC, p.precio DESC';
    } else if (ordenar_por === 'stock') {
      orderBy = 'ORDER BY r.nombre ASC, p.stock DESC';
    }

    const query = `
      SELECT
        r.nombre as rubro,
        r.id_rubro,
        p.codigo_barras,
        p.nombre as producto,
        p.precio as precio_lista1,
        COALESCE(p.precio_lista2, ROUND(p.precio * 1.05 / 50, 0) * 50) as precio_lista2,
        p.stock,
        p.descripcion,
        p.es_variable,
        p.precio_base
      FROM productos p
      LEFT JOIN rubros r ON p.id_rubro = r.id_rubro
      ${whereClause}
      ${orderBy}
    `;

    const productos = await sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements
    });

    const productosPorRubro = {};
    let totalProductos = 0;
    let valorInventarioLista1 = 0;
    let valorInventarioLista2 = 0;

    productos.forEach(producto => {
      const rubro = producto.rubro || 'Sin Rubro';

      if (!productosPorRubro[rubro]) {
        productosPorRubro[rubro] = {
          id_rubro: producto.id_rubro,
          nombre: rubro,
          productos: [],
          totalProductos: 0,
          valorRubroLista1: 0,
          valorRubroLista2: 0
        };
      }

      const valorLista1 = (producto.precio_lista1 || 0) * (producto.stock || 0);
      const valorLista2 = (producto.precio_lista2 || 0) * (producto.stock || 0);

      productosPorRubro[rubro].productos.push({
        ...producto,
        valorStockLista1: valorLista1,
        valorStockLista2: valorLista2
      });

      productosPorRubro[rubro].totalProductos += 1;
      productosPorRubro[rubro].valorRubroLista1 += valorLista1;
      productosPorRubro[rubro].valorRubroLista2 += valorLista2;

      totalProductos += 1;
      valorInventarioLista1 += valorLista1;
      valorInventarioLista2 += valorLista2;
    });

    const resultado = {
      rubros: Object.values(productosPorRubro),
      resumen: {
        totalRubros: Object.keys(productosPorRubro).length,
        totalProductos: totalProductos,
        valorInventarioLista1: Math.round(valorInventarioLista1 * 100) / 100,
        valorInventarioLista2: Math.round(valorInventarioLista2 * 100) / 100
      },
      fechaGeneracion: new Date().toISOString()
    };

    res.json(resultado);

  } catch (error) {
    console.error('Error en productos-por-rubro:', error);
    res.status(500).json({ error: 'Error al generar listado de productos por rubro' });
  }
});

router.get('/productos-imprimir', verificarToken, verificarRol('master', 'vendedor'), async (req, res) => {
  try {
    const { lista_precios = '1' } = req.query;

    const query = `
      SELECT
        COALESCE(r.nombre, 'Sin Rubro') as rubro,
        p.codigo_barras,
        p.nombre as producto,
        p.precio as precio_lista1,
        COALESCE(p.precio_lista2, ROUND(p.precio * 1.05 / 50, 0) * 50) as precio_lista2,
        p.stock
      FROM productos p
      LEFT JOIN rubros r ON p.id_rubro = r.id_rubro
      WHERE p.stock >= 0
      ORDER BY r.nombre ASC, p.nombre ASC
    `;

    const productos = await sequelize.query(query, { type: QueryTypes.SELECT });

    const rubros = {};
    productos.forEach(producto => {
      const nombreRubro = producto.rubro;
      if (!rubros[nombreRubro]) {
        rubros[nombreRubro] = [];
      }
      rubros[nombreRubro].push(producto);
    });

    const resultado = {
      rubros: Object.keys(rubros).sort().map(nombre => ({
        nombre,
        productos: rubros[nombre]
      })),
      listaSeleccionada: lista_precios,
      fechaImpresion: new Date().toLocaleDateString('es-AR'),
      horaImpresion: new Date().toLocaleTimeString('es-AR')
    };

    res.json(resultado);

  } catch (error) {
    console.error('Error en productos-imprimir:', error);
    res.status(500).json({ error: 'Error al generar listado para impresión' });
  }
});

module.exports = router;
