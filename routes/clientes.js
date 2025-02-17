const express = require('express');
const Cliente = require('../models/Cliente');
const bcrypt = require('bcryptjs'); // Por si también necesitas crear un usuario
const Usuario = require('../models/Usuario');

const router = express.Router();

// Endpoint para registrar un cliente
router.post('/registrar', async (req, res) => {
  const { nombre, email, direccion, telefono, password } = req.body;

  try {
    // Verificar si el cliente ya existe
    const clienteExistente = await Cliente.findOne({ where: { email } });
    if (clienteExistente) {
      return res.status(400).json({ message: 'El cliente ya está registrado.' });
    }

    // Crear un nuevo usuario asociado al cliente (opcional)
    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevoUsuario = await Usuario.create({
      nombre,
      email,
      password: hashedPassword,
      rol: 'cliente',
    });

    // Crear el cliente
    const nuevoCliente = await Cliente.create({
      nombre,
      email,
      direccion,
      telefono,
      id_usuario: nuevoUsuario.id_usuario,
    });

    res.status(201).json({
      message: 'Cliente registrado exitosamente.',
      cliente: nuevoCliente,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al registrar el cliente.' });
  }
});

module.exports = router;
