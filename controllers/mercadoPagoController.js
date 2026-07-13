//controllers/mercadoPagoController.js
const { MercadoPagoConfig, Preference } = require("mercadopago");
const { v4: uuidv4 } = require("uuid");
const https = require("https");

// Token para pagos online (pasarela checkout)
const MP_ONLINE_ACCESS_TOKEN = process.env.MP_ONLINE_ACCESS_TOKEN;
// Token para QR de caja (pagos presenciales)
const MP_QR_ACCESS_TOKEN = process.env.MP_QR_ACCESS_TOKEN;
const MP_POS_EXTERNAL_ID = process.env.MP_POS_EXTERNAL_ID || "CAJA001";

console.log("🔐 MP ONLINE TOKEN:", MP_ONLINE_ACCESS_TOKEN ? "✅ Configurado" : "❌ No configurado");
console.log("🔐 MP QR TOKEN:", MP_QR_ACCESS_TOKEN ? "✅ Configurado" : "❌ No configurado");

// Client SDK para pagos online (preferencias)
const clientOnline = new MercadoPagoConfig({
    accessToken: MP_ONLINE_ACCESS_TOKEN,
    options: {
        timeout: 10000,
        idempotencyKey: Date.now().toString()
    }
});

// Helper para hacer requests directos a la API de MP (Orders API - QR)
const mpRequest = (method, path, body = null) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: "api.mercadopago.com",
            path: path,
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${MP_QR_ACCESS_TOKEN}`,
                "X-Idempotency-Key": uuidv4()
            }
        };

        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 400) {
                        reject({ status: res.statusCode, data: parsed });
                    } else {
                        resolve(parsed);
                    }
                } catch (e) {
                    reject({ status: res.statusCode, data: data });
                }
            });
        });

        req.on("error", reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error("Timeout")); });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
};

// =============================================
// CREAR PREFERENCIA (checkout online - existente)
// =============================================
const crearPreferencia = async (req, res) => {
    try {
        console.log("\n🛒 === INICIANDO PROCESO DE PAGO ===");
        const { carrito } = req.body;

        if (!carrito || !Array.isArray(carrito) || carrito.length === 0) {
            return res.status(400).json({ error: "Carrito inválido o vacío" });
        }

        const items = carrito.map((item, index) => ({
            id: String(item.codigo_barras || `item-${index}`),
            title: String(item.nombre || `Producto ${index + 1}`).substring(0, 256),
            unit_price: Number(item.precio) || 0,
            quantity: Number(item.cantidad) || 1,
            currency_id: "ARS"
        })).filter(item => item.unit_price > 0);

        if (items.length === 0) {
            return res.status(400).json({ error: "No hay productos válidos" });
        }

        const isProduction = req.get("host").includes("alwaysdata.net");
        const baseUrl = isProduction ? "https://supermitre.com.ar" : "http://localhost:3000";

        const preference = new Preference(clientOnline);
        const response = await preference.create({
            body: {
                items,
                back_urls: {
                    success: `${baseUrl}/payment-success`,
                    failure: `${baseUrl}/payment-failure`,
                    pending: `${baseUrl}/payment-pending`
                },
                auto_return: "approved",
                statement_descriptor: "SUPER MITRE",
                external_reference: `SM-${Date.now()}`,
                expires: true,
                expiration_date_from: new Date().toISOString(),
                expiration_date_to: new Date(Date.now() + 86400000).toISOString(),
                payment_methods: { installments: 12 }
            }
        });

        res.json({ success: true, id: response.id, init_point: response.init_point, sandbox_init_point: response.sandbox_init_point });
    } catch (error) {
        console.error("💥 Error crearPreferencia:", error.message);
        res.status(500).json({ success: false, error: error.message, details: error.response?.data || null });
    }
};

// =============================================
// CREAR QR (orden de pago presencial)
// =============================================
const crearQR = async (req, res) => {
    try {
        console.log("\n📱 === CREANDO ORDEN QR ===");
        const { total_amount, description, productos, external_reference } = req.body;

        if (!total_amount || Number(total_amount) <= 0) {
            return res.status(400).json({ error: "Monto inválido" });
        }

        const items = (productos && productos.length > 0)
            ? productos.map((p, i) => ({
                title: String(p.nombre || `Item ${i + 1}`).substring(0, 150),
                unit_price: String(Number(p.precio_venta || p.precio || 0).toFixed(2)),
                quantity: Number(p.cantidad) || 1,
                unit_measure: "unit",
                external_code: String(p.codigo_barras || `ITEM${i}`)
            }))
            : [{
                title: description || "Venta Super Mitre",
                unit_price: String(Number(total_amount).toFixed(2)),
                quantity: 1,
                unit_measure: "unit",
                external_code: "VENTA"
            }];

        const orderBody = {
            type: "qr",
            total_amount: String(Number(total_amount).toFixed(2)),
            description: (description || "Venta Super Mitre").substring(0, 150),
            external_reference: external_reference || `SMQR-${Date.now()}`,
            expiration_time: "PT15M",
            config: {
                qr: {
                    external_pos_id: MP_POS_EXTERNAL_ID,
                    mode: "dynamic"
                }
            },
            transactions: {
                payments: [{ amount: String(Number(total_amount).toFixed(2)) }]
            },
            items
        };

        console.log("📦 Body orden QR:", JSON.stringify(orderBody, null, 2));

        const order = await mpRequest("POST", "/v1/orders", orderBody);

        console.log("✅ Orden QR creada:", order.id);

        res.json({
            success: true,
            order_id: order.id,
            payment_id: order.transactions?.payments?.[0]?.id,
            qr_data: order.type_response?.qr_data || null,
            status: order.status,
            total_amount: order.total_amount
        });
    } catch (error) {
        console.error("💥 Error crearQR:", error.message, error.data || "");
        res.status(500).json({ success: false, error: error.data || error.message });
    }
};

// =============================================
// CONSULTAR ORDEN QR
// =============================================
const consultarQR = async (req, res) => {
    try {
        const { order_id } = req.params;
        if (!order_id) return res.status(400).json({ error: "order_id requerido" });

        const order = await mpRequest("GET", `/v1/orders/${order_id}`);
        res.json({
            success: true,
            id: order.id,
            status: order.status,
            status_detail: order.status_detail,
            total_amount: order.total_amount,
            payment_status: order.transactions?.payments?.[0]?.status,
            payment_status_detail: order.transactions?.payments?.[0]?.status_detail
        });
    } catch (error) {
        console.error("💥 Error consultarQR:", error.message);
        res.status(500).json({ success: false, error: error.data || error.message });
    }
};

// =============================================
// CANCELAR ORDEN QR
// =============================================
const cancelarQR = async (req, res) => {
    try {
        const { order_id } = req.params;
        if (!order_id) return res.status(400).json({ error: "order_id requerido" });

        const order = await mpRequest("POST", `/v1/orders/${order_id}/cancel`);
        console.log("🚫 Orden cancelada:", order_id);
        res.json({ success: true, status: order.status, id: order.id });
    } catch (error) {
        console.error("💥 Error cancelarQR:", error.message);
        res.status(500).json({ success: false, error: error.data || error.message });
    }
};

module.exports = { crearPreferencia, crearQR, consultarQR, cancelarQR };
