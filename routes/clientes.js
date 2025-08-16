// routes/clientes.js
const express = require('express');
const { Op } = require('sequelize');
const Cliente = require('../models/Cliente');
const MovimientoCuentaCorriente = require('../models/MovimientoCuentaCorriente');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');
const Ticket = require('../models/Ticket');
const sequelize = require('../config/database');

const router = express.Router();

// ✅ RUTA DE PRUEBA PARA VERIFICAR QUE CLIENTES FUNCIONA
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 Test de ruta de clientes...');
    
    // Probar conexión a la base de datos
    const count = await Cliente.count();
    
    res.json({
      status: 'OK',
      message: 'Ruta de clientes funcionando',
      total_clientes: count,
      timestamp: new Date().toISOString(),
      database_connection: 'OK'
    });
    
  } catch (error) {
    console.error('❌ Error en test de clientes:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Error en la conexión',
      error: error.message
    });
  }
});

// ✅ OBTENER TODOS LOS CLIENTES
router.get('/', async (req, res) => {
  try {
    console.log('📋 Iniciando obtención de clientes...');
    
    // ✅ MEJORAR LA QUERY PARA EVITAR PROBLEMAS
    const clientes = await Cliente.findAll({
      attributes: [
        'id_cliente', 
        'nombre', 
        'email', 
        'telefono', 
        'direccion',
        [sequelize.fn('COALESCE', sequelize.col('saldo_cuenta_corriente'), 0), 'saldo_cuenta_corriente'],
        [sequelize.fn('COALESCE', sequelize.col('limite_credito'), 0), 'limite_credito'],
        'es_cuenta_corriente',
        'fecha_creacion'
      ],
      order: [['nombre', 'ASC']],
      raw: false // ✅ Asegurar que devuelve objetos Sequelize
    });
    
    // ✅ CONVERTIR A JSON PLANO PARA EVITAR PROBLEMAS DE SERIALIZACIÓN
    const clientesJSON = clientes.map(cliente => ({
      id_cliente: cliente.id_cliente,
      nombre: cliente.nombre,
      email: cliente.email,
      telefono: cliente.telefono,
      direccion: cliente.direccion,
      saldo_cuenta_corriente: parseFloat(cliente.saldo_cuenta_corriente) || 0,
      limite_credito: parseFloat(cliente.limite_credito) || 0,
      es_cuenta_corriente: Boolean(cliente.es_cuenta_corriente),
      fecha_creacion: cliente.fecha_creacion
    }));
    
    console.log(`✅ ${clientesJSON.length} clientes obtenidos exitosamente`);
    
    // ✅ HEADERS EXPLÍCITOS
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(clientesJSON);
    
  } catch (error) {
    console.error('❌ Error detallado al obtener clientes:', {
      message: error.message,
      stack: error.stack,
      sql: error.sql || 'No SQL'
    });
    
    // ✅ RESPUESTA DE ERROR MÁS ESPECÍFICA
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: 'No se pudieron obtener los clientes',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
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

// ✅ OBTENER TICKETS PENDIENTES DE UN CLIENTE - SOLUCIÓN CORREGIDA
router.get('/:id/tickets-pendientes', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📋 Obteniendo tickets pendientes para cliente ${id}`);
    
    // ✅ BUSCAR DIRECTAMENTE EN MOVIMIENTOS DE VENTA
    const movimientos = await MovimientoCuentaCorriente.findAll({
      where: {
        id_cliente: id,
        tipo_movimiento: 'venta'
      },
      order: [['fecha', 'DESC']],
      limit: 50
    });
    
    console.log(`📊 Movimientos encontrados:`, movimientos.length);
    
    // ✅ CONVERTIR MOVIMIENTOS A FORMATO DE TICKETS
    const tickets = movimientos.map(mov => ({
      id_ticket: mov.id_ticket || `MOV-${mov.id_movimiento}`,
      numero_ticket: mov.id_ticket || mov.id_movimiento,
      total: parseFloat(mov.monto),
      fecha: mov.fecha,
      tipo_pago: 'cuenta_corriente',
      descripcion: mov.descripcion
    }));
    
    console.log(`✅ ${tickets.length} tickets simulados creados para cliente ${id}`);
    console.log(`📋 Datos enviados:`, tickets);
    
    res.json(tickets);
    
  } catch (error) {
    console.error('❌ Error al obtener tickets pendientes:', error);
    res.status(500).json({ 
      error: 'Error al obtener tickets pendientes',
      details: error.message 
    });
  }
});

// ✅ NUEVA RUTA: Asociar ticket existente a cuenta corriente
router.post('/:id/asociar-ticket', async (req, res) => {
  try {
    const { id } = req.params;
    const { id_ticket, descripcion } = req.body;
    
    console.log(`🔗 Asociando ticket ${id_ticket} al cliente ${id}`);
    
    // ✅ VERIFICAR QUE EL CLIENTE EXISTE Y TIENE CUENTA CORRIENTE
    const cliente = await Cliente.findByPk(id);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    if (!cliente.es_cuenta_corriente) {
      return res.status(400).json({ error: 'El cliente no tiene habilitada la cuenta corriente' });
    }
    
    // ✅ BUSCAR EL TICKET
    const ticket = await Ticket.findByPk(id_ticket);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }
    
    // ✅ VERIFICAR QUE EL TICKET NO ESTÉ YA ASOCIADO
    if (ticket.id_cliente) {
      return res.status(400).json({ 
        error: `El ticket ya está asociado al cliente ${ticket.id_cliente}` 
      });
    }
    
    // ✅ INICIAR TRANSACCIÓN
    const transaction = await sequelize.transaction();
    
    try {
      // ✅ ACTUALIZAR EL TICKET
      await ticket.update({
        id_cliente: id,
        tipo_pago: 'cuenta_corriente'
      }, { transaction });
      
      // ✅ CREAR MOVIMIENTO EN CUENTA CORRIENTE
      await MovimientoCuentaCorriente.create({
        id_cliente: id,
        id_ticket: id_ticket,
        tipo_movimiento: 'venta',
        monto: parseFloat(ticket.total),
        descripcion: descripcion || `Venta asociada - Ticket #${id_ticket}`,
        fecha: ticket.fecha || new Date(),
        saldo_anterior: parseFloat(cliente.saldo_cuenta_corriente || 0),
        saldo_actual: parseFloat(cliente.saldo_cuenta_corriente || 0) + parseFloat(ticket.total)
      }, { transaction });
      
      // ✅ ACTUALIZAR SALDO DEL CLIENTE
      const nuevoSaldo = parseFloat(cliente.saldo_cuenta_corriente || 0) + parseFloat(ticket.total);
      await cliente.update({
        saldo_cuenta_corriente: nuevoSaldo
      }, { transaction });
      
      await transaction.commit();
      
      console.log(`✅ Ticket ${id_ticket} asociado exitosamente al cliente ${id}`);
      console.log(`💰 Nuevo saldo del cliente: $${nuevoSaldo}`);
      
      res.json({
        message: 'Ticket asociado exitosamente',
        ticket_id: id_ticket,
        monto: parseFloat(ticket.total),
        nuevo_saldo: nuevoSaldo
      });
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error al asociar ticket:', error);
    res.status(500).json({ 
      error: 'Error al asociar ticket',
      details: error.message 
    });
  }
});

