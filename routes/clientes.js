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

// ✅ NUEVA RUTA DE TEST PARA VERIFICAR MODELOS
router.get('/test-models', async (req, res) => {
  try {
    console.log('🧪 Testeando modelos y relaciones...');
    
    // Test Cliente
    const clienteCount = await Cliente.count();
    console.log(`👥 Clientes en DB: ${clienteCount}`);
    
    // Test Ticket
    const ticketCount = await Ticket.count();
    console.log(`🎫 Tickets en DB: ${ticketCount}`);
    
    // Test MovimientoCuentaCorriente
    const movimientoCount = await MovimientoCuentaCorriente.count();
    console.log(`📊 Movimientos en DB: ${movimientoCount}`);
    
    // Test específico: buscar un cliente con cuenta corriente
    const clienteCtaCte = await Cliente.findOne({
      where: { es_cuenta_corriente: true }
    });
    
    // Test específico: buscar un ticket sin cliente
    const ticketSinCliente = await Ticket.findOne({
      where: { id_cliente: null }
    });
    
    res.json({
      status: 'OK',
      counts: {
        clientes: clienteCount,
        tickets: ticketCount,
        movimientos: movimientoCount
      },
      samples: {
        cliente_cuenta_corriente: clienteCtaCte ? {
          id: clienteCtaCte.id_cliente,
          nombre: clienteCtaCte.nombre,
          saldo: clienteCtaCte.saldo_cuenta_corriente
        } : null,
        ticket_sin_cliente: ticketSinCliente ? {
          id: ticketSinCliente.id_ticket,
          total: ticketSinCliente.total,
          fecha: ticketSinCliente.fecha
        } : null
      },
      database_tables: {
        Cliente: 'OK',
        Ticket: 'OK',
        MovimientoCuentaCorriente: 'OK'
      }
    });
    
  } catch (error) {
    console.error('❌ Error en test de modelos:', error);
    res.status(500).json({
      error: error.message,
      name: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

// ✅ RUTA MEJORADA CON BÚSQUEDA Y PAGINACIÓN: Obtener tickets disponibles
router.get('/tickets-disponibles', async (req, res) => {
  try {
    const { 
      busqueda = '', 
      pagina = 1, 
      limite = 50, 
      ordenar = 'fecha',
      direccion = 'DESC' 
    } = req.query;
    
    console.log('🔍 Obteniendo tickets disponibles con filtros:', {
      busqueda,
      pagina,
      limite,
      ordenar,
      direccion
    });
    
    // ✅ CONSTRUIR CONDICIONES DE BÚSQUEDA
    const whereConditions = {
      id_cliente: null // Solo tickets sin cliente
    };
    
    // ✅ AGREGAR FILTROS DE BÚSQUEDA
    if (busqueda.trim()) {
      const busquedaLower = busqueda.toLowerCase().trim();
      
      // ✅ DETECTAR SI ES UN NÚMERO (BÚSQUEDA POR IMPORTE)
      if (!isNaN(busquedaLower) && busquedaLower !== '') {
        const monto = parseFloat(busquedaLower);
        // Buscar tickets con importe exacto o similar (±0.50)
        whereConditions.total = {
          [Op.between]: [monto - 0.5, monto + 0.5]
        };
        console.log(`🔍 Buscando por importe: $${monto} (±0.50)`);
      } else {
        // ✅ BÚSQUEDA EN PRODUCTOS (JSON)
        whereConditions[Op.or] = [
          // Buscar en el JSON de productos
          {
            productos: {
              [Op.like]: `%${busqueda}%`
            }
          },
          // Buscar por ID de ticket si es un número
          ...(busquedaLower.match(/^\d+$/) ? [{
            id_ticket: parseInt(busquedaLower)
          }] : [])
        ];
        console.log(`🔍 Buscando en productos: "${busqueda}"`);
      }
    }
    
    // ✅ CALCULAR OFFSET PARA PAGINACIÓN
    const offset = (parseInt(pagina) - 1) * parseInt(limite);
    
    // ✅ OBTENER TICKETS CON PAGINACIÓN
    const { count, rows: tickets } = await Ticket.findAndCountAll({
      where: whereConditions,
      order: [[ordenar, direccion.toUpperCase()]],
      limit: parseInt(limite),
      offset: offset,
      attributes: [
        'id_ticket', 
        'total', 
        'fecha', 
        'tipo_pago', 
        'productos',
        'descuento',
        'pago_recibido',
        'entrega'
      ]
    });
    
    console.log(`📊 Tickets encontrados: ${count} total, ${tickets.length} en esta página`);
    
    // ✅ FORMATEAR DATOS PARA EL FRONTEND
    const ticketsFormateados = tickets.map(ticket => {
      let productosInfo = 'Sin productos';
      let productosDetalle = [];
      
      try {
        if (ticket.productos) {
          const productos = JSON.parse(ticket.productos);
          if (Array.isArray(productos) && productos.length > 0) {
            productosDetalle = productos;
            
            // ✅ CREAR RESUMEN MÁS DETALLADO
            if (productos.length === 1) {
              productosInfo = productos[0].nombre || 'Producto sin nombre';
            } else if (productos.length === 2) {
              productosInfo = productos.map(p => p.nombre).join(', ');
            } else {
              productosInfo = `${productos[0].nombre}, ${productos[1].nombre}... (+${productos.length - 2} más)`;
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error al parsear productos del ticket ${ticket.id_ticket}:`, error.message);
        productosInfo = 'Error en productos';
      }
      
      return {
        id_ticket: ticket.id_ticket,
        numero_ticket: ticket.id_ticket,
        total: parseFloat(ticket.total || 0),
        fecha: ticket.fecha,
        tipo_pago: ticket.tipo_pago || 'contado',
        productos_info: productosInfo,
        productos_detalle: productosDetalle,
        descuento: parseFloat(ticket.descuento || 0),
        pago_recibido: parseFloat(ticket.pago_recibido || 0),
        entrega: parseFloat(ticket.entrega || 0)
      };
    });
    
    // ✅ RESPUESTA CON METADATOS DE PAGINACIÓN
    const response = {
      tickets: ticketsFormateados,
      paginacion: {
        pagina_actual: parseInt(pagina),
        total_paginas: Math.ceil(count / parseInt(limite)),
        total_tickets: count,
        tickets_por_pagina: parseInt(limite),
        tiene_siguiente: offset + tickets.length < count,
        tiene_anterior: parseInt(pagina) > 1
      },
      filtros: {
        busqueda,
        ordenar,
        direccion
      }
    };
    
    console.log(`✅ Enviando ${ticketsFormateados.length} tickets formateados con paginación`);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error al obtener tickets disponibles:', error);
    res.status(500).json({ 
      error: 'Error al obtener tickets disponibles',
      details: error.message 
    });
  }
});

// ✅ OBTENER TODOS LOS CLIENTES - VERSIÓN SIMPLIFICADA
router.get('/', async (req, res) => {
  try {
    console.log('📋 Iniciando obtención de clientes...');
    
    // ✅ CONSULTA SIMPLIFICADA SIN FUNCIONES COMPLEJAS
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
      order: [['nombre', 'ASC']],
      raw: true // ✅ Devolver objetos planos directamente
    });
    
    // ✅ FORMATEAR DATOS PARA ASEGURAR TIPOS CORRECTOS
    const clientesFormateados = clientes.map(cliente => ({
      id_cliente: cliente.id_cliente,
      nombre: cliente.nombre || '',
      email: cliente.email || '',
      telefono: cliente.telefono || '',
      direccion: cliente.direccion || '',
      saldo_cuenta_corriente: parseFloat(cliente.saldo_cuenta_corriente || 0),
      limite_credito: parseFloat(cliente.limite_credito || 0),
      es_cuenta_corriente: Boolean(cliente.es_cuenta_corriente),
      fecha_creacion: cliente.fecha_creacion
    }));
    
    console.log(`✅ ${clientesFormateados.length} clientes obtenidos exitosamente`);
    
    res.json(clientesFormateados);
    
  } catch (error) {
    console.error('❌ Error al obtener clientes:', error);
    
    // ✅ RESPUESTA DE ERROR DETALLADA
    res.status(500).json({ 
      error: 'Error al obtener clientes',
      message: error.message,
      details: {
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      timestamp: new Date().toISOString()
    });
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

// ✅ OBTENER RESUMEN DE CUENTA CORRIENTE
router.get('/:id/resumen', async (req, res) => {
  try {
    const { id } = req.params;
    const { limite = 20 } = req.query;

    const cliente = await Cliente.findByPk(id);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    if (!cliente.es_cuenta_corriente) {
      return res.status(400).json({ error: 'Este cliente no maneja cuenta corriente' });
    }

    // ✅ OBTENER TODOS LOS MOVIMIENTOS INCLUYENDO NÚMERO DE RECIBO
    const movimientos = await MovimientoCuentaCorriente.findAll({
      where: { id_cliente: id },
      order: [['fecha', 'DESC']],
      limit: parseInt(limite),
      attributes: [
        'id_movimiento',
        'tipo_movimiento',
        'monto',
        'descripcion',
        'fecha',
        'saldo_anterior',
        'saldo_actual',
        'numero_recibo',
        'tickets_pagados'
      ],
      include: [
        {
          model: Usuario,
          as: 'usuario_registro',
          attributes: ['nombre'],
          required: false
        }
      ]
    });

    // Calcular estadísticas
    const totalVentas = await MovimientoCuentaCorriente.sum('monto', {
      where: { 
        id_cliente: id, 
        tipo_movimiento: ['venta', 'entrega_parcial']
      }
    }) || 0;

    const totalPagos = await MovimientoCuentaCorriente.sum('monto', {
      where: { 
        id_cliente: id, 
        tipo_movimiento: 'pago'
      }
    }) || 0;

    // ✅ FORMATEAR MOVIMIENTOS CON INFORMACIÓN COMPLETA
    const movimientosFormateados = movimientos.map(mov => ({
      id_movimiento: mov.id_movimiento,
      tipo_movimiento: mov.tipo_movimiento,
      monto: parseFloat(mov.monto),
      descripcion: mov.descripcion,
      fecha: mov.fecha,
      saldo_anterior: parseFloat(mov.saldo_anterior),
      saldo_actual: parseFloat(mov.saldo_actual),
      numero_recibo: mov.numero_recibo,
      tickets_pagados: mov.tickets_pagados ? JSON.parse(mov.tickets_pagados) : [],
      usuario_registro: mov.usuario_registro?.nombre || null
    }));

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
      movimientos: movimientosFormateados
    };

    res.json(resumen);

  } catch (error) {
    console.error('❌ Error al obtener resumen:', error);
    res.status(500).json({ error: 'Error al obtener resumen de cuenta' });
  }
});

// ✅ OBTENER TICKETS PENDIENTES DE UN CLIENTE
router.get('/:id/tickets-pendientes', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📋 Obteniendo tickets pendientes para cliente ${id}`);
    
    // ✅ BUSCAR TICKETS NO PAGADOS DEL CLIENTE
    const tickets = await Ticket.findAll({
      where: {
        id_cliente: id,
        tipo_pago: ['cuenta_corriente', 'cuenta_corriente_parcial'],
        estado: ['pendiente', 'pagado_parcial'] // Excluir pagado_total
      },
      order: [['fecha', 'DESC']],
      attributes: [
        'id_ticket', 
        'total', 
        'fecha', 
        'productos',
        'descuento',
        'entrega',
        'estado'
      ]
    });
    
    console.log(`✅ ${tickets.length} tickets pendientes encontrados para cliente ${id}`);
    
    // ✅ FORMATEAR DATOS
    const ticketsFormateados = tickets.map(ticket => ({
      id_ticket: ticket.id_ticket,
      numero_ticket: ticket.id_ticket,
      total: parseFloat(ticket.total),
      fecha: ticket.fecha,
      tipo_pago: 'cuenta_corriente',
      estado: ticket.estado,
      productos_info: JSON.parse(ticket.productos || '[]').slice(0, 2).map(p => p.nombre).join(', ') + '...'
    }));
    
    res.json(ticketsFormateados);
    
  } catch (error) {
    console.error('❌ Error al obtener tickets pendientes:', error);
    res.status(500).json({ 
      error: 'Error al obtener tickets pendientes',
      details: error.message 
    });
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

// ✅ REGISTRAR PAGO EN CUENTA CORRIENTE
router.post('/:id/pago', async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { monto, descripcion = '', id_usuario_registro, tickets_pagados = [] } = req.body;

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

    // ✅ GENERAR NÚMERO DE RECIBO
    const numeroRecibo = `REC-${Date.now()}-${id}`;

    // Actualizar saldo del cliente
    await cliente.update({
      saldo_cuenta_corriente: saldoNuevo
    }, { transaction });

    // ✅ REGISTRAR MOVIMIENTO CON NÚMERO DE RECIBO
    await MovimientoCuentaCorriente.create({
      id_cliente: parseInt(id),
      tipo_movimiento: 'pago',
      monto: parseFloat(monto),
      descripcion: descripcion || `Pago recibido`,
      saldo_anterior: saldoAnterior,
      saldo_actual: saldoNuevo,
      numero_recibo: numeroRecibo,
      tickets_pagados: JSON.stringify(tickets_pagados),
      id_usuario_registro: id_usuario_registro || null
    }, { transaction });

    // ✅ ACTUALIZAR ESTADO DE TICKETS PAGADOS
    if (tickets_pagados.length > 0) {
      await Ticket.update(
        { estado: 'pagado_total' },
        { 
          where: { id_ticket: tickets_pagados },
          transaction 
        }
      );
    }

    await transaction.commit();

    console.log(`💰 Pago registrado para ${cliente.nombre}: $${monto}`);
    res.json({
      message: 'Pago registrado exitosamente',
      numeroRecibo: numeroRecibo,
      saldo_anterior: saldoAnterior,
      saldo_actual: saldoNuevo,
      tickets_pagados: tickets_pagados
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error al registrar pago:', error);
    res.status(500).json({ error: 'Error al registrar el pago' });
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

// ✅ RUTA CORREGIDA CON DEBUGGING DETALLADO: Asociar ticket existente a cuenta corriente
router.post('/:id/asociar-ticket', async (req, res) => {
  let transaction = null;
  
  try {
    const { id } = req.params;
    const { id_ticket, descripcion } = req.body;
    
    console.log(`🔗 === INICIANDO ASOCIACIÓN DE TICKET ===`);
    console.log(`📋 Cliente ID: ${id}`);
    console.log(`🎫 Ticket ID: ${id_ticket}`);
    console.log(`📝 Descripción: ${descripcion || 'Sin descripción'}`);
    
    // ✅ VALIDAR PARÁMETROS
    if (!id || !id_ticket) {
      return res.status(400).json({ 
        error: 'Cliente ID y Ticket ID son requeridos',
        received: { id, id_ticket }
      });
    }
    
    // ✅ PASO 1: VERIFICAR QUE EL CLIENTE EXISTE Y TIENE CUENTA CORRIENTE
    console.log(`👤 Paso 1: Buscando cliente ${id}...`);
    const cliente = await Cliente.findByPk(id);
    if (!cliente) {
      console.log(`❌ Cliente ${id} no encontrado`);
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    console.log(`✅ Cliente encontrado: ${cliente.nombre}`);
    console.log(`💰 Saldo actual: $${cliente.saldo_cuenta_corriente || 0}`);
    console.log(`🏪 Es cuenta corriente: ${cliente.es_cuenta_corriente}`);
    
    if (!cliente.es_cuenta_corriente) {
      console.log(`❌ Cliente no tiene cuenta corriente habilitada`);
      return res.status(400).json({ error: 'El cliente no tiene habilitada la cuenta corriente' });
    }
    
    // ✅ PASO 2: BUSCAR EL TICKET
    console.log(`🎫 Paso 2: Buscando ticket ${id_ticket}...`);
    const ticket = await Ticket.findByPk(id_ticket);
    if (!ticket) {
      console.log(`❌ Ticket ${id_ticket} no encontrado`);
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }
    
    console.log(`✅ Ticket encontrado:`);
    console.log(`  - ID: ${ticket.id_ticket}`);
    console.log(`  - Total: $${ticket.total}`);
    console.log(`  - Cliente actual: ${ticket.id_cliente || 'NULL'}`);
    console.log(`  - Tipo pago: ${ticket.tipo_pago || 'NULL'}`);
    console.log(`  - Fecha: ${ticket.fecha}`);
    
    // ✅ PASO 3: VERIFICAR QUE EL TICKET NO ESTÉ YA ASOCIADO
    if (ticket.id_cliente) {
      console.log(`❌ Ticket ya asociado al cliente ${ticket.id_cliente}`);
      return res.status(400).json({ 
        error: `El ticket ya está asociado al cliente ${ticket.id_cliente}` 
      });
    }
    
    // ✅ PASO 4: INICIAR TRANSACCIÓN
    console.log(`🔄 Paso 4: Iniciando transacción...`);
    transaction = await sequelize.transaction();
    
    // ✅ PASO 5: ACTUALIZAR EL TICKET
    console.log(`📝 Paso 5: Actualizando ticket...`);
    await ticket.update({
      id_cliente: parseInt(id),
      tipo_pago: 'cuenta_corriente'
    }, { transaction });
    
    console.log(`✅ Ticket actualizado exitosamente`);
    
    // ✅ PASO 6: PREPARAR DATOS PARA MOVIMIENTO
    const montoTicket = parseFloat(ticket.total);
    const saldoAnterior = parseFloat(cliente.saldo_cuenta_corriente || 0);
    const nuevoSaldo = saldoAnterior + montoTicket;
    
    console.log(`💰 Paso 6: Calculando saldos...`);
    console.log(`  - Monto ticket: $${montoTicket}`);
    console.log(`  - Saldo anterior: $${saldoAnterior}`);
    console.log(`  - Nuevo saldo: $${nuevoSaldo}`);
    
    // ✅ PASO 7: CREAR MOVIMIENTO EN CUENTA CORRIENTE
    console.log(`📊 Paso 7: Creando movimiento de cuenta corriente...`);
    const nuevoMovimiento = await MovimientoCuentaCorriente.create({
      id_cliente: parseInt(id),
      id_ticket: parseInt(id_ticket),
      tipo_movimiento: 'venta',
      monto: montoTicket,
      descripcion: descripcion || `Venta asociada - Ticket #${id_ticket}`,
      fecha: ticket.fecha || new Date(),
      saldo_anterior: saldoAnterior,
      saldo_actual: nuevoSaldo
    }, { transaction });
    
    console.log(`✅ Movimiento creado con ID: ${nuevoMovimiento.id_movimiento}`);
    
    // ✅ PASO 8: ACTUALIZAR SALDO DEL CLIENTE
    console.log(`👤 Paso 8: Actualizando saldo del cliente...`);
    await cliente.update({
      saldo_cuenta_corriente: nuevoSaldo
    }, { transaction });
    
    console.log(`✅ Saldo del cliente actualizado`);
    
    // ✅ PASO 9: CONFIRMAR TRANSACCIÓN
    console.log(`✅ Paso 9: Confirmando transacción...`);
    await transaction.commit();
    transaction = null; // Marcar como completada
    
    console.log(`🎉 === ASOCIACIÓN COMPLETADA EXITOSAMENTE ===`);
    console.log(`✅ Ticket ${id_ticket} asociado al cliente ${cliente.nombre}`);
    console.log(`💰 Nuevo saldo: $${nuevoSaldo}`);
    
    res.json({
      success: true,
      message: 'Ticket asociado exitosamente',
      data: {
        ticket_id: id_ticket,
        cliente_nombre: cliente.nombre,
        monto: montoTicket,
        saldo_anterior: saldoAnterior,
        nuevo_saldo: nuevoSaldo,
        movimiento_id: nuevoMovimiento.id_movimiento
      }
    });
    
  } catch (error) {
    // ✅ ROLLBACK SI HAY TRANSACCIÓN ACTIVA
    if (transaction) {
      console.log(`🔄 Realizando rollback de transacción...`);
      await transaction.rollback();
    }
    
    console.error(`❌ === ERROR EN ASOCIACIÓN DE TICKET ===`);
    console.error(`🔍 Tipo de error: ${error.name}`);
    console.error(`📝 Mensaje: ${error.message}`);
    console.error(`📍 Stack trace:`, error.stack);
    
    // ✅ ERRORES ESPECÍFICOS DE SEQUELIZE
    if (error.name === 'SequelizeValidationError') {
      console.error(`🚫 Errores de validación:`, error.errors);
      return res.status(400).json({ 
        error: 'Error de validación',
        details: error.errors.map(e => e.message),
        field_errors: error.errors
      });
    }
    
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      console.error(`🔗 Error de clave foránea: ${error.fields}`);
      return res.status(400).json({ 
        error: 'Error de referencia de datos',
        details: `Problema con campos: ${error.fields?.join(', ')}`,
        constraint: error.constraint
      });
    }
    
    if (error.name === 'SequelizeDatabaseError') {
      console.error(`🗄️ Error de base de datos SQL:`, error.sql);
      return res.status(500).json({ 
        error: 'Error de base de datos',
        details: error.message,
        sql_error: process.env.NODE_ENV === 'development' ? error.sql : undefined
      });
    }
    
    // ✅ ERROR GENÉRICO
    res.status(500).json({ 
      error: 'Error interno al asociar ticket',
      details: error.message,
      type: error.name,
      timestamp: new Date().toISOString()
    });
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

module.exports = router;
