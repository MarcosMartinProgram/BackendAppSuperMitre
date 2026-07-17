const express = require('express');
const router = express.Router();
const PedidoOnline = require('../models/PedidoOnline');
const { webhook, notificarWhatsApp } = require('../controllers/webhookController');

// =============================================
// WEBHOOK - MercadoPago envía notificaciones aquí
// Capturar raw body para verificar firma HMAC
// =============================================
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body.toString();
  try { req.body = JSON.parse(req.rawBody); } catch (e) { /* keep raw */ }
  next();
}, webhook);
router.get('/webhook', webhook);

// =============================================
// REGISTRAR PEDIDO DESDE FRONTEND (QR aprobado)
// El frontend llama esto cuando el polling detecta pago aprobado
// =============================================
router.post('/registrar', async (req, res) => {
  try {
    console.log('📥 Recibido pedido para registrar:', JSON.stringify(req.body, null, 2));

    const { order_id, payment_id, total, productos, cliente_nombre, cliente_email, cliente_telefono, cliente_direccion, id_usuario, origen } = req.body;

    if (!order_id || !total) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: order_id, total' });
    }

    // Verificar si ya existe este pedido por order_id
    const existente = await PedidoOnline.findOne({ where: { mp_external_reference: String(order_id) } });
    if (existente) {
      console.log('⚠️ Pedido ya registrado:', existente.id_pedido);
      return res.json({ success: true, pedido: existente, duplicate: true });
    }

    const itemsFormateados = (productos || []).map(p => ({
      nombre: p.nombre || 'Producto',
      precio: parseFloat(p.precio) || 0,
      cantidad: parseInt(p.cantidad) || 1,
    }));

    const pedido = await PedidoOnline.create({
      mp_payment_id: payment_id ? String(payment_id) : null,
      mp_external_reference: String(order_id),
      mp_status: 'approved',
      cliente_nombre: cliente_nombre || null,
      cliente_email: cliente_email || null,
      cliente_telefono: cliente_telefono || null,
      cliente_direccion: cliente_direccion || null,
      id_usuario: id_usuario || null,
      items: itemsFormateados.length > 0 ? itemsFormateados : [{ nombre: 'Pedido', precio: parseFloat(total), cantidad: 1 }],
      total: parseFloat(total),
      estado: 'pendiente',
      origen: origen || 'web',
    });

    console.log('✅ Pedido registrado desde frontend:', pedido.id_pedido);

    const urlWhatsApp = await notificarWhatsApp(pedido);

    res.json({ success: true, pedido, url_whatsapp: urlWhatsApp });
  } catch (error) {
    console.error('💥 Error registrando pedido:', error.message);
    res.status(500).json({ error: 'Error al registrar pedido' });
  }
});

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
// MIS PEDIDOS - por id_usuario
// =============================================
router.get('/mis-pedidos', async (req, res) => {
  try {
    const { id_usuario } = req.query;
    if (!id_usuario) {
      return res.status(400).json({ error: 'id_usuario requerido' });
    }

    const pedidos = await PedidoOnline.findAll({
      where: { id_usuario: parseInt(id_usuario) },
      order: [['created_at', 'DESC']],
      limit: 50,
    });

    res.json(pedidos);
  } catch (error) {
    console.error('Error al listar mis pedidos:', error.message);
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
