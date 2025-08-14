// routes/clientes.js
const express = require('express');
const { Op } = require('sequelize');
const Cliente = require('../models/Cliente');
const MovimientoCuentaCorriente = require('../models/MovimientoCuentaCorriente');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');
const sequelize = require('../config/database');

const router = express.Router();

// ✅ OBTENER TODOS LOS CLIENTES
router.get('/', async (req, res) => {
  try {
    const clientes = await Cliente.findAll({
      attributes: [
        'id_cliente', 
        'nombre', 
        'email', 
        'telefono', 
        'direccion',
        'saldo_cuenta_corriente',
        'limite_credito',
        'es_cuenta_corriente',
        'fecha_creacion'
      ],
      order: [['nombre', 'ASC']]
    });
    
    console.log('✅ Clientes obtenidos:', clientes.length);
    res.json(clientes);
  } catch (error) {
    console.error('❌ Error al obtener clientes:', error);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

// ✅ BUSCAR CLIENTE POR NOMBRE O EMAIL
router.get('/buscar', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim() === '') {
      return res.json([]);
    }

    const clientes = await Cliente.findAll({
      where: {
        [Op.or]: [
          { nombre: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } },
          { telefono: { [Op.like]: `%${q}%` } }
        ]
      },
      attributes: [
        'id_cliente', 
        'nombre', 
        'email', 
        'telefono',
        'saldo_cuenta_corriente',
        'es_cuenta_corriente',
        'limite_credito'
      ],
      limit: 10,
      order: [['nombre', 'ASC']]
    });

    res.json(clientes);
  } catch (error) {
    console.error('❌ Error al buscar clientes:', error);
    res.status(500).json({ error: 'Error al buscar clientes' });
  }
});

// ✅ OBTENER CLIENTE POR ID con movimientos
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const cliente = await Cliente.findByPk(id);
    
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Obtener movimientos recientes
    const movimientos = await MovimientoCuentaCorriente.findAll({
      where: { id_cliente: id },
      order: [['fecha', 'DESC']],
      limit: 50,
      include: [
        {
          model: Usuario,
          as: 'usuario_registro',
          attributes: ['nombre']
        }
      ]
    });

    res.json({
      cliente,
      movimientos
    });

  } catch (error) {
    console.error('❌ Error al obtener cliente:', error);
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
});

// ✅ REGISTRAR NUEVO CLIENTE
router.post('/registrar', async (req, res) => {
  try {
    const { 
      nombre, 
      email, 
      telefono, 
      direccion, 
      es_cuenta_corriente = false, 
      limite_credito = 0,
      crear_usuario = false,
      password = null
    } = req.body;

    // Validar datos requeridos
    if (!nombre || !email) {
      return res.status(400).json({ error: 'Nombre y email son requeridos' });
    }

    // Verificar si el cliente ya existe
    const clienteExistente = await Cliente.findOne({ where: { email } });
    if (clienteExistente) {
      return res.status(400).json({ error: 'Ya existe un cliente con este email' });
    }

    let id_usuario = null;

    // Crear usuario si se solicita
    if (crear_usuario && password) {
      const usuarioExistente = await Usuario.findOne({ where: { email } });
      if (usuarioExistente) {
        return res.status(400).json({ error: 'Ya existe un usuario con este email' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const nuevoUsuario = await Usuario.create({
        nombre,
        email,
        password: hashedPassword,
        rol: 'cliente',
        telefono,
        direccion
      });

      id_usuario = nuevoUsuario.id_usuario;
    }

    // Crear el cliente
    const nuevoCliente = await Cliente.create({
      nombre,
      email,
      telefono,
      direccion,
      es_cuenta_corriente: Boolean(es_cuenta_corriente),
      limite_credito: parseFloat(limite_credito) || 0,
      saldo_cuenta_corriente: 0,
      id_usuario
    });

    console.log('✅ Cliente creado:', nuevoCliente.nombre);
    res.status(201).json({
      message: 'Cliente registrado exitosamente',
      cliente: nuevoCliente
    });

  } catch (error) {
    console.error('❌ Error al registrar cliente:', error);
    res.status(500).json({ error: 'Error al registrar el cliente' });
  }
});

// ✅ ACTUALIZAR CLIENTE
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, telefono, direccion, es_cuenta_corriente, limite_credito } = req.body;

    const cliente = await Cliente.findByPk(id);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    await cliente.update({
      nombre,
      email,
      telefono,
      direccion,
      es_cuenta_corriente: Boolean(es_cuenta_corriente),
      limite_credito: parseFloat(limite_credito) || cliente.limite_credito
    });

    console.log('✅ Cliente actualizado:', cliente.nombre);
    res.json({ message: 'Cliente actualizado exitosamente', cliente });

  } catch (error) {
    console.error('❌ Error al actualizar cliente:', error);
    res.status(500).json({ error: 'Error al actualizar cliente' });
  }
});

