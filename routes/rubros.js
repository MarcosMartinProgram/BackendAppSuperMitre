// /routes/rubros.js
const express = require('express');
const router = express.Router();
const Rubro = require('../models/Rubro'); // Importamos el modelo de Rubro

// Obtener todos los rubros
router.get('/', async (req, res) => {
  try {
    const rubros = await Rubro.findAll(); // Método de Sequelize para obtener todos los registros
    res.status(200).json(rubros);
  } catch (error) {
    console.error('Error al obtener rubros:', error.message);
    res.status(500).json({ error: 'Error al obtener rubros' });
  }
});

// Crear un nuevo rubro
router.post('/', async (req, res) => {
  const { nombre } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre del rubro es obligatorio' });
  }

  try {
    const nuevoRubro = await Rubro.create({ nombre }); // Método de Sequelize para insertar
    res.status(201).json({
      message: 'Rubro creado con éxito',
      id: nuevoRubro.id_rubro,
    });
  } catch (error) {
    console.error('Error al crear rubro:', error.message);
    res.status(500).json({ error: 'Error al crear el rubro' });
  }
});

// Editar un rubro
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre del rubro es obligatorio' });
  }

  try {
    const rubro = await Rubro.findByPk(id); // Busca el rubro por ID
    if (!rubro) {
      return res.status(404).json({ error: 'Rubro no encontrado' });
    }

    await rubro.update({ nombre }); // Actualiza el registro
    res.status(200).json({ message: 'Rubro actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar rubro:', error.message);
    res.status(500).json({ error: 'Error al actualizar rubro' });
  }
});

// Eliminar un rubro
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const rubro = await Rubro.findByPk(id); // Busca el rubro por ID
    if (!rubro) {
      return res.status(404).json({ error: 'Rubro no encontrado' });
    }

    await rubro.destroy(); // Elimina el registro
    res.status(200).json({ message: 'Rubro eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar rubro:', error.message);
    res.status(500).json({ error: 'Error al eliminar rubro' });
  }
});

module.exports = router;
