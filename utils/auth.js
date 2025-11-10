import bcrypt from 'bcrypt';

export async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

export async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}


import jwt from 'jsonwebtoken';

export function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '7d' // Token expires in 7 days
  });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}