// routes/productos.js
const express = require('express');
const router = express.Router();
const Producto = require('../models/Producto');

// ✅ FUNCIÓN HELPER: Calcular precio lista 2
function calcularPrecioLista2(precio1) {
  if (!precio1 || precio1 <= 0) return 0;
  
  const precioConAumento = precio1 * 1.05;
  const precioRedondeado = Math.round(precioConAumento);
  
  // Redondear para que termine en 00 o 50
  const resto = precioRedondeado % 100;
  if (resto < 50) {
    return Math.floor(precioRedondeado / 50) * 50;
  } else {
    return Math.ceil(precioRedondeado / 100) * 100;
  }
}

// ✅ NUEVO: Obtener productos por rubro EXCLUYENDO productos variables para tienda online
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

// ✅ ACTUALIZADO: Crear un nuevo producto con precio_lista2
router.post('/', async (req, res) => {
  const { codigo_barras, nombre, precio, precio_lista2, stock, id_rubro, descripcion, imagen_url, es_variable, precio_base } = req.body;

  if (!codigo_barras || !nombre || !precio || !stock || !id_rubro) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  try {
    // ✅ Si no se proporciona precio_lista2, calcularlo automáticamente
    const precioLista2Final = precio_lista2 || calcularPrecioLista2(precio);

    const nuevoProducto = await Producto.create({ 
      codigo_barras,
      nombre,
      precio,
      precio_lista2: precioLista2Final, // ✅ NUEVO: Segunda lista de precios
      stock,
      id_rubro,
      descripcion,
      imagen_url,
      es_variable: es_variable || false,
      precio_base: precio_base || null
    });

    console.log('✅ Producto creado:', {
      id: nuevoProducto.codigo_barras,
      nombre: nuevoProducto.nombre,
      precio: nuevoProducto.precio,
      precio_lista2: nuevoProducto.precio_lista2
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

// ✅ ACTUALIZADO: Actualizar un producto con precio_lista2
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, precio, precio_lista2, stock, descripcion, imagen_url, id_rubro, es_variable, precio_base } = req.body;

  try {
    const producto = await Producto.findByPk(id);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // ✅ Si se cambió el precio pero no precio_lista2, recalcular
    let precioLista2Final = precio_lista2;
    if (precio !== producto.precio && !precio_lista2) {
      precioLista2Final = calcularPrecioLista2(precio);
    }

    await producto.update({ 
      nombre, 
      precio, 
      precio_lista2: precioLista2Final, // ✅ NUEVO: Actualizar segunda lista
      stock, 
      descripcion, 
      imagen_url, 
      id_rubro,
      es_variable: es_variable !== undefined ? es_variable : producto.es_variable,
      precio_base: precio_base !== undefined ? precio_base : producto.precio_base
    });

    console.log('✅ Producto actualizado:', {
      id: producto.codigo_barras,
      nombre: producto.nombre,
      precio: producto.precio,
      precio_lista2: producto.precio_lista2
    });

    res.status(200).json({ message: 'Producto actualizado con éxito', producto });
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
