// /routes/tickets.js
const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Cliente = require('../models/Cliente');
const MovimientoCuentaCorriente = require('../models/MovimientoCuentaCorriente');
const sequelize = require('../config/database');

// ✅ REEMPLAZAR COMPLETAMENTE LA FUNCIÓN POST
router.post('/', async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { 
      productos, 
      descuento, 
      total, 
      pago_recibido = 0,
      vuelto = 0,
      entrega = 0,
      id_cliente = null,
      tipo_pago = 'contado',
      id_vendedor = null
    } = req.body;

    console.log('📋 Datos recibidos:', {
      total: parseFloat(total),
      entrega: parseFloat(entrega),
      tipo_pago,
      id_cliente
    });

    // Crear el ticket
    const nuevoTicket = await Ticket.create({
      productos,
      descuento: parseFloat(descuento) || 0,
      total: parseFloat(total),
      pago_recibido: parseFloat(pago_recibido),
      vuelto: parseFloat(vuelto),
      entrega: parseFloat(entrega),
      id_cliente: id_cliente || null,
      tipo_pago,
      id_vendedor: id_vendedor || null
    }, { transaction });

    console.log('✅ Ticket creado:', nuevoTicket.id_ticket);

    // ✅ SOLO PROCESAR CUENTA CORRIENTE SI CORRESPONDE
    if (tipo_pago === 'cuenta_corriente' && id_cliente) {
      const cliente = await Cliente.findByPk(id_cliente, { transaction });
      
      if (!cliente) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Cliente no encontrado' });
      }

      if (!cliente.es_cuenta_corriente) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Este cliente no tiene cuenta corriente habilitada' });
      }

      const saldoAnterior = parseFloat(cliente.saldo_cuenta_corriente) || 0;
      const totalTicket = parseFloat(total);
      const entregaParcial = parseFloat(entrega);
      
      // ✅ CÁLCULO CORRECTO: Solo el monto que NO se pagó va a crédito
      const montoACredito = totalTicket - entregaParcial;
      const saldoNuevo = saldoAnterior + montoACredito;

      console.log('💰 CÁLCULO DE CUENTA CORRIENTE:');
      
      console.log(`  💵 Entrega en efectivo: $${entregaParcial}`);
      console.log(`  🏦 Monto a crédito: $${montoACredito}`);
      console.log(`  📈 Saldo anterior: $${saldoAnterior}`);
      console.log(`  📈 Saldo nuevo: $${saldoNuevo}`);

      // Verificar límite de crédito
      if (cliente.limite_credito && saldoNuevo > parseFloat(cliente.limite_credito)) {
        await transaction.rollback();
        const disponible = parseFloat(cliente.limite_credito) - saldoAnterior;
        return res.status(400).json({ 
          error: 'Límite de crédito excedido',
          saldo_actual: saldoAnterior,
          limite_credito: cliente.limite_credito,
          credito_disponible: disponible,
          monto_solicitado: montoACredito
        });
      }

      // Actualizar saldo del cliente
      await cliente.update({
        saldo_cuenta_corriente: saldoNuevo
      }, { transaction });

      // ✅ REGISTRAR MOVIMIENTO DE VENTA COMPLETA
      await MovimientoCuentaCorriente.create({
        id_cliente: parseInt(id_cliente),
        id_ticket: nuevoTicket.id_ticket,
        tipo_movimiento: 'venta',
        monto: totalTicket, // ✅ TOTAL COMPLETO DE LA VENTA
        descripcion: `Venta - Ticket #${nuevoTicket.id_ticket}`,
        saldo_anterior: saldoAnterior,
        saldo_actual: saldoAnterior + totalTicket, // Saldo intermedio después de la venta
        id_usuario_registro: id_vendedor
      }, { transaction });

      console.log(`✅ Registrado movimiento de venta: +$${totalTicket}`);

      // ✅ REGISTRAR ENTREGA PARCIAL SI EXISTE
      if (entregaParcial > 0) {
        await MovimientoCuentaCorriente.create({
          id_cliente: parseInt(id_cliente),
          id_ticket: nuevoTicket.id_ticket,
          tipo_movimiento: 'entrega_parcial',
          monto: entregaParcial,
          descripcion: `Entrega efectivo - Ticket #${nuevoTicket.id_ticket}`,
          saldo_anterior: saldoAnterior + totalTicket, // Después de la venta
          saldo_actual: saldoNuevo, // Saldo final después de la entrega
          id_usuario_registro: id_vendedor
        }, { transaction });

        console.log(`✅ Registrado movimiento de entrega parcial: -$${entregaParcial}`);
      }

      console.log(`💰 Cuenta corriente actualizada para ${cliente.nombre}: $${saldoAnterior} → $${saldoNuevo}`);
    }

    await transaction.commit();
    
    const ticketCompleto = await Ticket.findByPk(nuevoTicket.id_ticket, {
      include: [
        {
          model: Cliente,
          as: 'cliente',
          attributes: ['id_cliente', 'nombre', 'saldo_cuenta_corriente', 'limite_credito']
        }
      ]
    });

    console.log('✅ Ticket completado exitosamente:', nuevoTicket.id_ticket);
    res.status(201).json({
      ticket: ticketCompleto,
      mensaje: tipo_pago === 'cuenta_corriente' ? 'Venta registrada en cuenta corriente' : 'Venta de contado registrada'
    });

  } catch (error) {
    console.error('❌ Error al guardar el ticket:', error);
    await transaction.rollback();
    res.status(500).json({ 
      error: 'Error al guardar el ticket',
      details: error.message 
    });
  }
});

