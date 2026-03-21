import jwt from 'jsonwebtoken';

/** На Render JWT_SECRET иногда не задан — иначе login падает при sign/verify */
const JWT_SECRET =
  (process.env.JWT_SECRET && String(process.env.JWT_SECRET).trim()) || 'secret123';

function getSecret() {
  return JWT_SECRET;
}

export function signToken(payload) {
  const { userId, username, role } = payload;
  return jwt.sign({ userId, username, role }, getSecret(), { expiresIn: '7d' });
}

export function verifyToken(token) {
  return jwt.verify(token, getSecret());
}
