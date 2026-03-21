import jwt from 'jsonwebtoken';

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || !String(s).trim()) {
    throw new Error('JWT_SECRET is not set in environment');
  }
  return String(s).trim();
}

export function signToken(payload) {
  const { userId, username, role } = payload;
  return jwt.sign({ userId, username, role }, getSecret(), { expiresIn: '7d' });
}

export function verifyToken(token) {
  return jwt.verify(token, getSecret());
}