// ✅ OBTENER TICKETS CON INFORMACIÓN DE CLIENTES
router.get('/', async (req, res) => {
  try {
    const { incluir_cliente = 'true', limite = 50 } = req.query;

    const options = {
      limit: parseInt(limite),
      order: [['fecha', 'DESC']]
    };

    if (incluir_cliente === 'true') {
      options.include = [
        {
          model: Cliente,
          as: 'cliente',
          attributes: ['id_cliente', 'nombre', 'email', 'es_cuenta_corriente'],
          required: false
        },
        {
          model: require('../models/Usuario'),
          as: 'vendedor',
          attributes: ['id_usuario', 'nombre'],
          required: false
        }
      ];
    }

    const tickets = await Ticket.findAll(options);
    
    console.log(`✅ Tickets obtenidos: ${tickets.length}`);
    res.json(tickets);
    
  } catch (error) {
    console.error('❌ Error al obtener tickets:', error);
    res.status(500).json({ error: 'Error al obtener los tickets' });
  }
});

// ✅ OBTENER TICKET POR ID CON DETALLES COMPLETOS
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await Ticket.findByPk(id, {
      include: [
        {
          model: Cliente,
          as: 'cliente',
          attributes: ['id_cliente', 'nombre', 'email', 'telefono', 'saldo_cuenta_corriente', 'limite_credito'],
          required: false
        },
        {
          model: require('../models/Usuario'),
          as: 'vendedor',
          attributes: ['id_usuario', 'nombre'],
          required: false
        }
      ]
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    // Si es cuenta corriente, obtener movimientos relacionados
    let movimientos = [];
    if (ticket.tipo_pago === 'cuenta_corriente' && ticket.id_cliente) {
      movimientos = await MovimientoCuentaCorriente.findAll({
        where: { id_ticket: id },
        order: [['fecha', 'ASC']],
        include: [
          {
            model: require('../models/Usuario'),
            as: 'usuario_registro',
            attributes: ['nombre'],
            required: false
          }
        ]
      });
    }

    res.json({
      ticket,
      movimientos
    });

  } catch (error) {
    console.error('❌ Error al obtener ticket:', error);
    res.status(500).json({ error: 'Error al obtener el ticket' });
  }
});

// ✅ NUEVA RUTA: Buscar tickets
router.get('/buscar', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const termino = q.trim();
    const { Op } = require('sequelize');
    
    // Construir condiciones de búsqueda
    const whereConditions = {
      [Op.or]: []
    };

    // Buscar por número de ticket
    if (!isNaN(termino)) {
      whereConditions[Op.or].push({
        id_ticket: {
          [Op.like]: `%${termino}%`
        }
      });
    }

    // Buscar por monto (si empieza con $ o es número)
    const montoTermino = termino.replace('$', '').replace(',', '');
    if (!isNaN(montoTermino) && montoTermino !== '') {
      whereConditions[Op.or].push({
        total: {
          [Op.like]: `%${montoTermino}%`
        }
      });
    }

    // Buscar por fecha (formato dd/mm/yyyy)
    if (termino.includes('/')) {
      const fechaPartes = termino.split('/');
      if (fechaPartes.length === 3) {
        try {
          const [dia, mes, año] = fechaPartes;
          const fechaBusqueda = `${año}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
          
          whereConditions[Op.or].push({
            fecha: {
              [Op.like]: `%${fechaBusqueda}%`
            }
          });
        } catch (error) {
          console.log('Formato de fecha inválido');
        }
      }
    }

    // Buscar en productos (por nombre)
    whereConditions[Op.or].push({
      productos: {
        [Op.like]: `%${termino}%`
      }
    });

    const tickets = await Ticket.findAll({
      where: whereConditions,
      include: [
        {
          model: Cliente,
          as: 'Cliente',
          required: false,
          where: {
            [Op.or]: [
              {
                nombre: {
                  [Op.like]: `%${termino}%`
                }
              },
              {
                email: {
                  [Op.like]: `%${termino}%`
                }
              }
            ]
          }
        }
      ],
      order: [['fecha', 'DESC']],
      limit: 50 // Máximo 50 resultados
    });

    // También buscar tickets sin filtro de cliente si no se encontraron
    if (tickets.length === 0) {
      const ticketsSinCliente = await Ticket.findAll({
        where: whereConditions,
        include: [
          {
            model: Cliente,
            as: 'Cliente',
            required: false
          }
        ],
        order: [['fecha', 'DESC']],
        limit: 50
      });
      
      return res.json(ticketsSinCliente);
    }

    res.json(tickets);
  } catch (error) {
    console.error('Error buscando tickets:', error);
    res.status(500).json({ error: 'Error al buscar tickets' });
  }
});

module.exports = router;