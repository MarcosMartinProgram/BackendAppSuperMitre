const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY; // Usar variable de entorno para mayor seguridad
const ADMIN_CODE = "ADMIN123"; // Código especial para crear usuarios "master" o "vendedor"

// Endpoint de login con registro automático
router.post('/login', async (req, res) => {
  const { email, password, nombre } = req.body;
  console.log("Datos recibidos:", { email, password, nombre });

  try {
    let user = await Usuario.findOne({ where: { email } });

    if (!user) {
      if (!nombre) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      user = await Usuario.create({
        nombre,
        email,
        password: hashedPassword,
        rol: 'cliente',
      });

      return res.status(201).json({
        message: 'Usuario creado automáticamente con rol de cliente.',
        user: {
          id: user.id_usuario,
          nombre: user.nombre,
          email: user.email,
          rol: user.rol,
        },
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Contraseña incorrecta.' });
    }

    const token = jwt.sign(
      { id: user.id_usuario, rol: user.rol },
      SECRET_KEY,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: {
        id: user.id_usuario,
        nombre: user.nombre,
        rol: user.rol,
      },
    });
  } catch (error) {
    console.error('Error en el servidor:', error);
    res.status(500).json({ error: 'Error en el servidor.' });
  }
});

// Endpoint para registro manual con roles especiales
router.post('/register', async (req, res) => {
  const { nombre, email, password, rol, adminCode } = req.body;

  try {
    // Validar si ya existe un usuario con el mismo email
    const existingUser = await Usuario.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'El usuario ya existe.' });
    }

    // Validar código de administrador para roles especiales
    let userRole = 'cliente'; // Rol predeterminado
    if (rol === 'master' || rol === 'vendedor') {
      if (adminCode !== ADMIN_CODE) {
        return res.status(403).json({ error: 'Código de administrador inválido.' });
      }
      userRole = rol; // Asignar rol especial
    }

    // Crear hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear el usuario en la base de datos
    const newUser = await Usuario.create({
      nombre,
      email,
      password: hashedPassword,
      rol: userRole,
    });

    res.status(201).json({
      message: 'Usuario registrado exitosamente.',
      user: {
        id: newUser.id_usuario,
        nombre: newUser.nombre,
        email: newUser.email,
        rol: newUser.rol,
      },
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ error: 'Error en el servidor.' });
  }
});

module.exports = router;
