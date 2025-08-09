//controllers/mercadoPagoController.js
const { MercadoPagoConfig, Preference } = require("mercadopago");

// ✅ ACCESS TOKEN configurado
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

console.log("🔐 MP ACCESS TOKEN:", MP_ACCESS_TOKEN ? "✅ Configurado" : "❌ No configurado");

// Configurar cliente de Mercado Pago
const client = new MercadoPagoConfig({
    accessToken: MP_ACCESS_TOKEN,
    options: {
        timeout: 5000, // 5 segundos de timeout
        idempotencyKey: Date.now().toString()
    }
});

const crearPreferencia = async (req, res) => {
    try {
        console.log("\n🛒 === INICIANDO PROCESO DE PAGO ===");
        console.log("📦 Body recibido:", JSON.stringify(req.body, null, 2));
        
        const { carrito, plataforma = "web" } = req.body;

        // ✅ VALIDACIONES
        if (!carrito || !Array.isArray(carrito) || carrito.length === 0) {
            console.log("❌ Error: Carrito inválido");
            return res.status(400).json({ 
                error: "Carrito inválido o vacío",
                received: req.body 
            });
        }

        // ✅ PROCESAR ITEMS
        const items = carrito.map((item, index) => {
            const precio = Number(item.precio) || 0;
            const cantidad = Number(item.cantidad) || 1;
            
            return {
                id: String(item.codigo_barras || `item-${index}`),
                title: String(item.nombre || `Producto ${index + 1}`).substring(0, 256),
                unit_price: precio,
                quantity: cantidad,
                currency_id: "ARS"
            };
        }).filter(item => item.unit_price > 0); // Solo items con precio válido

        if (items.length === 0) {
            return res.status(400).json({ 
                error: "No hay productos válidos en el carrito"
            });
        }

        console.log(`💰 Procesando ${items.length} items válidos`);

        // ✅ URLs DE RETORNO - Para producción
        const isProduction = req.get('host').includes('alwaysdata.net');
        const baseUrl = isProduction ? 
            "https://supermitre.com.ar" : // 🔴 CAMBIAR por tu dominio de frontend
            "http://localhost:3000";

        const backUrls = {
            success: `${baseUrl}/payment-success`,
            failure: `${baseUrl}/payment-failure`,
            pending: `${baseUrl}/payment-pending`
        };

        // ✅ CREAR PREFERENCIA
        const preferenceBody = {
            items: items,
            back_urls: backUrls,
            auto_return: "approved",
            statement_descriptor: "SUPER MITRE",
            external_reference: `SM-${Date.now()}`,
            expires: true,
            expiration_date_from: new Date().toISOString(),
            expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            payment_methods: {
                installments: 12,
                excluded_payment_types: [],
                excluded_payment_methods: []
            }
        };

        console.log("🔧 Configuración de preferencia:", JSON.stringify(preferenceBody, null, 2));

        const preference = new Preference(client);
        const response = await preference.create({ body: preferenceBody });

        console.log("✅ Preferencia creada:", response.id);

        // ✅ RESPUESTA
        res.status(200).json({ 
            success: true,
            id: response.id,
            init_point: response.init_point,
            sandbox_init_point: response.sandbox_init_point
        });

    } catch (error) {
        console.error("💥 ERROR DETALLADO:");
        console.error("Mensaje:", error.message);
        console.error("Stack:", error.stack);
        
        if (error.response) {
            console.error("Respuesta de MP:", error.response.data);
            console.error("Status de MP:", error.response.status);
        }

        res.status(500).json({ 
            success: false,
            error: "Error interno del servidor",
            message: error.message,
            details: error.response?.data || null
        });
    }
};

module.exports = { crearPreferencia };
