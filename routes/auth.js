const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

const router = express.Router();

const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY) {
  console.error('❌ SECRET_KEY no definida en .env. Ejecutando con fallback INSEGURO - configurar variable SECRET_KEY');
}

const ADMIN_CODE = process.env.ADMIN_CODE;
if (!ADMIN_CODE) {
  console.error('❌ ADMIN_CODE no definido en .env. Se requiere para crear usuarios con roles especiales.');
}

const FALLBACK_SECRET = 'clave_secreta_segura';
const ACTIVE_SECRET = SECRET_KEY || FALLBACK_SECRET;

console.log("🔐 Auth configurado");

router.post('/login', async (req, res) => {
  const { email, password, nombre, numero_whatsapp, direccion } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  }

  try {
    let user = await Usuario.findOne({ where: { email: email.toLowerCase().trim() } });

    if (!user) {
      if (!nombre) {
        return res.status(404).json({ error: 'Usuario no encontrado. Debe registrarse primero.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      user = await Usuario.create({
        nombre: nombre.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        rol: 'cliente',
        numero_whatsapp: numero_whatsapp || null,
        direccion: direccion || null
      });
    } else {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
    }

    const tokenPayload = {
      id: user.id_usuario,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol
    };

    const token = jwt.sign(tokenPayload, ACTIVE_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      message: 'Login exitoso',
      token,
      user: {
        id: user.id_usuario,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        numero_whatsapp: user.numero_whatsapp,
        direccion: user.direccion
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/register', async (req, res) => {
  const { nombre, email, password, rol, adminCode, numero_whatsapp, direccion } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Campos obligatorios: nombre, email, password' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const existingUser = await Usuario.findOne({
      where: { email: email.toLowerCase().trim() }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Ya existe un usuario con este email' });
    }

    let userRole = 'cliente';

    if (rol && (rol === 'master' || rol === 'vendedor')) {
      if (!ADMIN_CODE) {
        return res.status(500).json({ error: 'Código de administrador no configurado en el servidor' });
      }
      if (adminCode !== ADMIN_CODE) {
        return res.status(403).json({ error: 'Código de administrador inválido' });
      }
      userRole = rol;
    }

    if (userRole === 'cliente' && (!numero_whatsapp || !direccion)) {
      return res.status(400).json({
        error: 'Para clientes, los campos WhatsApp y Dirección son obligatorios'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await Usuario.create({
      nombre: nombre.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      rol: userRole,
      numero_whatsapp: numero_whatsapp || null,
      direccion: direccion || null
    });

    const tokenPayload = {
      id: newUser.id_usuario,
      nombre: newUser.nombre,
      email: newUser.email,
      rol: newUser.rol
    };

    const token = jwt.sign(tokenPayload, ACTIVE_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token,
      user: {
        id: newUser.id_usuario,
        nombre: newUser.nombre,
        email: newUser.email,
        rol: newUser.rol,
        numero_whatsapp: newUser.numero_whatsapp,
        direccion: newUser.direccion
      }
    });

  } catch (error) {
    console.error('Error en registro:', error.message);

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/verify', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '').trim();

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, ACTIVE_SECRET);
    const user = await Usuario.findByPk(decoded.id);

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      success: true,
      user: {
        id: user.id_usuario,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol
      }
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    res.status(401).json({ error: 'Token inválido' });
  }
});

module.exports = router;
