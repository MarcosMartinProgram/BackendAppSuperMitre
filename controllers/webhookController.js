const https = require('https');
const crypto = require('crypto');
const PedidoOnline = require('../models/PedidoOnline');

const MP_QR_ACCESS_TOKEN = process.env.MP_QR_ACCESS_TOKEN;
const MP_ONLINE_ACCESS_TOKEN = process.env.MP_ONLINE_ACCESS_TOKEN;
const WHATSAPP_NUMERO_DUEÑO = process.env.WHATSAPP_NUMERO_DUEÑO || '5491162415387';
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET;

// =============================================
// VERIFICAR FIRMA DEL WEBHOOK (opcional pero recomendado)
// =============================================
const verificarFirma = (req) => {
  // TODO: activar cuando MP envíe pagos reales con firma válida
  // Por ahora solo logueamos si viene firma o no
  const signatureHeader = req.headers['x-signature'];
  if (signatureHeader) {
    console.log('🔒 Firma recibida (verificación deshabilitada en dev)');
  }
  return true;
};

// =============================================
// WEBHOOK DE MERCADOPAGO
// =============================================
const webhook = async (req, res) => {
  try {
    console.log('\n🔔 === WEBHOOK MERCADOPAGO RECIBIDO ===');
    console.log('📋 Tipo:', req.query.type || req.body?.type);
    console.log('📋 ID:', req.query.id || req.body?.data?.id);

    // Verificar firma si está configurada
    if (!verificarFirma(req)) {
      return res.status(401).json({ error: 'Firma inválida' });
    }

    // MP envía una notificación con type e id
    const type = req.query.type || req.body?.type;
    const resourceId = req.query.id || req.body?.data?.id;

    if (type === 'payment' && resourceId) {
      // Consultar el pago para obtener los detalles
      const paymentData = await consultarPago(String(resourceId));

      if (paymentData) {
        await procesarPago(paymentData);
      }
    } else if (type === 'order' && resourceId) {
      // Pagos QR envían tipo 'order' con order ID
      console.log('📱 Consultando orden QR:', resourceId);
      try {
        const orderData = await consultarOrden(String(resourceId));
        console.log('📱 Orden data:', JSON.stringify(orderData, null, 2));

        const payments = orderData.payments || orderData.transactions?.payments || [];

        if (payments.length > 0) {
          console.log(`💳 Encontrados ${payments.length} pagos en la orden`);
          for (const payment of payments) {
            console.log(`💳 Pago ${payment.id}: estado=${payment.status}`);
            if (payment.status === 'approved') {
              await procesarPago(payment);
            }
          }
        } else if (orderData.id) {
          console.log('⚠️ Orden sin payments, intentando como pago:', orderData.id);
          const paymentData = await consultarPago(String(orderData.id));
          if (paymentData) {
            await procesarPago(paymentData);
          }
        } else {
          console.log('⚠️ No se pudo procesar la orden:', resourceId);
        }
      } catch (orderError) {
        console.error('💥 Error consultando orden QR:', JSON.stringify(orderError));
      }
    }

    // Siempre responder 200 a MP para que no reintente
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('💥 Error en webhook:', error.message || JSON.stringify(error));
    res.status(200).json({ received: true });
  }
};

// =============================================
// CONSULTAR ORDEN POR ID (pagos QR)
// =============================================
const consultarOrden = (orderId) => {
  return new Promise((resolve, reject) => {
    const token = MP_QR_ACCESS_TOKEN || MP_ONLINE_ACCESS_TOKEN;
    console.log('🔑 Token QR:', MP_QR_ACCESS_TOKEN ? 'SÍ configurado' : 'NO configurado');
    console.log('🔑 Token Online:', MP_ONLINE_ACCESS_TOKEN ? 'SÍ configurado' : 'NO configurado');
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
        console.log('📡 MP respondió orden:', res.statusCode);
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            console.error('❌ Error MP orden:', res.statusCode, JSON.stringify(parsed).substring(0, 500));
            reject({ status: res.statusCode, data: parsed });
          } else {
            resolve(parsed);
          }
        } catch (e) {
          console.error('❌ Error parseando respuesta MP:', res.statusCode, data.substring(0, 500));
          reject({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', (err) => { console.error('❌ Error de conexión:', err.message); reject(err); });
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
};

// =============================================
// CONSULTAR PAGO POR ID
// =============================================
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

// =============================================
// PROCESAR PAGO APROBADO
// =============================================
const procesarPago = async (payment) => {
  try {
    console.log('💰 Procesando pago:', payment.id, '- Estado:', payment.status);

    if (payment.status !== 'approved' && payment.status !== 'processed') {
      console.log('⏳ Pago no aprobado, estado:', payment.status);
      return;
    }

    // Verificar si ya procesamos este pago
    const existente = await PedidoOnline.findOne({ where: { mp_payment_id: String(payment.id) } });
    if (existente) {
      console.log('⚠️ Pago ya procesado anteriormente:', payment.id);
      return;
    }

    // Buscar pedido pre-registrado por external_reference
    const existenteRef = payment.external_reference
      ? await PedidoOnline.findOne({ where: { mp_external_reference: String(payment.external_reference) } })
      : null;

    // Extraer items del pago (puede venir de /v1/payments/ o de /v1/orders/)
    const items = payment.additional_info?.items || [];
    const itemsFormateados = items.map(item => ({
      nombre: item.title || 'Producto',
      precio: parseFloat(item.unit_price) || 0,
      cantidad: parseInt(item.quantity) || 1,
    }));

    // El total puede estar en transaction_amount (/v1/payments) o amount (/v1/orders/)
    const total = itemsFormateados.reduce((acc, item) => acc + (item.precio * item.cantidad), 0)
      || parseFloat(payment.transaction_amount)
      || parseFloat(payment.amount)
      || 0;

    // Nombre del payer (puede no existir en órdenes QR)
    const payerNombre = payment.payer?.first_name
      ? `${payment.payer.first_name} ${payment.payer.last_name || ''}`.trim()
      : null;
    const payerEmail = payment.payer?.email || null;
    const payerTelefono = payment.payer?.phone?.number || null;

    // Crear o actualizar el pedido
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
      console.log('✅ Pedido pre-registrado actualizado:', pedido.id_pedido);
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
      console.log('✅ Pedido creado desde webhook:', pedido.id_pedido);
    }

    // Enviar WhatsApp al dueño
    await notificarWhatsApp(pedido);

    return pedido;
  } catch (error) {
    console.error('💥 Error procesando pago:', error.message);
    throw error;
  }
};

// =============================================
// NOTIFICACIÓN POR WHATSAPP
// =============================================
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

    // Construir URL de WhatsApp con el mensaje pre-cargado
    const numeroLimpio = WHATSAPP_NUMERO_DUEÑO.replace(/[^0-9]/g, '');
    const urlWhatsApp = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;

    console.log('📱 WhatsApp URL generada:', urlWhatsApp);

    // Marcar como notificado
    await pedido.update({ notificado_whatsapp: true });

    return urlWhatsApp;
  } catch (error) {
    console.error('💥 Error generando WhatsApp:', error.message);
    return null;
  }
};

module.exports = { webhook, consultarPago, procesarPago, notificarWhatsApp };
