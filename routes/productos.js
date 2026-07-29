const express = require('express');
const router = express.Router();
const Producto = require('../models/Producto');
const { verificarToken, verificarRol } = require('../middleware/authMiddleware');

function calcularPrecioLista2(precio1) {
  if (!precio1 || precio1 <= 0) return 0;
  const precioConAumento = precio1 * 1.05;
  const precioRedondeado = Math.round(precioConAumento);
  const resto = precioRedondeado % 100;
  if (resto < 50) {
    return Math.floor(precioRedondeado / 50) * 50;
  } else {
    return Math.ceil(precioRedondeado / 100) * 100;
  }
}

router.get('/por-rubro/:id_rubro', async (req, res) => {
  const { id_rubro } = req.params;
  const { incluir_variables } = req.query;

  try {
    const whereClause = { id_rubro };

    if (!incluir_variables || incluir_variables === 'false') {
      whereClause.es_variable = false;
    }

    const productos = await Producto.findAll({
      where: whereClause,
    });
    res.status(200).json(productos);
  } catch (error) {
    console.error('Error al obtener productos por rubro:', error.message);
    res.status(500).json({ error: 'Error al obtener productos por rubro' });
  }
});

router.get('/variables', async (req, res) => {
  try {
    const productos = await Producto.findAll({
      where: { es_variable: true },
    });
    res.status(200).json(productos);
  } catch (error) {
    console.error('Error al obtener productos variables:', error.message);
    res.status(500).json({ error: 'Error al obtener productos variables' });
  }
});

router.post('/', verificarToken, verificarRol('master', 'vendedor'), async (req, res) => {
  const { codigo_barras, nombre, precio, precio_lista2, stock, id_rubro, descripcion, imagen_url, es_variable, precio_base } = req.body;

  if (!codigo_barras || !nombre || !precio || !stock || !id_rubro) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  try {
    const precioLista2Final = precio_lista2 || calcularPrecioLista2(precio);

    const nuevoProducto = await Producto.create({
      codigo_barras,
      nombre,
      precio,
      precio_lista2: precioLista2Final,
      stock,
      id_rubro,
      descripcion,
      imagen_url,
      es_variable: es_variable || false,
      precio_base: precio_base || null
    });

    res.status(201).json({
      message: 'Producto creado con éxito',
      id: nuevoProducto.codigo_barras,
      producto: nuevoProducto
    });
  } catch (error) {
    console.error('Error al crear producto:', error.message);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

router.put('/:id', verificarToken, verificarRol('master', 'vendedor'), async (req, res) => {
  const { id } = req.params;
  const { nombre, precio, precio_lista2, stock, descripcion, imagen_url, id_rubro, es_variable, precio_base } = req.body;

  try {
    const producto = await Producto.findByPk(id);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    let precioLista2Final = precio_lista2;
    if (precio !== producto.precio && !precio_lista2) {
      precioLista2Final = calcularPrecioLista2(precio);
    }

    await producto.update({
      nombre,
      precio,
      precio_lista2: precioLista2Final,
      stock,
      descripcion,
      imagen_url,
      id_rubro,
      es_variable: es_variable !== undefined ? es_variable : producto.es_variable,
      precio_base: precio_base !== undefined ? precio_base : producto.precio_base
    });

    res.status(200).json({ message: 'Producto actualizado con éxito', producto });
  } catch (error) {
    console.error('Error al actualizar producto:', error.message);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

router.get('/', async (req, res) => {
  const { incluir_variables } = req.query;

  try {
    const whereClause = {};

    if (incluir_variables === 'false') {
      whereClause.es_variable = false;
    } else if (incluir_variables === 'true') {
      whereClause.es_variable = true;
    }

    const productos = await Producto.findAll({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined
    });
    res.status(200).json(productos);
  } catch (error) {
    console.error('Error al obtener los productos:', error);
    res.status(500).json({ error: 'Error al obtener los productos' });
  }
});

router.delete('/:id', verificarToken, verificarRol('master'), async (req, res) => {
  const { id } = req.params;

  try {
    const producto = await Producto.findByPk(id);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    await producto.destroy();
    res.status(200).json({ message: 'Producto eliminado con éxito' });
  } catch (error) {
    console.error('Error al eliminar producto:', error.message);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

router.get('/:codigo_barras', async (req, res) => {
  const { codigo_barras } = req.params;

  try {
    const producto = await Producto.findOne({
      where: { codigo_barras },
    });

    if (producto) {
      res.status(200).json(producto);
    } else {
      res.status(404).json({ error: 'Producto no encontrado' });
    }
  } catch (error) {
    console.error('Error al buscar el producto:', error);
    res.status(500).json({ error: 'Error al buscar el producto' });
  }
});

module.exports = router;
