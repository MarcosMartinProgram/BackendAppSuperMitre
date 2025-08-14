// /routes/tickets.js
const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Cliente = require('../models/Cliente');
const MovimientoCuentaCorriente = require('../models/MovimientoCuentaCorriente');
const sequelize = require('../config/database');

// Guardar un ticket
router.post('/', async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { 
      productos, 
      descuento, 
      total, 
      pago = 0,
      entrega = 0,
      id_cliente = null,
      tipo_pago = 'contado',
      id_vendedor = null
    } = req.body;

    // Crear el ticket
    const nuevoTicket = await Ticket.create({
      productos,
      descuento: parseFloat(descuento) || 0,
      total: parseFloat(total),
      id_cliente: id_cliente || null,
      tipo_pago,
      id_vendedor: id_vendedor || null
    }, { transaction });

    // Si es cuenta corriente, actualizar saldo del cliente
    if (tipo_pago === 'cuenta_corriente' && id_cliente) {
      const cliente = await Cliente.findByPk(id_cliente, { transaction });
      
      if (!cliente) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Cliente no encontrado' });
      }

      if (!cliente.es_cuenta_corriente) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Este cliente no maneja cuenta corriente' });
      }

      const saldoAnterior = parseFloat(cliente.saldo_cuenta_corriente);
      const saldoNuevo = saldoAnterior + parseFloat(total);

      // Verificar límite de crédito
      if (cliente.limite_credito && saldoNuevo > cliente.limite_credito) {
        await transaction.rollback();
        return res.status(400).json({ error: 'El saldo excede el límite de crédito del cliente' });
      }

      // Actualizar saldo del cliente
      await Cliente.update({ saldo_cuenta_corriente: saldoNuevo }, {
        where: { id: id_cliente },
        transaction
      });

      // Registrar movimiento en cuenta corriente
      await MovimientoCuentaCorriente.create({
        id_cliente,
        tipo: 'ingreso',
        monto: total,
        saldo_anterior: saldoAnterior,
        saldo_nuevo: saldoNuevo,
        id_ticket: nuevoTicket.id
      }, { transaction });
    }

    await transaction.commit();
    res.status(201).json(nuevoTicket);
  } catch (error) {
    console.error('Error al guardar el ticket:', error);
    await transaction.rollback();
    res.status(500).json({ error: 'Error al guardar el ticket' });
  }
});

// Obtener todos los tickets
router.get('/', async (req, res) => {
  try {
    const tickets = await Ticket.findAll();
    res.status(200).json(tickets);
  } catch (error) {
    console.error('Error al obtener los tickets:', error);
    res.status(500).json({ error: 'Error al obtener los tickets' });
  }
});

module.exports = router;