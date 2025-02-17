const express = require("express");
const router = express.Router();
const { crearPreferencia } = require("../controllers/mercadoPagoController");


// Ruta para generar la preferencia de pago
router.post("/crear-preferencia", crearPreferencia);

module.exports = router;
