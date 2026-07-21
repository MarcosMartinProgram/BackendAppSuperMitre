const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const afipService = require('../services/afipService');

// ==================== CONFIGURACIÓN ====================

router.get('/config', async (req, res) => {
  try {
    const mode = process.env.AFIP_MODE || 'homologacion';
    const cuit = process.env.AFIP_CUIT || '';
    const ptoVta = parseInt(process.env.AFIP_PTO_VTA || '1', 10);
    const certificados = afipService.verificarCertificados();

    res.json({
      modo: mode,
      cuit,
      puntoVenta: ptoVta,
      certificados,
      wsfeUrl: mode === 'produccion'
        ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
        : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
    });
  } catch (err) {
    console.error('Error en /config:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ÚLTIMO COMPROBANTE ====================

router.get('/ultimo-comprobante', async (req, res) => {
  try {
    const mode = process.env.AFIP_MODE || 'homologacion';
    const cuit = process.env.AFIP_CUIT;
    const ptoVta = parseInt(process.env.AFIP_PTO_VTA || '1', 10);
    const cbteTipo = parseInt(req.query.tipo || '11', 10);

    if (!cuit) {
      return res.status(400).json({ error: 'AFIP_CUIT no configurado en .env' });
    }

    const { token, sign } = await afipService.obtenerTicketAcceso(mode);
    const ultimo = await afipService.consultarUltimoComprobante(token, sign, cuit, ptoVta, cbteTipo);

    res.json({
      ultimo,
      proximo: ultimo + 1,
      tipo: cbteTipo,
      puntoVenta: ptoVta,
      nombre: afipService.nombreComprobante(cbteTipo),
    });
  } catch (err) {
    console.error('Error en /ultimo-comprobante:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== SOLICITAR CAE ====================

router.post('/solicitar-cae', async (req, res) => {
  try {
    const mode = process.env.AFIP_MODE || 'homologacion';
    const cuit = process.env.AFIP_CUIT;
    const ptoVta = parseInt(process.env.AFIP_PTO_VTA || '1', 10);

    if (!cuit) {
      return res.status(400).json({ error: 'AFIP_CUIT no configurado en .env' });
    }

    const { id_ticket, tipo_comprobante, doc_tipo, doc_nro, cond_iva_receptor } = req.body;

    if (!id_ticket) {
      return res.status(400).json({ error: 'Falta id_ticket' });
    }

    // 1. Buscar el ticket
    const ticket = await Ticket.findByPk(id_ticket, {
      include: [{ association: 'cliente' }],
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    if (ticket.cae) {
      return res.status(400).json({ error: 'Este ticket ya fue facturado (tiene CAE)', cae: ticket.cae });
    }

    // 2. Determinar tipo de comprobante
    const cbteTipo = parseInt(tipo_comprobante || '11', 10); // default Factura C

    // 3. Parsear productos del ticket
    let productos = [];
    try {
      productos = JSON.parse(ticket.productos);
    } catch (e) {
      return res.status(400).json({ error: 'Error parseando productos del ticket' });
    }

    // 4. Calcular IVA según tipo de comprobante
    const importeTotal = parseFloat(ticket.total);
    const descuento = parseFloat(ticket.descuento || 0);
    const sub = productos.reduce((acc, p) => acc + parseFloat(p.precio_venta || p.precio) * (p.cantidad || 1), 0);
    const totalConDesc = sub - (sub * descuento / 100);

    let impNeto, impIVA, alicuotas;

    if ([11, 15].includes(cbteTipo)) {
      // Factura C: IVA incluido, no se desglosa
      impNeto = importeTotal;
      impIVA = 0;
      alicuotas = [];
    } else {
      // Factura A/B: desglosar IVA
      const ivaData = afipService.calcularAlicuotas(productos, cbteTipo);
      impNeto = ivaData.impNeto;
      impIVA = ivaData.impIVA;
      alicuotas = ivaData.alicuotas;
    }

    // 5. Determinar documento receptor
    let docTipoFinal = parseInt(doc_tipo || '99', 10);
    let docNroFinal = parseInt(doc_nro || '0', 10);
    let condIvaReceptor = parseInt(cond_iva_receptor || '5', 10); // default Consumidor Final

    if (ticket.cliente) {
      // Si tiene cliente, usar sus datos (si están configurados)
      if (ticket.cliente.cuit) {
        docTipoFinal = 80; // CUIT
        docNroFinal = ticket.cliente.cuit;
        condIvaReceptor = ticket.cliente.cond_iva || 5;
      }
    }

    // 6. Obtener último comprobante y calcular próximo número
    const { token, sign } = await afipService.obtenerTicketAcceso(mode);
    const ultimo = await afipService.consultarUltimoComprobante(token, sign, cuit, ptoVta, cbteTipo);
    const proximoNumero = ultimo + 1;

    // 7. Formatear fecha actual Argentina (formatFechaComp ya convierte UTC→ART)
    const nowUtc = new Date();
    const fechaEmision = afipService.formatFechaComp(nowUtc);

    console.log(`📅 Fecha emisión: ${fechaEmision} (UTC: ${nowUtc.toISOString()})`);

    // 8. Solicitar CAE
    const resultado = await afipService.solicitarCAE(token, sign, cuit, {
      tipoComprobante: cbteTipo,
      puntoVenta: ptoVta,
      numeroComprobante: proximoNumero,
      docTipo: docTipoFinal,
      docNro: docNroFinal,
      fechaEmision,
      importeTotal,
      impNeto,
      impIVA,
      condicionIVAReceptorId: condIvaReceptor,
      alicuotas,
    });

    if (!resultado.aprobado) {
      console.error('❌ Detalle rechazo AFIP:', JSON.stringify(resultado, null, 2));
      return res.status(400).json({
        error: 'CAE rechazado/observado',
        resultado: resultado.resultado,
        observaciones: resultado.observaciones,
        xmlRespuesta: resultado.xmlRespuesta,
      });
    }

    // 9. Generar QR como data URL (embebido, no depende de servidor externo)
    const qrDataUrl = await afipService.generarQrDataUrl({
      cuit,
      puntoVenta: ptoVta,
      tipoComprobante: cbteTipo,
      numeroComprobante: proximoNumero,
      importeTotal,
      fechaEmision: afipService.formatFechaQR(nowUtc),
      cae: resultado.cae,
      tipoDocRec: docTipoFinal,
      nroDocRec: docNroFinal,
    });

    // URL de verificación ARCA para referencia
    const qrVerifyUrl = afipService.construirUrlQrAfip({
      cuit,
      puntoVenta: ptoVta,
      tipoComprobante: cbteTipo,
      numeroComprobante: proximoNumero,
      importeTotal,
      fechaEmision: afipService.formatFechaQR(nowUtc),
      cae: resultado.cae,
      tipoDocRec: docTipoFinal,
      nroDocRec: docNroFinal,
    });

    // 10. Guardar en el ticket
    await ticket.update({
      cae: resultado.cae,
      vencimiento_cae: resultado.vencimiento,
      tipo_comprobante_afip: cbteTipo,
      numero_comprobante_afip: proximoNumero,
      qr_afip_url: qrDataUrl,
    });

    console.log(`✅ Ticket #${id_ticket} facturado: ${afipService.nombreComprobante(cbteTipo)} N° ${proximoNumero}, CAE: ${resultado.cae}`);

    res.json({
      ok: true,
      cae: resultado.cae,
      vencimiento: resultado.vencimiento,
      numero: proximoNumero,
      tipoComprobante: cbteTipo,
      nombreComprobante: afipService.nombreComprobante(cbteTipo),
      puntoVenta: ptoVta,
      qr_url: qrDataUrl,
      qr_verify_url: qrVerifyUrl,
    });
  } catch (err) {
    console.error('❌ Error en /solicitar-cae:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ANULAR COMPROBANTE (Nota de Crédito) ====================

router.post('/anular', async (req, res) => {
  try {
    const mode = process.env.AFIP_MODE || 'homologacion';
    const cuit = process.env.AFIP_CUIT;
    const ptoVta = parseInt(process.env.AFIP_PTO_VTA || '1', 10);

    if (!cuit) {
      return res.status(400).json({ error: 'AFIP_CUIT no configurado en .env' });
    }

    const { id_ticket } = req.body;

    if (!id_ticket) {
      return res.status(400).json({ error: 'Falta id_ticket' });
    }

    // 1. Buscar el ticket original
    const ticketOriginal = await Ticket.findByPk(id_ticket);
    if (!ticketOriginal) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    if (!ticketOriginal.cae) {
      return res.status(400).json({ error: 'El ticket no tiene CAE (no fue facturado)' });
    }

    // 2. Determinar tipo de nota de crédito según comprobante original
    const tipoOriginal = ticketOriginal.tipo_comprobante_afip;
    let tipoNC;
    if ([1, 5].includes(tipoOriginal)) tipoNC = 3;      // Factura A → NC A
    else if ([6, 10].includes(tipoOriginal)) tipoNC = 8;  // Factura B → NC B
    else if ([11, 15].includes(tipoOriginal)) tipoNC = 13; // Factura C → NC C
    else {
      return res.status(400).json({ error: `Tipo de comprobante original (${tipoOriginal}) no soportado para anulación` });
    }

    // 3. Parsear productos
    let productos = [];
    try {
      productos = JSON.parse(ticketOriginal.productos);
    } catch (e) {
      return res.status(400).json({ error: 'Error parseando productos' });
    }

    const importeTotal = parseFloat(ticketOriginal.total);

    // 4. Calcular IVA (mismo criterio que el original)
    let impNeto, impIVA, alicuotas;
    if ([3, 13].includes(tipoNC)) {
      impNeto = importeTotal;
      impIVA = 0;
      alicuotas = [];
    } else {
      const ivaData = afipService.calcularAlicuotas(productos, tipoNC);
      impNeto = ivaData.impNeto;
      impIVA = ivaData.impIVA;
      alicuotas = ivaData.alicuotas;
    }

    // 5. Obtener último N° NC y solicitar CAE
    const { token, sign } = await afipService.obtenerTicketAcceso(mode);
    const ultimo = await afipService.consultarUltimoComprobante(token, sign, cuit, ptoVta, tipoNC);
    const proximoNumero = ultimo + 1;

    const fecha = new Date();
    const fechaEmision = afipService.formatFechaComp(fecha);

    const resultado = await afipService.solicitarCAE(token, sign, cuit, {
      tipoComprobante: tipoNC,
      puntoVenta: ptoVta,
      numeroComprobante: proximoNumero,
      docTipo: 99,
      docNro: 0,
      fechaEmision,
      importeTotal,
      impNeto,
      impIVA,
      condicionIVAReceptorId: 5,
      alicuotas,
    });

    if (!resultado.aprobado) {
      return res.status(400).json({
        error: 'NC rechazada/observada',
        resultado: resultado.resultado,
        observaciones: resultado.observaciones,
      });
    }

    // 6. Generar QR de la NC como data URL
    const qrUrl = await afipService.generarQrDataUrl({
      cuit,
      puntoVenta: ptoVta,
      tipoComprobante: tipoNC,
      numeroComprobante: proximoNumero,
      importeTotal,
      fechaEmision: afipService.formatFechaQR(fecha),
      cae: resultado.cae,
    });

    console.log(`✅ NC generada: ${afipService.nombreComprobante(tipoNC)} N° ${proximoNumero}, CAE: ${resultado.cae}`);

    res.json({
      ok: true,
      cae: resultado.cae,
      vencimiento: resultado.vencimiento,
      numero: proximoNumero,
      tipoComprobante: tipoNC,
      nombreComprobante: afipService.nombreComprobante(tipoNC),
      puntoVenta: ptoVta,
      qr_url: qrUrl,
      comprobanteOriginal: {
        id_ticket: ticketOriginal.id_ticket,
        cae: ticketOriginal.cae,
        numero: ticketOriginal.numero_comprobante_afip,
      },
    });
  } catch (err) {
    console.error('❌ Error en /anular:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== TEST CONEXIÓN WSAA ====================

router.get('/test-wsaa', async (req, res) => {
  try {
    const mode = process.env.AFIP_MODE || 'homologacion';
    const { token, sign, expiration } = await afipService.obtenerTicketAcceso(mode);
    res.json({
      ok: true,
      modo: mode,
      expiration,
      tokenLength: token.length,
      signLength: sign.length,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