// ✅ NUEVA RUTA: Obtener tickets disponibles para asociar
router.get('/tickets-disponibles', async (req, res) => {
  try {
    console.log('🔍 Obteniendo tickets disponibles para asociar...');
    
    // ✅ BUSCAR TICKETS SIN CLIENTE ASOCIADO
    const tickets = await Ticket.findAll({
      where: {
        id_cliente: null, // Solo tickets sin cliente
        total: {
          [Op.gt]: 0 // Solo tickets con monto mayor a 0
        }
      },
      order: [['fecha', 'DESC']],
      limit: 100, // Limitar resultados
      attributes: [
        'id_ticket', 
        'numero_ticket', 
        'total', 
        'fecha', 
        'tipo_pago', 
        'productos'
      ]
    });
    
    // ✅ FORMATEAR DATOS PARA EL FRONTEND
    const ticketsFormateados = tickets.map(ticket => {
      let productosInfo = 'Sin productos';
      try {
        const productos = JSON.parse(ticket.productos);
        if (Array.isArray(productos) && productos.length > 0) {
          productosInfo = productos.slice(0, 2)
            .map(p => p.nombre)
            .join(', ');
          if (productos.length > 2) {
            productosInfo += `... (+${productos.length - 2} más)`;
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error al parsear productos del ticket ${ticket.id_ticket}`);
      }
      
      return {
        id_ticket: ticket.id_ticket,
        numero_ticket: ticket.numero_ticket || ticket.id_ticket,
        total: parseFloat(ticket.total),
        fecha: ticket.fecha,
        tipo_pago: ticket.tipo_pago || 'contado',
        productos_info: productosInfo
      };
    });
    
    console.log(`✅ ${ticketsFormateados.length} tickets disponibles encontrados`);
    res.json(ticketsFormateados);
    
  } catch (error) {
    console.error('❌ Error al obtener tickets disponibles:', error);
    res.status(500).json({ 
      error: 'Error al obtener tickets disponibles',
      details: error.message 
    });
  }
});

module.exports = router;
