const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY || SECRET_KEY === 'clave_secreta_segura') {
  console.error('❌ SECRET_KEY no configurada o insegura en .env. Generá una con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return res.status(401).json({ error: 'Token vacío' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.usuario = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

function verificarRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        error: 'No autorizado',
        mensaje: `Se requiere rol: ${rolesPermitidos.join(' o ')}`
      });
    }
    next();
  };
}

module.exports = { verificarToken, verificarRol };