// ✅ REGISTRAR PAGO EN CUENTA CORRIENTE
router.post('/:id/pago', async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { monto, descripcion = '', id_usuario_registro } = req.body;

    if (!monto || monto <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }

    const cliente = await Cliente.findByPk(id, { transaction });
    if (!cliente) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    if (!cliente.es_cuenta_corriente) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Este cliente no maneja cuenta corriente' });
    }

    const saldoAnterior = parseFloat(cliente.saldo_cuenta_corriente);
    const saldoNuevo = saldoAnterior - parseFloat(monto); // Pago reduce el saldo

    // Actualizar saldo del cliente
    await cliente.update({
      saldo_cuenta_corriente: saldoNuevo
    }, { transaction });

    // Registrar movimiento
    await MovimientoCuentaCorriente.create({
      id_cliente: parseInt(id),
      tipo_movimiento: 'pago',
      monto: parseFloat(monto),
      descripcion: descripcion || `Pago recibido`,
      saldo_anterior: saldoAnterior,
      saldo_actual: saldoNuevo,
      id_usuario_registro: id_usuario_registro || null
    }, { transaction });

    await transaction.commit();

    console.log(`💰 Pago registrado para ${cliente.nombre}: $${monto}`);
    res.json({
      message: 'Pago registrado exitosamente',
      saldo_anterior: saldoAnterior,
      saldo_actual: saldoNuevo
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error al registrar pago:', error);
    res.status(500).json({ error: 'Error al registrar el pago' });
  }
});

// ✅ OBTENER RESUMEN DE CUENTA CORRIENTE
router.get('/:id/resumen', async (req, res) => {
  try {
    const { id } = req.params;
    const { limite = 10 } = req.query;

    const cliente = await Cliente.findByPk(id);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    if (!cliente.es_cuenta_corriente) {
      return res.status(400).json({ error: 'Este cliente no maneja cuenta corriente' });
    }

    // Obtener movimientos recientes
    const movimientos = await MovimientoCuentaCorriente.findAll({
      where: { id_cliente: id },
      order: [['fecha', 'DESC']],
      limit: parseInt(limite),
      include: [
        {
          model: Usuario,
          as: 'usuario_registro',
          attributes: ['nombre']
        }
      ]
    });

    // Calcular estadísticas
    const totalVentas = await MovimientoCuentaCorriente.sum('monto', {
      where: { 
        id_cliente: id, 
        tipo_movimiento: 'venta'
      }
    }) || 0;

    const totalPagos = await MovimientoCuentaCorriente.sum('monto', {
      where: { 
        id_cliente: id, 
        tipo_movimiento: 'pago'
      }
    }) || 0;

    const resumen = {
      cliente: {
        id_cliente: cliente.id_cliente,
        nombre: cliente.nombre,
        email: cliente.email,
        telefono: cliente.telefono,
        saldo_actual: parseFloat(cliente.saldo_cuenta_corriente),
        limite_credito: parseFloat(cliente.limite_credito),
        credito_disponible: parseFloat(cliente.limite_credito) - parseFloat(cliente.saldo_cuenta_corriente)
      },
      estadisticas: {
        total_ventas: parseFloat(totalVentas),
        total_pagos: parseFloat(totalPagos),
        saldo_actual: parseFloat(cliente.saldo_cuenta_corriente)
      },
      movimientos
    };

    res.json(resumen);

  } catch (error) {
    console.error('❌ Error al obtener resumen:', error);
    res.status(500).json({ error: 'Error al obtener resumen de cuenta' });
  }
});

