const express = require('express');
const router = express.Router();
const PedidoOnline = require('../models/PedidoOnline');
const { webhook, notificarWhatsApp } = require('../controllers/webhookController');

// =============================================
// WEBHOOK - MercadoPago envía notificaciones aquí
// =============================================
router.post('/webhook', webhook);
router.get('/webhook', webhook); // MP también puede enviar GET

// =============================================
// LISTAR PEDIDOS ONLINE
// =============================================
router.get('/', async (req, res) => {
  try {
    const { estado } = req.query;
    const where = {};
    if (estado) where.estado = estado;

    const pedidos = await PedidoOnline.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: 50,
    });

    res.json(pedidos);
  } catch (error) {
    console.error('Error al listar pedidos:', error.message);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

// =============================================
// OBTENER PEDIDO POR ID
// =============================================
router.get('/:id', async (req, res) => {
  try {
    const pedido = await PedidoOnline.findByPk(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(pedido);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener pedido' });
  }
});

// =============================================
// ACTUALIZAR ESTADO DEL PEDIDO
// =============================================
router.put('/:id/estado', async (req, res) => {
  try {
    const { estado } = req.body;
    const estadosValidos = ['pendiente', 'en_preparacion', 'entregado', 'cancelado'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: `Estado inválido. Válidos: ${estadosValidos.join(', ')}` });
    }

    const pedido = await PedidoOnline.findByPk(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    await pedido.update({ estado });
    res.json(pedido);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar pedido' });
  }
});

// =============================================
// REENVIAR NOTIFICACIÓN WHATSAPP
// =============================================
router.post('/:id/reenviar-whatsapp', async (req, res) => {
  try {
    const pedido = await PedidoOnline.findByPk(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    const urlWhatsApp = await notificarWhatsApp(pedido);
    res.json({ url_whatsapp: urlWhatsApp });
  } catch (error) {
    res.status(500).json({ error: 'Error al reenviar notificación' });
  }
});

module.exports = router;
