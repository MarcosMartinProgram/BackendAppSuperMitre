// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY || 'clave_secreta_segura';
const ADMIN_CODE = "ADMIN123";

console.log("🔐 Configuración auth:", {
  SECRET_KEY: SECRET_KEY ? "✅ Configurada" : "❌ No configurada",
  ADMIN_CODE: ADMIN_CODE ? "✅ Configurada" : "❌ No configurada"
});

// ✅ ENDPOINT DE LOGIN
router.post('/login', async (req, res) => {
  console.log("\n📥 === LOGIN REQUEST ===");
  console.log("Body recibido:", req.body);
  
  const { email, password, nombre, numero_whatsapp, direccion } = req.body;

  try {
    // Verificar campos obligatorios
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email y contraseña son obligatorios' 
      });
    }

    let user = await Usuario.findOne({ where: { email: email.toLowerCase() } });

    if (!user) {
      // Si no existe usuario y no hay nombre para crear uno, error
      if (!nombre) {
        return res.status(404).json({ 
          error: 'Usuario no encontrado. Debe registrarse primero.' 
        });
      }

      // Crear usuario automáticamente (solo para clientes)
      const hashedPassword = await bcrypt.hash(password, 10);
      
      user = await Usuario.create({
        nombre: nombre.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        rol: 'cliente',
        numero_whatsapp: numero_whatsapp || null,
        direccion: direccion || null
      });

      console.log("✅ Usuario cliente creado automáticamente:", user.email);
    } else {
      // Verificar contraseña
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        console.log("❌ Contraseña incorrecta para:", email);
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
      console.log("✅ Contraseña válida para:", email);
    }

    // Generar token JWT
    const tokenPayload = {
      id: user.id_usuario,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol
    };

    const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: '24h' });

    console.log("✅ Login exitoso:", {
      email: user.email,
      rol: user.rol,
      id: user.id_usuario
    });

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
    console.error('💥 Error en login:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// ✅ ENDPOINT DE REGISTRO
router.post('/register', async (req, res) => {
  console.log("\n📥 === REGISTER REQUEST ===");
  console.log("Body recibido:", {
    ...req.body,
    password: req.body.password ? "[OCULTA]" : "NO",
    adminCode: req.body.adminCode ? "[OCULTA]" : "NO"
  });

  const { nombre, email, password, rol, adminCode, numero_whatsapp, direccion } = req.body;

  try {
    // ✅ VALIDACIONES BÁSICAS
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

    // ✅ VERIFICAR SI YA EXISTE
    const existingUser = await Usuario.findOne({ 
      where: { email: email.toLowerCase() } 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        error: 'Ya existe un usuario con este email' 
      });
    }

    // ✅ VALIDAR ROL Y CÓDIGO ADMIN
    let userRole = 'cliente'; // Por defecto

    if (rol && (rol === 'master' || rol === 'vendedor')) {
      if (adminCode !== ADMIN_CODE) {
        return res.status(403).json({ 
          error: 'Código de administrador requerido para roles especiales' 
        });
      }
      userRole = rol;
      console.log("✅ Rol especial autorizado:", userRole);
    }

    // ✅ HASHEAR CONTRASEÑA
    console.log("🔐 Hasheando contraseña...");
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("✅ Contraseña hasheada correctamente");

    // ✅ CREAR USUARIO
    const newUser = await Usuario.create({
      nombre: nombre.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      rol: userRole,
      numero_whatsapp: numero_whatsapp || null,
      direccion: direccion || null
    });

    console.log("✅ Usuario creado en BD:", {
      id: newUser.id_usuario,
      email: newUser.email,
      rol: newUser.rol
    });

    // ✅ GENERAR TOKEN
    const tokenPayload = {
      id: newUser.id_usuario,
      nombre: newUser.nombre,
      email: newUser.email,
      rol: newUser.rol
    };

    const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: '24h' });

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
    console.error('💥 Error en registro:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    // Manejar errores específicos
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ 
        error: 'Datos inválidos',
        details: error.errors?.map(e => e.message) || []
      });
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ 
        error: 'El email ya está registrado' 
      });
    }

    if (error.name === 'SequelizeDatabaseError') {
      return res.status(500).json({ 
        error: 'Error de base de datos',
        details: process.env.NODE_ENV === 'development' ? error.message : null
      });
    }

    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// ✅ ENDPOINT DE VERIFICACIÓN DE TOKEN
router.get('/verify', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
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
    console.error('Error verificando token:', error);
    res.status(401).json({ error: 'Token inválido' });
  }
});

module.exports = router;
