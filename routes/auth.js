// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY; // Usar variable de entorno para mayor seguridad
const ADMIN_CODE = "ADMIN123"; // Código especial para crear usuarios "master" o "vendedor"
console.log("SECRET_KEY:", SECRET_KEY);
// Endpoint de login con registro automático
router.post('/login', async (req, res) => {
  const { email, password, nombre, numero_whatsapp, direccion } = req.body;
  console.log("Datos recibidos en /login:", {
    email,
    password,
    nombre,
    numero_whatsapp,
    direccion,
  });
  try {
    let user = await Usuario.findOne({ where: { email } });

    if (!user) {
      if (!nombre) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      console.log("Creando nuevo usuario con los siguientes datos:", {
        nombre,
        email,
        password: hashedPassword,
        rol: 'cliente',
        numero_whatsapp,
        direccion,
      });

      user = await Usuario.create({
        nombre,
        email,
        password: hashedPassword,
        rol: 'cliente',
        numero_whatsapp, // Agregar estos campos
        direccion
      });
      console.log("Usuario creado:", user); // Agrega este log para ver el usuario creado

      return res.status(201).json({
        message: 'Usuario creado automáticamente con rol de cliente.',
        user: {
          id: user.id_usuario,
          nombre: user.nombre,
          email: user.email,
          rol: user.rol,
          numero_whatsapp: user.numero_whatsapp,
          direccion: user.direccion,
        },
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Contraseña incorrecta.' });
    }
    console.log("Valor de SECRET_KEY:", SECRET_KEY);


    const token = jwt.sign(
      { id: user.id_usuario, email: user.email, rol: user.rol },
      process.env.SECRET_KEY,
      { expiresIn: '1h' }
    );
    console.log("Valor de SECRET_KEY:", SECRET_KEY);


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
  const { nombre, email, password, rol, adminCode, numero_whatsapp, direccion } = req.body;

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
      userRole = rol;
    }

    // Crear hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear el usuario en la base de datos
    const newUser = await Usuario.create({
      nombre,
      email,
      password: hashedPassword,
      rol: userRole,
      numero_whatsapp,
      direccion
    });

    // **Generar token JWT**
    const token = jwt.sign(
      { id: newUser.id_usuario, email: newUser.email, rol: newUser.rol },
      process.env.SECRET_KEY,  // Usa una variable de entorno para la clave secreta
      { expiresIn: "1h" }  // Expira en 1 hora
    );

    // Respuesta con el usuario y el token
    res.status(201).json({
      message: 'Usuario registrado exitosamente.',
      user: {
        id: newUser.id_usuario,
        nombre: newUser.nombre,
        email: newUser.email,
        rol: newUser.rol,
        numero_whatsapp: newUser.numero_whatsapp,
        direccion: newUser.direccion
      },
      token  // Enviar el token en la respuesta
    });

  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ error: 'Error en el servidor.' });
  }
});

module.exports = router;
