// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs'); // ✅ Asegurar que esté instalado
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY;
const ADMIN_CODE = "ADMIN123";

console.log("🔐 SECRET_KEY configurada:", SECRET_KEY ? "SÍ" : "NO");

// ✅ ENDPOINT DE LOGIN CORREGIDO
router.post('/login', async (req, res) => {
  const { email, password, nombre, numero_whatsapp, direccion } = req.body;
  
  console.log("📥 Login - Datos recibidos:", {
    email,
    password: password ? "[OCULTA]" : "NO",
    nombre,
    numero_whatsapp,
    direccion,
  });

  try {
    let user = await Usuario.findOne({ where: { email } });

    if (!user) {
      // Si no existe y no hay datos para crear, error
      if (!nombre) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      // Crear usuario automáticamente
      const hashedPassword = await bcrypt.hash(password, 10);
      
      user = await Usuario.create({
        nombre,
        email,
        password: hashedPassword,
        rol: 'cliente',
        numero_whatsapp: numero_whatsapp || null,
        direccion: direccion || null
      });

      console.log("✅ Usuario creado automáticamente:", user.email);
    } else {
      // Verificar contraseña
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        console.log("❌ Contraseña incorrecta para:", email);
        return res.status(401).json({ error: 'Contraseña incorrecta.' });
      }
    }

    // Generar token
    const token = jwt.sign(
      { 
        id: user.id_usuario, 
        nombre: user.nombre, 
        email: user.email, 
        rol: user.rol 
      },
      SECRET_KEY,
      { expiresIn: '24h' } // Extendido a 24h
    );

    console.log("✅ Login exitoso para:", user.email, "- Rol:", user.rol);

    res.json({
      success: true,
      token,
      user: {
        id: user.id_usuario,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        numero_whatsapp: user.numero_whatsapp,
        direccion: user.direccion
      },
      message: user.createdAt ? 'Login exitoso' : 'Usuario creado y logueado'
    });

  } catch (error) {
    console.error('💥 Error en login:', error);
    res.status(500).json({ 
      error: 'Error en el servidor',
      details: error.message 
    });
  }
});

// ✅ ENDPOINT DE REGISTRO CORREGIDO
router.post('/register', async (req, res) => {
  const { nombre, email, password, rol, adminCode, numero_whatsapp, direccion } = req.body;

  console.log("📥 Register - Datos recibidos:", {
    nombre,
    email,
    password: password ? "[OCULTA]" : "NO",
    rol,
    adminCode: adminCode ? "[OCULTA]" : "NO",
    numero_whatsapp,
    direccion
  });

  try {
    // Validaciones básicas
    if (!nombre || !email || !password) {
      return res.status(400).json({ 
        error: 'Campos obligatorios: nombre, email, password' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'La contraseña debe tener al menos 6 caracteres' 
      });
    }

    // Verificar si el usuario ya existe
    const existingUser = await Usuario.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    // Determinar rol
    let userRole = 'cliente'; // Por defecto
    
    if (rol === 'master' || rol === 'vendedor') {
      if (adminCode !== ADMIN_CODE) {
        return res.status(403).json({ 
          error: 'Código de administrador inválido para crear usuarios con roles especiales' 
        });
      }
      userRole = rol;
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 12); // Aumentado a 12 rounds

    // Crear usuario
    const newUser = await Usuario.create({
      nombre: nombre.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      rol: userRole,
      numero_whatsapp: numero_whatsapp || null,
      direccion: direccion || null
    });

    // Generar token
    const token = jwt.sign(
      { 
        id: newUser.id_usuario, 
        nombre: newUser.nombre, 
        email: newUser.email, 
        rol: newUser.rol 
      },
      SECRET_KEY,
      { expiresIn: '24h' }
    );

    console.log("✅ Usuario registrado:", newUser.email, "- Rol:", newUser.rol);

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
    console.error('💥 Error en registro:', error);
    
    // Manejar errores específicos de Sequelize
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        details: error.errors.map(e => e.message) 
      });
    }
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'El email ya está en uso' });
    }

    res.status(500).json({ 
      error: 'Error en el servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

module.exports = router;
