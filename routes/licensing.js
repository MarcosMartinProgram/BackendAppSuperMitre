const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const Licencia = require('../models/Licencia');
const { verificarToken, verificarRol } = require('../middleware/authMiddleware');

const RSA_PRIVATE_KEY = process.env.RSA_PRIVATE_KEY;
if (!RSA_PRIVATE_KEY) {
  console.error('RSA_PRIVATE_KEY no definida en .env. El sistema de licencias no funcionará.');
}

function firmarPayload(payload) {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(payload);
  sign.end();
  return sign.sign(RSA_PRIVATE_KEY, 'base64');
}

// POST /api/licensing/create — Crear licencia (solo admin)
router.post('/create', verificarToken, verificarRol('master'), async (req, res) => {
  try {
    const { licenseKey, clientName, expiresAt } = req.body;

    if (!licenseKey || !clientName) {
      return res.status(400).json({ ok: false, error: 'Faltan campos requeridos: licenseKey, clientName' });
    }

    const existente = await Licencia.findOne({ where: { license_key: licenseKey } });
    if (existente) {
      return res.status(400).json({ ok: false, error: 'Ya existe una licencia con esa clave' });
    }

    const licencia = await Licencia.create({
      license_key: licenseKey,
      client_name: clientName,
      expires_at: expiresAt || null,
    });

    res.json({ ok: true, id: licencia.id_licencia });
  } catch (error) {
    console.error('Error al crear licencia:', error.message);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
});

// POST /api/licensing/activate — Activar licencia (público)
router.post('/activate', async (req, res) => {
  try {
    const { licenseKey, hwid } = req.body;

    if (!licenseKey || !hwid) {
      return res.status(400).json({ ok: false, error: 'Faltan campos requeridos: licenseKey, hwid' });
    }

    if (!RSA_PRIVATE_KEY) {
      return res.status(500).json({ ok: false, error: 'Servidor no configurado para firmar licencias' });
    }

    const licencia = await Licencia.findOne({ where: { license_key: licenseKey } });
    if (!licencia) {
      return res.status(400).json({ ok: false, error: 'Licencia no encontrada' });
    }

    if (!licencia.active) {
      return res.status(400).json({ ok: false, error: 'Licencia desactivada' });
    }

    if (licencia.expires_at && new Date(licencia.expires_at) < new Date()) {
      return res.status(400).json({ ok: false, error: 'Licencia vencida' });
    }

    if (licencia.hwid && licencia.hwid !== hwid) {
      return res.status(400).json({ ok: false, error: 'Esta licencia está vinculada a otra máquina' });
    }

    if (!licencia.hwid) {
      licencia.hwid = hwid;
      await licencia.save();
    }

    const expiresStr = licencia.expires_at
      ? new Date(licencia.expires_at).toISOString().split('T')[0]
      : '';

    const payload = `${hwid}|${expiresStr}|${licencia.client_name}|${licenseKey}`;
    const signature = firmarPayload(payload);

    res.json({ ok: true, payload, signature });
  } catch (error) {
    console.error('Error al activar licencia:', error.message);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
});

// GET /api/licensing/list — Listar licencias (solo admin)
router.get('/list', verificarToken, verificarRol('master'), async (req, res) => {
  try {
    const licencias = await Licencia.findAll({
      order: [['created_at', 'DESC']],
      attributes: ['id_licencia', 'license_key', 'hwid', 'client_name', 'expires_at', 'active', 'created_at'],
    });
    res.json({ ok: true, licencias });
  } catch (error) {
    console.error('Error al listar licencias:', error.message);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
});

module.exports = router;
