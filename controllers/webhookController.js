const https = require('https');
const crypto = require('crypto');
const PedidoOnline = require('../models/PedidoOnline');

const MP_QR_ACCESS_TOKEN = process.env.MP_QR_ACCESS_TOKEN;
const MP_ONLINE_ACCESS_TOKEN = process.env.MP_ONLINE_ACCESS_TOKEN;
const WHATSAPP_NUMERO_DUENO = process.env.WHATSAPP_NUMERO_DUENO || '5491162415387';
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET;

const verificarFirma = (req) => {
  if (!MP_WEBHOOK_SECRET) {
    console.log('⚠️ MP_WEBHOOK_SECRET no configurado, saltando verificación de firma');
    return true;
  }

  try {
    const xSignature = req.headers['x-signature'];
    const xRequestId = req.headers['x-request-id'];

    if (!xSignature) {
      console.log('⚠️ Webhook sin x-signature header');
      return false;
    }

    const parts = xSignature.split(',');
    let ts = '', hash = '';

    for (const part of parts) {
      const [key, value] = part.trim().split('=');
      if (key === 'ts') ts = value;
      if (key === 'v1') hash = value;
    }

    if (!ts || !hash) {
      console.log('⚠️ Formato de x-signature inválido');
      return false;
    }

    const manifest = `id:${req.body?.id || req.query?.id || ''};request-id:${xRequestId || ''};ts:${ts};`;
    const expectedHash = crypto
      .createHmac('sha256', MP_WEBHOOK_SECRET)
      .update(manifest)
      .digest('hex');

    if (hash !== expectedHash) {
      console.log('❌ Firma del webhook inválida');
      return false;
    }

    console.log('✅ Firma del webhook verificada');
    return true;
  } catch (error) {
    console.error('❌ Error verificando firma:', error.message);
    return false;
  }
};

