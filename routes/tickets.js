// /routes/tickets.js
const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');

// Guardar un ticket
router.post('/', async (req, res) => {
  const { productos, descuento, total } = req.body;

  try {
    const nuevoTicket = await Ticket.create({ productos, descuento, total });
    res.status(201).json(nuevoTicket);
  } catch (error) {
    console.error('Error al guardar el ticket:', error);
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