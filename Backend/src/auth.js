// Backend/src/auth.js
import jwt from "jsonwebtoken";

// Por que: header pode vir em qualquer caixa, e precisamos falhar cedo se o segredo não existir.
export function authMiddleware(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "JWT_SECRET não configurado" });
  }

  const header = String(req.headers.authorization || "");
  const isBearer = header.toLowerCase().startsWith("bearer ");
  const token = isBearer ? header.slice(7).trim() : null;
  if (!token) return res.status(401).json({ error: "token ausente" });

  try {
    const payload = jwt.verify(token, secret);
    const userId = Number(payload.sub);
    if (!Number.isFinite(userId)) {
      return res.status(401).json({ error: "token inválido" });
    }
    req.user = { id: userId }; // garantir número para queries
    next();
  } catch {
    return res.status(401).json({ error: "token inválido" });
  }
}
