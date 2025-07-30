// routes/productos.js
const express = require('express');
const router = express.Router();
const Producto = require('../models/Producto');

// ✅ NUEVO: Obtener productos por rubro EXCLUYENDO productos variables para tienda online
router.get('/por-rubro/:id_rubro', async (req, res) => {
  const { id_rubro } = req.params;
  const { incluir_variables } = req.query; // Parámetro para incluir productos variables

  try {
    const whereClause = { id_rubro };
    
    // Si no se especifica incluir_variables, excluir productos variables
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

// ✅ NUEVO: Obtener SOLO productos variables para el POS
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

// Crear un nuevo producto
router.post('/', async (req, res) => {
  const { codigo_barras, nombre, precio, stock, id_rubro, descripcion, imagen_url, es_variable, precio_base } = req.body;

  if (!codigo_barras || !nombre || !precio || !stock || !id_rubro) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  try {
    const nuevoProducto = await Producto.create({ 
      codigo_barras,
      nombre,
      precio,
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
    });
  } catch (error) {
    console.error('Error al crear producto:', error.message);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// Actualizar un producto
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, precio, stock, descripcion, imagen_url, id_rubro, es_variable, precio_base } = req.body;

  try {
    const producto = await Producto.findByPk(id);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    await producto.update({ 
      nombre, 
      precio, 
      stock, 
      descripcion, 
      imagen_url, 
      id_rubro,
      es_variable: es_variable !== undefined ? es_variable : producto.es_variable,
      precio_base: precio_base !== undefined ? precio_base : producto.precio_base
    });
    res.status(200).json({ message: 'Producto actualizado con éxito' });
  } catch (error) {
    console.error('Error al actualizar producto:', error.message);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

// Obtener todos los productos (para gestión)
router.get('/', async (req, res) => {
  const { incluir_variables } = req.query;
  
  try {
    const whereClause = {};
    
    // Filtrar productos variables si se especifica
    if (incluir_variables === 'false') {
      whereClause.es_variable = false;
    } else if (incluir_variables === 'true') {
      whereClause.es_variable = true;
    }
    // Si no se especifica, traer todos
    
    const productos = await Producto.findAll({ 
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined 
    });
    res.status(200).json(productos);
  } catch (error) {
    console.error('Error al obtener los productos:', error);
    res.status(500).json({ error: 'Error al obtener los productos' });
  }
});

// Eliminar un producto
router.delete('/:id', async (req, res) => {
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

// Obtener un producto por código de barras
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
