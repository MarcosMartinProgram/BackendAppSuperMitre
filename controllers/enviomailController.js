const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER, // tu_email@gmail.com
    pass: process.env.GMAIL_APP_PASSWORD // Contraseña de aplicación de Gmail
  }
});

const generarHTMLTicket = (ticket) => {
  const productos = JSON.parse(ticket.productos);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Courier New', monospace; max-width: 400px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .productos { margin: 15px 0; }
        .total { border-top: 2px solid #000; padding-top: 10px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>SUPER MITRE</h2>
        <p>Av. Bartolome Mitre 430<br>
        Tel: 3735449464 • Alias: super-mitre</p>
      </div>
      
      <h3>TICKET #${ticket.numero_ticket}</h3>
      <p><strong>Fecha:</strong> ${new Date(ticket.fecha).toLocaleDateString('es-AR')}</p>
      <p><strong>Cliente:</strong> ${ticket.Cliente?.nombre || 'Cliente General'}</p>
      
      <div class="productos">
        <h4>PRODUCTOS:</h4>
        ${productos.map(p => `
          <div>${p.nombre} x${p.cantidad} ............. $${p.subtotal}</div>
        `).join('')}
      </div>
      
      <div class="total">
        <p>SUBTOTAL: $${ticket.total}</p>
        ${ticket.entrega > 0 ? `<p>ENTREGA: $${ticket.entrega}</p>` : ''}
        ${ticket.tipo_pago === 'cuenta_corriente' ? 
          `<p>SALDO PENDIENTE: $${ticket.total - (ticket.entrega || 0)}</p>` : 
          '<p>PAGADO</p>'
        }
      </div>
      
      <p style="text-align: center; margin-top: 20px;">
        ¡Gracias por su compra!<br>
        <small>www.supermitre.com.ar</small>
      </p>
    </body>
    </html>
  `;
};

const enviarTicketEmail = async (email, ticket) => {
  try {
    const htmlContent = generarHTMLTicket(ticket);
    
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: `Super Mitre - Ticket #${ticket.numero_ticket}`,
      html: htmlContent
    });

    return { success: true, message: 'Email enviado correctamente' };
  } catch (error) {
    console.error('Error enviando email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = { enviarTicketEmail };