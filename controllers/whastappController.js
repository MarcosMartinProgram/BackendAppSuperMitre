const generarMensajeWhatsApp = (tipo, data) => {
  if (tipo === 'ticket') {
    const productos = JSON.parse(data.productos);
    return `🏪 *SUPER MITRE*
📍 Av. Bartolome Mitre 430
📞 Tel: 3735649464

🧾 *TICKET #${data.id_ticket}*
📅 ${new Date(data.fecha).toLocaleDateString('es-AR')} ${new Date(data.fecha).toLocaleTimeString('es-AR')}

👤 *Cliente:* ${data.Cliente?.nombre || 'Cliente General'}

📦 *PRODUCTOS:*
${productos.map(p => 
  `• ${p.nombre} x${p.cantidad} - $${(p.precio * p.cantidad).toFixed(2)}`
).join('\n')}

💰 *TOTAL:* $${parseFloat(data.total).toFixed(2)}
${data.entrega > 0 ? `💵 *Entrega:* $${parseFloat(data.entrega).toFixed(2)}` : ''}
${data.tipo_pago === 'cuenta_corriente' ? 
  `📋 *Saldo pendiente:* $${(parseFloat(data.total) - parseFloat(data.entrega || 0)).toFixed(2)}` : 
  '✅ *PAGADO*'
}

¡Gracias por su compra! 🙏
www.supermitre.com.ar`;
  }
};

const generarURLWhatsApp = (telefono, mensaje) => {
  // Limpiar el teléfono (solo números)
  const telefonoLimpio = telefono.toString().replace(/\D/g, '');
  
  // Agregar código de país si no lo tiene (Argentina +54 9)
  let telefonoCompleto;
  if (telefonoLimpio.startsWith('549')) {
    telefonoCompleto = telefonoLimpio;
  } else if (telefonoLimpio.startsWith('9')) {
    telefonoCompleto = '54' + telefonoLimpio;
  } else {
    telefonoCompleto = '549' + telefonoLimpio;
  }

  const mensajeEncoded = encodeURIComponent(mensaje);
  return `https://wa.me/${telefonoCompleto}?text=${mensajeEncoded}`;
};

const enviarTicketWhatsApp = async (req, res) => {
  try {
    const { ticketData, clienteTelefono } = req.body;

    if (!clienteTelefono) {
      return res.status(400).json({ 
        success: false, 
        error: 'Número de teléfono requerido' 
      });
    }

    const mensaje = generarMensajeWhatsApp('ticket', ticketData);
    const url = generarURLWhatsApp(clienteTelefono, mensaje);

    res.json({ 
      success: true, 
      url,
      mensaje: 'Link de WhatsApp generado correctamente' 
    });
  } catch (error) {
    console.error('Error generando link WhatsApp:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

module.exports = { 
  enviarTicketWhatsApp,
  generarMensajeWhatsApp,
  generarURLWhatsApp
};