const express = require("express");
const router = express.Router();
const { crearPreferencia, crearQR, consultarQR, cancelarQR } = require("../controllers/mercadoPagoController");

// Preferencia de pago online
router.post("/crear-preferencia", crearPreferencia);

// QR presencial
router.post("/crear-qr", crearQR);
router.get("/consultar-qr/:order_id", consultarQR);
router.post("/cancelar-qr/:order_id", cancelarQR);

module.exports = router;