const webhook = async (req, res) => {
  try {
    if (!verificarFirma(req)) {
      return res.status(401).json({ error: 'Firma inválida' });
    }

    const type = req.query.type || req.body?.type;
    const resourceId = req.query.id || req.body?.data?.id;

    if (type === 'payment' && resourceId) {
      const paymentData = await consultarPago(String(resourceId));
      if (paymentData) {
        await procesarPago(paymentData);
      }
    } else if (type === 'order' && resourceId) {
      try {
        const orderData = await consultarOrden(String(resourceId));
        const payments = orderData.payments || orderData.transactions?.payments || [];

        if (payments.length > 0) {
          for (const payment of payments) {
            if (payment.status === 'approved') {
              await procesarPago(payment);
            }
          }
        } else if (orderData.id) {
          const paymentData = await consultarPago(String(orderData.id));
          if (paymentData) {
            await procesarPago(paymentData);
          }
        }
      } catch (orderError) {
        console.error('Error consultando orden QR:', orderError.message || orderError);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error en webhook:', error.message || error);
    res.status(200).json({ received: true });
  }
};

const consultarOrden = (orderId) => {
  return new Promise((resolve, reject) => {
    const token = MP_QR_ACCESS_TOKEN || MP_ONLINE_ACCESS_TOKEN;
    const options = {
      hostname: 'api.mercadopago.com',
      path: `/v1/orders/${orderId}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject({ status: res.statusCode, data: parsed });
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
};

const consultarPago = (paymentId) => {
  return new Promise((resolve, reject) => {
    const token = MP_ONLINE_ACCESS_TOKEN || MP_QR_ACCESS_TOKEN;
    const options = {
      hostname: 'api.mercadopago.com',
      path: `/v1/payments/${paymentId}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject({ status: res.statusCode, data: parsed });
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
};

const procesarPago = async (payment) => {
  try {
    if (payment.status !== 'approved' && payment.status !== 'processed') {
      return;
    }

    const existente = await PedidoOnline.findOne({ where: { mp_payment_id: String(payment.id) } });
    if (existente) {
      return;
    }

    let existenteRef = payment.external_reference
      ? await PedidoOnline.findOne({ where: { mp_external_reference: String(payment.external_reference) } })
      : null;

    if (!existenteRef && payment.external_reference) {
      existenteRef = await PedidoOnline.findOne({
        where: { mp_status: 'pending', estado: 'pendiente' },
        order: [['created_at', 'DESC']],
      });
    }

    const items = payment.additional_info?.items || [];
    const itemsFormateados = items.map(item => ({
      nombre: item.title || 'Producto',
      precio: parseFloat(item.unit_price) || 0,
      cantidad: parseInt(item.quantity) || 1,
    }));

    const total = itemsFormateados.reduce((acc, item) => acc + (item.precio * item.cantidad), 0)
      || parseFloat(payment.transaction_amount)
      || parseFloat(payment.amount)
      || 0;

    const payerNombre = payment.payer?.first_name
      ? `${payment.payer.first_name} ${payment.payer.last_name || ''}`.trim()
      : null;
    const payerEmail = payment.payer?.email || null;
    const payerTelefono = payment.payer?.phone?.number || null;

    let pedido;
    if (existenteRef) {
      await existenteRef.update({
        mp_payment_id: String(payment.id),
        mp_status: payment.status,
        cliente_nombre: existenteRef.cliente_nombre || payerNombre,
        cliente_email: existenteRef.cliente_email || payerEmail,
        cliente_telefono: existenteRef.cliente_telefono || payerTelefono,
      });
      pedido = existenteRef;
    } else {
      pedido = await PedidoOnline.create({
        mp_payment_id: String(payment.id),
        mp_preference_id: payment.metadata?.preference_id || null,
        mp_external_reference: payment.external_reference || null,
        mp_status: payment.status,
        cliente_nombre: payerNombre,
        cliente_email: payerEmail,
        cliente_telefono: payerTelefono,
        items: itemsFormateados.length > 0 ? itemsFormateados : [{ nombre: 'Pedido', precio: total, cantidad: 1 }],
        total: total,
        estado: 'pendiente',
        origen: 'web',
      });
    }

    await notificarWhatsApp(pedido);
    return pedido;
  } catch (error) {
    console.error('Error procesando pago:', error.message);
    throw error;
  }
};

const notificarWhatsApp = async (pedido) => {
  try {
    const items = typeof pedido.items === 'string' ? JSON.parse(pedido.items) : pedido.items;

    const lineasProductos = items.map(item =>
      `  • ${item.cantidad}x ${item.nombre} - $${(item.precio * item.cantidad).toFixed(2)}`
    ).join('\n');

    const mensaje = [
      `🛒 *¡Nuevo Pedido Online!*`,
      ``,
      `📋 Pedido #${pedido.id_pedido}`,
      pedido.origen ? `📱 Origen: ${pedido.origen === 'app_movil' ? 'App Móvil' : pedido.origen === 'web' ? 'Sitio Web' : pedido.origen}` : null,
      `👤 ${pedido.cliente_nombre || 'Cliente'}`,
      pedido.cliente_telefono ? `📱 WhatsApp: ${pedido.cliente_telefono}` : null,
      pedido.cliente_direccion ? `📍 Dirección: ${pedido.cliente_direccion}` : null,
      pedido.cliente_email ? `📧 ${pedido.cliente_email}` : null,
      ``,
      `*Productos:*`,
      lineasProductos,
      ``,
      `💰 *Total: $${parseFloat(pedido.total).toFixed(2)}*`,
      ``,
      `🔗 Ver pedido: https://www.supermitre.com.ar/pedidos-online`,
    ].filter(Boolean).join('\n');

    const numeroLimpio = WHATSAPP_NUMERO_DUENO.replace(/[^0-9]/g, '');
    const urlWhatsApp = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;

    await pedido.update({ notificado_whatsapp: true });

    return urlWhatsApp;
  } catch (error) {
    console.error('Error generando WhatsApp:', error.message);
    return null;
  }
};

module.exports = { webhook, consultarPago, procesarPago, notificarWhatsApp };
