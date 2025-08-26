const express = require("express");
const router = express.Router();

const { enviarTicketWhatsApp } = require('../controllers/whatsappController');
const { enviarTicketEmail } = require('../controllers/enviomail');

// Ruta para enviar ticket por WhatsApp
router.post('/enviar-whatsapp', enviarTicketWhatsApp);

// Ruta para enviar ticket por Email  
router.post('/enviar-email', async (req, res) => {
  try {
    const { ticketData, clienteEmail } = req.body;

    if (!clienteEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email requerido' 
      });
    }

    const resultado = await enviarTicketEmail(clienteEmail, ticketData);
    res.json(resultado);
  } catch (error) {
    console.error('Error enviando email:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}); 
module.exports = router;
