const fs = require('fs');
const path = require('path');

let forge;
try {
  forge = require('node-forge');
} catch (e) {
  console.warn('⚠️ node-forge no instalado. Facturación electrónica no disponible. Ejecutá: npm install node-forge');
  forge = null;
}

// ==================== CONFIGURACIÓN ====================

const WSAA_URL = {
  homologacion: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
  produccion: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
};

const WSFE_URL = {
  homologacion: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
  produccion: 'https://wsfe.afip.gov.ar/wsfev1/service.asmx',
};

const BASE_CERT_DIR = path.join(__dirname, '..', 'certs');

const CERT_PATHS = {
  homologacion: {
    cert: path.join(BASE_CERT_DIR, 'homologacion', 'supermitre.crt'),
    key: path.join(BASE_CERT_DIR, 'homologacion', 'privada.key'),
  },
  produccion: {
    cert: path.join(BASE_CERT_DIR, 'produccion', 'supermitre_183515000a1d65eb.crt'),
    key: path.join(BASE_CERT_DIR, 'produccion', 'privada.key'),
  },
};

const TA_CACHE_FILE = path.join(__dirname, '..', 'afip_ta_cache.json');

let uniqueIdCounter = Date.now() % 1000000;

// ==================== UTILIDADES ====================

function formatDateArgentina(date) {
  // Alwaysdata usa UTC, AFIP espera hora Argentina (UTC-3)
  const argTime = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  const yyyy = argTime.getUTCFullYear();
  const mm = String(argTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(argTime.getUTCDate()).padStart(2, '0');
  const hh = String(argTime.getUTCHours()).padStart(2, '0');
  const mi = String(argTime.getUTCMinutes()).padStart(2, '0');
  const ss = String(argTime.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
}

function formatFechaComp(date) {
  const argTime = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  const yyyy = argTime.getUTCFullYear();
  const mm = String(argTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(argTime.getUTCDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function formatFechaQR(date) {
  const argTime = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  const yyyy = argTime.getUTCFullYear();
  const mm = String(argTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(argTime.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseXmlSimple(xml) {
  const result = {};
  const tagRegex = /<(\w+):(\w+)>([^<]*)<\/\1:\2>/g;
  let match;
  while ((match = tagRegex.exec(xml)) !== null) {
    result[match[2]] = match[3].trim();
  }
  const selfClosing = /<(\w+):(\w+)\s*\/>/g;
  while ((match = selfClosing.exec(xml)) !== null) {
    result[match[2]] = '';
  }
  return result;
}

function separarDecimales(numero) {
  const num = parseFloat(numero);
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
}

// ==================== CACHÉ DEL TA ====================

function leerCacheTA() {
  try {
    if (fs.existsSync(TA_CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(TA_CACHE_FILE, 'utf8'));
      return data;
    }
  } catch (e) {
    console.warn('⚠️ Error leyendo caché TA:', e.message);
  }
  return {};
}

function guardarCacheTA(cache) {
  try {
    fs.writeFileSync(TA_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (e) {
    console.warn('⚠️ Error guardando caché TA:', e.message);
  }
}

function obtenerTACacheado(mode) {
  const cache = leerCacheTA();
  const key = `afip_${mode}`;
  const entrada = cache[key];
  if (!entrada) return null;

  const expira = new Date(entrada.expiration);
  if (expira <= new Date()) {
    console.log(`⏰ TA de ${mode} expirado`);
    delete cache[key];
    guardarCacheTA(cache);
    return null;
  }

  console.log(`✅ TA de ${mode} válido (expira: ${entrada.expiration})`);
  return entrada;
}

function guardarTACache(mode, token, sign, expiration) {
  const cache = leerCacheTA();
  cache[`afip_${mode}`] = { token, sign, expiration };
  guardarCacheTA(cache);
}

// ==================== TRA (Ticket de Acceso Request) ====================

function generarTRA(service) {
  uniqueIdCounter++;
  const now = new Date();
  const genTime = new Date(now.getTime() - 10 * 60 * 1000);
  const expTime = new Date(now.getTime() + 10 * 60 * 1000);

  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueIdCounter}</uniqueId>
    <generationTime>${formatDateArgentina(genTime)}</generationTime>
    <expirationTime>${formatDateArgentina(expTime)}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;
}

// ==================== FIRMA CMS (PKCS#7) ====================

function firmarCMS(traXml, certPath, keyPath) {
  if (!forge) {
    throw new Error('node-forge no está instalado. Ejecutá: npm install node-forge');
  }
  const certPem = fs.readFileSync(certPath, 'utf8');
  const keyPem = fs.readFileSync(keyPath, 'utf8');

  const cert = forge.pki.certificateFromPem(certPem);
  const key = forge.pki.privateKeyFromPem(keyPem);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(traXml, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key: key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.signingTime, value: new Date() },
      { type: forge.pki.oids.messageDigest },
    ],
  });
  p7.sign({ detached: false });

  const derBytes = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return forge.util.encode64(derBytes);
}

// ==================== WSAA - OBTENER TICKET DE ACCESO ====================

async function obtenerTicketAcceso(mode) {
  // 1. Verificar caché
  const cacheado = obtenerTACacheado(mode);
  if (cacheado) return cacheado;

  console.log(`🔐 Obteniendo Ticket de Acceso (${mode})...`);

  const certPaths = CERT_PATHS[mode];
  if (!certPaths || !fs.existsSync(certPaths.cert) || !firmarCMS) {
    throw new Error(`Certificados no encontrados para modo: ${mode}`);
  }

  // 2. Generar y firmar TRA
  const traXml = generarTRA('wsfe');
  console.log('📝 TRA generado');

  let cmsBase64;
  try {
    cmsBase64 = firmarCMS(traXml, certPaths.cert, certPaths.key);
    console.log('🔏 TRA firmado correctamente');
  } catch (err) {
    console.error('❌ Error firmando TRA:', err.message);
    throw new Error(`Error al firmar certificado: ${err.message}`);
  }

  // 3. Enviar al WSAA
  const soapXml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header/>
  <soap:Body>
    <loginCms xmlns="http://wsaa.view.sua.dvadac.desein.afip.gov/">
      <in0>${cmsBase64}</in0>
    </loginCms>
  </soap:Body>
</soap:Envelope>`;

  const wsaaUrl = WSAA_URL[mode];
  console.log(`📤 Enviando CMS al WSAA: ${wsaaUrl}`);

  const response = await fetch(wsaaUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: '""',
    },
    body: soapXml,
  });

  const respuesta = await response.text();

  if (!response.ok) {
    console.error('❌ WSAA HTTP Error:', response.status, respuesta);
    throw new Error(`WSAA HTTP ${response.status}`);
  }

  // 4. Parsear respuesta
  try {
    // Buscar el loginCmsReturn dentro de la respuesta SOAP
    const returnMatch = respuesta.match(/<loginCmsReturn>([\s\S]*?)<\/loginCmsReturn>/);
    if (!returnMatch) {
      console.error('❌ No se encontró loginCmsReturn en respuesta:', respuesta.substring(0, 500));
      throw new Error('Respuesta WSAA inválida: falta loginCmsReturn');
    }

    // El contenido está escapado como HTML entities, decodificar
    let contenido = returnMatch[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#xD;/g, '\r')
      .replace(/&#xA;/g, '\n');

    // Buscar el loginTicketResponse
    const taMatch = contenido.match(/<loginTicketResponse[\s\S]*?<\/loginTicketResponse>/);
    if (!taMatch) {
      console.error('❌ No se encontró loginTicketResponse:', contenido.substring(0, 500));
      throw new Error('Respuesta WSAA inválida: falta loginTicketResponse');
    }

    const taXml = taMatch[0];

    const tokenMatch = taXml.match(/<token>([\s\S]*?)<\/token>/);
    const signMatch = taXml.match(/<sign>([\s\S]*?)<\/sign>/);
    const expMatch = taXml.match(/<expirationTime>([\s\S]*?)<\/expirationTime>/);

    if (!tokenMatch || !signMatch) {
      throw new Error('No se encontraron token/sign en la respuesta');
    }

    const token = tokenMatch[1].trim();
    const sign = signMatch[1].trim();
    const expiration = expMatch ? expMatch[1].trim() : '';

    console.log(`✅ Ticket de Acceso obtenido (expira: ${expiration})`);

    // 5. Guardar en caché
    guardarTACache(mode, token, sign, expiration);

    return { token, sign, expiration };
  } catch (err) {
    console.error('❌ Error parseando respuesta WSAA:', err.message);
    console.error('Respuesta completa:', respuesta.substring(0, 1000));
    throw new Error(`Error parseando WSAA: ${err.message}`);
  }
}

// ==================== WSFE - CONSULTAR ÚLTIMO COMPROBANTE ====================

async function consultarUltimoComprobante(token, sign, cuit, ptoVta, cbteTipo) {
  const wsfeUrl = WSFE_URL[process.env.AFIP_MODE || 'homologacion'];

  const soapXml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soap:Header/>
  <soap:Body>
    <ar:FECompUltimoAutorizado>
      <ar:Auth>
        <ar:Token>${token}</ar:Token>
        <ar:Sign>${sign}</ar:Sign>
        <ar:Cuit>${cuit}</ar:Cuit>
      </ar:Auth>
      <ar:PtoVta>${ptoVta}</ar:PtoVta>
      <ar:CbteTipo>${cbteTipo}</ar:CbteTipo>
    </ar:FECompUltimoAutorizado>
  </soap:Body>
</soap:Envelope>`;

  console.log(`📊 Consultando último comprobante: tipo=${cbteTipo}, ptoVta=${ptoVta}`);

  const response = await fetch(wsfeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: 'http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado',
    },
    body: soapXml,
  });

  const respuesta = await response.text();

  if (!response.ok) {
    throw new Error(`WSFE HTTP ${response.status}`);
  }

  // Parsear resultado
  const resultMatch = respuesta.match(/<FECompUltimoAutorizadoResult>([\s\S]*?)<\/FECompUltimoAutorizadoResult>/);
  if (!resultMatch) {
    // Buscar errores
    const errMatch = respuesta.match(/<soap:Fault>([\s\S]*?)<\/soap:Fault>/);
    if (errMatch) {
      throw new Error(`WSFE Fault: ${errMatch[1].substring(0, 300)}`);
    }
    throw new Error('Respuesta WSFE inválida');
  }

  const campos = parseXmlSimple(resultMatch[1]);
  const ultimo = parseInt(campos.CbteNro || '0', 10);

  console.log(`✅ Último comprobante autorizado: ${ultimo}`);
  return ultimo;
}

// ==================== WSFE - SOLICITAR CAE ====================

async function solicitarCAE(token, sign, cuit, datos) {
  const mode = process.env.AFIP_MODE || 'homologacion';
  const wsfeUrl = WSFE_URL[mode];

  const {
    tipoComprobante,
    puntoVenta,
    numeroComprobante,
    docTipo = 99,
    docNro = 0,
    fechaEmision,
    importeTotal,
    impNeto,
    impIVA = 0,
    impTotConc = 0,
    impOpEx = 0,
    impTrib = 0,
    condicionIVAReceptorId = 5,
    alicuotas = [],
  } = datos;

  // Armar bloque IVA solo si hay alícuotas
  let ivaBlock = '';
  if (alicuotas.length > 0 && impIVA > 0) {
    const alicIvaXml = alicuotas.map(a => `
              <ar:AlicIva>
                <ar:Id>${a.id}</ar:Id>
                <ar:BaseImp>${separarDecimales(a.baseImp)}</ar:BaseImp>
                <ar:Importe>${separarDecimales(a.importe)}</ar:Importe>
              </ar:AlicIva>`).join('');

    ivaBlock = `
            <ar:Iva>${alicIvaXml}
            </ar:Iva>`;
  }

  const soapXml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soap:Header/>
  <soap:Body>
    <ar:FECAESolicitar>
      <ar:Auth>
        <ar:Token>${token}</ar:Token>
        <ar:Sign>${sign}</ar:Sign>
        <ar:Cuit>${cuit}</ar:Cuit>
      </ar:Auth>
      <ar:FeCAEReq>
        <ar:FeCabReq>
          <ar:CantReg>1</ar:CantReg>
          <ar:PtoVta>${puntoVenta}</ar:PtoVta>
          <ar:CbteTipo>${tipoComprobante}</ar:CbteTipo>
        </ar:FeCabReq>
        <ar:FeDetReq>
          <ar:FECAEDetRequest>
            <ar:Concepto>1</ar:Concepto>
            <ar:DocTipo>${docTipo}</ar:DocTipo>
            <ar:DocNro>${docNro}</ar:DocNro>
            <ar:CbteDesde>${numeroComprobante}</ar:CbteDesde>
            <ar:CbteHasta>${numeroComprobante}</ar:CbteHasta>
            <ar:CbteFch>${fechaEmision}</ar:CbteFch>
            <ar:ImpTotal>${separarDecimales(importeTotal)}</ar:ImpTotal>
            <ar:ImpTotConc>${separarDecimales(impTotConc)}</ar:ImpTotConc>
            <ar:ImpNeto>${separarDecimales(impNeto)}</ar:ImpNeto>
            <ar:ImpOpEx>${separarDecimales(impOpEx)}</ar:ImpOpEx>
            <ar:ImpTrib>${separarDecimales(impTrib)}</ar:ImpTrib>
            <ar:ImpIVA>${separarDecimales(impIVA)}</ar:ImpIVA>
            <ar:MonId>PES</ar:MonId>
            <ar:MonCotiz>1.000000</ar:MonCotiz>
            <ar:CondicionIVAReceptorId>${condicionIVAReceptorId}</ar:CondicionIVAReceptorId>${ivaBlock}
          </ar:FECAEDetRequest>
        </ar:FeDetReq>
      </ar:FeCAEReq>
    </ar:FECAESolicitar>
  </soap:Body>
</soap:Envelope>`;

  console.log(`📄 Solicitando CAE: tipo=${tipoComprobante}, ptoVta=${puntoVenta}, nro=${numeroComprobante}`);
  console.log(`   Importe total: $${separarDecimales(importeTotal)}, Neto: $${separarDecimales(impNeto)}, IVA: $${separarDecimales(impIVA)}`);

  const response = await fetch(wsfeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: 'http://ar.gov.afip.dif.FEV1/FECAESolicitar',
    },
    body: soapXml,
  });

  const respuesta = await response.text();

  if (!response.ok) {
    throw new Error(`WSFE HTTP ${response.status}`);
  }

  // Parsear respuesta
  const resultMatch = respuesta.match(/<FECAESolicitarResult>([\s\S]*?)<\/FECAESolicitarResult>/);
  if (!resultMatch) {
    const errMatch = respuesta.match(/<soap:Fault>([\s\S]*?)<\/soap:Fault>/);
    if (errMatch) {
      throw new Error(`WSFE Fault: ${errMatch[1].substring(0, 500)}`);
    }
    throw new Error('Respuesta FECAESolicitar inválida');
  }

  const resultXml = resultMatch[1];
  console.log('📋 Resultado FECAESolicitar completo:', resultXml);

  // Buscar resultado del detalle
  const detMatch = resultXml.match(/<FECAEDetResponse>([\s\S]*?)<\/FECAEDetResponse>/);
  if (!detMatch) {
    throw new Error('No se encontró FECAEDetResponse. Respuesta: ' + resultXml.substring(0, 500));
  }

  const detXml = detMatch[1];
  console.log('📋 Detalle respuesta WSFE:', detXml);
  const campos = parseXmlSimple(detXml);

  const resultado = campos.Resultado; // A=Aprobado, R=Rechazado, O=Observado

  if (resultado === 'A') {
    console.log(`✅ CAE Aprobado: ${campos.CAE} (vence: ${campos.CAEFchVto})`);
    return {
      aprobado: true,
      cae: campos.CAE,
      vencimiento: campos.CAEFchVto,
      numero: parseInt(campos.CbteNro || numeroComprobante, 10),
    };
  } else {
    // Extraer observaciones/errores del detalle Y del nivel cabecera
    const obs = [];

    // Errores/observaciones dentro de FECAEDetResponse
    const obsRegex = /<Obs>[\s\S]*?<Code>(\d+)<\/Code>[\s\S]*?<Msg>([\s\S]*?)<\/Msg>[\s\S]*?<\/Obs>/g;
    let obsMatch;
    while ((obsMatch = obsRegex.exec(detXml)) !== null) {
      obs.push({ code: obsMatch[1], msg: obsMatch[2].trim() });
    }
    const errRegex = /<Err>[\s\S]*?<Code>(\d+)<\/Code>[\s\S]*?<Msg>([\s\S]*?)<\/Msg>[\s\S]*?<\/Err>/g;
    let errMatch2;
    while ((errMatch2 = errRegex.exec(detXml)) !== null) {
      obs.push({ code: errMatch2[1], msg: errMatch2[2].trim(), tipo: 'error' });
    }

    // Errores a nivel del FECAESolicitarResult (bloque <Errors>)
    const errGlobalRegex = /<Err>[\s\S]*?<Code>(\d+)<\/Code>[\s\S]*?<Msg>([\s\S]*?)<\/Msg>[\s\S]*?<\/Err>/g;
    let errGlobal;
    while ((errGlobal = errGlobalRegex.exec(resultXml)) !== null) {
      const existe = obs.find(o => o.code === errGlobal[1]);
      if (!existe) {
        obs.push({ code: errGlobal[1], msg: errGlobal[2].trim(), tipo: 'error' });
      }
    }

    console.error(`❌ CAE ${resultado === 'R' ? 'Rechazado' : 'Observado'}:`, obs);
    return {
      aprobado: false,
      resultado,
      observaciones: obs,
      xmlRespuesta: detXml.substring(0, 1000),
    };
  }
}

// ==================== QR AFIP ====================

function generarUrlQrAfip(datos) {
  const json = JSON.stringify({
    ver: 1,
    fecha: datos.fechaEmision,
    cuit: parseInt(datos.cuit, 10),
    ptoVta: datos.puntoVenta,
    tipoCmp: datos.tipoComprobante,
    nroCmp: datos.numeroComprobante,
    importe: parseFloat(datos.importeTotal),
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: datos.tipoDocRec || 99,
    nroDocRec: datos.nroDocRec || 0,
    tipoCodAut: 'E',
    codAut: datos.cae,
  });

  const base64 = Buffer.from(json).toString('base64');
  return `https://www.arca.gob.ar/fe/qr/?p=${base64}`;
}

// ==================== CALCULAR IVA ====================

function calcularAlicuotas(productos, tipoComprobante) {
  // Para Factura C: IVA incluido, no se desglosa
  if ([11, 15].includes(tipoComprobante)) {
    return { alicuotas: [], impIVA: 0, impNeto: 0 };
  }

  // Para Factura A y B: desglosar IVA
  const alicuotaMap = {};
  let totalNeto = 0;
  let totalIVA = 0;

  for (const prod of productos) {
    const precio = parseFloat(prod.precio_venta || prod.precio);
    const cantidad = prod.cantidad || 1;
    const alicuotaPct = parseFloat(prod.alicuota_iva || 21); // default 21%

    // Precio con IVA incluido → separar neto + IVA
    const factorIva = 1 + (alicuotaPct / 100);
    const neto = (precio * cantidad) / factorIva;
    const iva = (precio * cantidad) - neto;

    const idAlicuota = getAlicuotaId(alicuotaPct);

    if (!alicuotaMap[idAlicuota]) {
      alicuotaMap[idAlicuota] = { id: idAlicuota, baseImp: 0, importe: 0 };
    }
    alicuotaMap[idAlicuota].baseImp += neto;
    alicuotaMap[idAlicuota].importe += iva;

    totalNeto += neto;
    totalIVA += iva;
  }

  // Redondear a 2 decimales
  const alicuotas = Object.values(alicuotaMap).map(a => ({
    id: a.id,
    baseImp: Math.round(a.baseImp * 100) / 100,
    importe: Math.round(a.importe * 100) / 100,
  }));

  return {
    alicuotas,
    impIVA: Math.round(totalIVA * 100) / 100,
    impNeto: Math.round(totalNeto * 100) / 100,
  };
}

function getAlicuotaId(alicuota) {
  const map = { 0: 3, 10.5: 4, 21: 5, 27: 6 };
  return map[alicuota] || 5;
}

// ==================== NOMBRE COMPROBANTE ====================

function nombreComprobante(tipo) {
  const nombres = {
    1: 'Factura A',
    2: 'Nota Débito A',
    3: 'Nota Crédito A',
    4: 'Recibo A',
    5: 'Ticket Factura A',
    6: 'Factura B',
    7: 'Nota Débito B',
    8: 'Nota Crédito B',
    9: 'Recibo B',
    10: 'Ticket Factura B',
    11: 'Factura C',
    12: 'Nota Débito C',
    13: 'Nota Crédito C',
    15: 'Ticket Factura C',
  };
  return nombres[tipo] || `Comprobante tipo ${tipo}`;
}

// ==================== VERIFICAR CERTIFICADOS ====================

function verificarCertificados() {
  const result = {};
  for (const [mode, paths] of Object.entries(CERT_PATHS)) {
    result[mode] = {
      certExists: fs.existsSync(paths.cert),
      keyExists: fs.existsSync(paths.key),
      certPath: paths.cert,
      keyPath: paths.key,
    };
  }
  return result;
}

module.exports = {
  obtenerTicketAcceso,
  consultarUltimoComprobante,
  solicitarCAE,
  generarUrlQrAfip,
  calcularAlicuotas,
  nombreComprobante,
  verificarCertificados,
  formatFechaComp,
  formatFechaQR,
  separarDecimales,
  getAlicuotaId,
};
