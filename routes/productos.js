const express = require('express');
const router = express.Router();
const Producto = require('../models/Producto'); // Importamos el modelo de Producto

// Obtener productos por rubro
router.get('/por-rubro/:id_rubro', async (req, res) => {
  const { id_rubro } = req.params;

  try {
    const productos = await Producto.findAll({
      where: { id_rubro }, // Filtra los productos por id_rubro
    });
    res.status(200).json(productos);
  } catch (error) {
    console.error('Error al obtener productos por rubro:', error.message);
    res.status(500).json({ error: 'Error al obtener productos por rubro' });
  }
});

// Crear un nuevo producto
router.post('/', async (req, res) => {
  const { codigo_barras, nombre, precio, stock, id_rubro, descripcion } = req.body;

  if (!codigo_barras || !nombre || !precio || !stock || !id_rubro) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  try {
    const nuevoProducto = await Producto.create({ codigo_barras,
      nombre,
      precio,
      stock,
      id_rubro,
      descripcion });
    res.status(201).json({
      message: 'Producto creado con éxito',
      id: nuevoProducto.id,
    });
  } catch (error) {
    console.error('Error al crear producto:', error.message);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// Actualizar un producto
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, precio, stock, descripcion } = req.body;

  try {
    const producto = await Producto.findByPk(id); // Busca el producto por ID
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    await producto.update({ nombre, precio, stock, descripcion });
    res.status(200).json({ message: 'Producto actualizado con éxito' });
  } catch (error) {
    console.error('Error al actualizar producto:', error.message);
    res.status(500).json({ error: 'Error al actualizar producto' });
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

// Obtener todos los productos
router.get('/', async (req, res) => {
  //const { nombre } = req.params;
  try {
    const productos = await Producto.findAll(); // Usa tu método para obtener todos los productos
    res.status(200).json(productos);
  } catch (error) {
    console.error('Error al obtener los productos:', error);
    res.status(500).json({ error: 'Error al obtener los productos' });
  }
});
router.get('/productos', async (req, res) => {
  const { rubroId } = req.query;

  try {
      const productos = await Producto.findAll({
          where: { rubroId }
      });
      res.json(productos);
  } catch (error) {
      console.error('Error al obtener productos:', error);
      res.status(500).json({ error: 'Error en el servidor.' });
  }
});

module.exports = router;
