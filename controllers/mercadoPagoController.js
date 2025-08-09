//controllers/mercadoPagoController.js
const mercadopago = require("mercadopago").MercadoPagoConfig;
const { Preference } = require("mercadopago");
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

// Configurar Mercado Pago con la nueva versión del SDK
const client = new mercadopago({
    accessToken: MP_ACCESS_TOKEN
});

const crearPreferencia = async (req, res) => {
    try {
        const { carrito, plataforma } = req.body;

        // ✅ MEJORADO: Items con mejor presentación
        let items = carrito.map(item => ({
            title: item.nombre,
            unit_price: Number(item.precio),
            quantity: item.cantidad,
            currency_id: "ARS",
            // ✅ AGREGADO: Información adicional del producto
            description: `Producto de Super Mitre - ${item.nombre}`,
            picture_url: item.imagen_url || null,
            category_id: "others"
        }));

        // URLs para web y app
        const webUrls = {
            success: "http://localhost:3000/payment-success",
            failure: "http://localhost:3000/payment-failure", 
            pending: "http://localhost:3000/payment-pending"
        };
        const appUrls = {
            success: "supermitreapp://congrats",
            failure: "supermitreapp://failure",
            pending: "supermitreapp://pending"
        };

        let preference = {
            items,
            back_urls: plataforma === "app" ? appUrls : webUrls,
            auto_return: "approved",
            // ✅ AGREGADO: Información del negocio
            marketplace: "SuperMitre",
            marketplace_fee: 0,
            // ✅ AGREGADO: Información adicional
            statement_descriptor: "SUPER MITRE",
            external_reference: `SM-${Date.now()}`,
            // ✅ AGREGADO: Configuración de pago
            payment_methods: {
                excluded_payment_methods: [],
                excluded_payment_types: [],
                installments: 12
            },
            // ✅ AGREGADO: Información del vendedor
            additional_info: {
                payer: {
                    first_name: "Cliente",
                    last_name: "SuperMitre"
                },
                items: items.map(item => ({
                    id: item.title,
                    title: item.title,
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: item.unit_price
                }))
            }
        };

        // Crear la preferencia con la nueva configuración
        const preferenceClient = new Preference(client);
        const response = await preferenceClient.create({ body: preference });

        res.json({ id: response.id });
    } catch (error) {
        console.error("Error al crear la preferencia:", error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = { crearPreferencia };