// ✅ CANCELAR/SALDAR CUENTA CORRIENTE
router.post('/:id/saldar', async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { id_usuario_registro, descripcion = 'Saldo de cuenta' } = req.body;

    const cliente = await Cliente.findByPk(id, { transaction });
    if (!cliente) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const saldoActual = parseFloat(cliente.saldo_cuenta_corriente);
    
    if (saldoActual === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'La cuenta ya está saldada' });
    }

    // Registrar movimiento de ajuste
    await MovimientoCuentaCorriente.create({
      id_cliente: parseInt(id),
      tipo_movimiento: 'ajuste',
      monto: Math.abs(saldoActual),
      descripcion: descripcion,
      saldo_anterior: saldoActual,
      saldo_actual: 0,
      id_usuario_registro: id_usuario_registro || null
    }, { transaction });

    // Actualizar saldo a 0
    await cliente.update({
      saldo_cuenta_corriente: 0
    }, { transaction });

    await transaction.commit();

    console.log(`✅ Cuenta saldada para ${cliente.nombre}`);
    res.json({
      message: 'Cuenta corriente saldada exitosamente',
      saldo_anterior: saldoActual,
      saldo_actual: 0
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error al saldar cuenta:', error);
    res.status(500).json({ error: 'Error al saldar la cuenta' });
  }
});

// ✅ REGISTRAR ENTREGA PARCIAL
router.post('/:id/entrega-parcial', async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { monto, descripcion = '', id_usuario_registro, id_ticket = null } = req.body;

    if (!monto || monto <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }

    const cliente = await Cliente.findByPk(id, { transaction });
    if (!cliente) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    if (!cliente.es_cuenta_corriente) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Este cliente no maneja cuenta corriente' });
    }

    const saldoAnterior = parseFloat(cliente.saldo_cuenta_corriente);
    const saldoNuevo = saldoAnterior - parseFloat(monto); // Entrega reduce el saldo

    // Verificar que el monto no sea mayor al saldo
    if (saldoNuevo < 0) {
      await transaction.rollback();
      return res.status(400).json({ 
        error: 'El monto de entrega no puede ser mayor al saldo actual',
        saldo_disponible: saldoAnterior 
      });
    }

    // Actualizar saldo del cliente
    await cliente.update({
      saldo_cuenta_corriente: saldoNuevo
    }, { transaction });

    // Registrar movimiento
    await MovimientoCuentaCorriente.create({
      id_cliente: parseInt(id),
      id_ticket: id_ticket || null,
      tipo_movimiento: 'entrega_parcial',
      monto: parseFloat(monto),
      descripcion: descripcion || `Entrega parcial`,
      saldo_anterior: saldoAnterior,
      saldo_actual: saldoNuevo,
      id_usuario_registro: id_usuario_registro || null
    }, { transaction });

    await transaction.commit();

    console.log(`💵 Entrega parcial registrada para ${cliente.nombre}: $${monto}`);
    res.json({
      message: 'Entrega parcial registrada exitosamente',
      saldo_anterior: saldoAnterior,
      saldo_actual: saldoNuevo
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error al registrar entrega parcial:', error);
    res.status(500).json({ error: 'Error al registrar la entrega parcial' });
  }
});

module.exports = router;
