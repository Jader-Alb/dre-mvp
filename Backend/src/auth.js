// backend/src/auth.js
import jwt from "jsonwebtoken";

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "token ausente" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: Number(payload.sub) }; // por quê: garantir número
    next();
  } catch {
    return res.status(401).json({ error: "token inválido" });
  }
}
