const crypto = require('crypto');
require('dotenv').config();

// Normalização robusta da chave
const normalizeKey = (key) => {
  if (!key) throw new Error('❌ ENCRYPTION_KEY não definida no .env');
  
  const cleaned = key
    .toString()
    .replace(/\s+/g, '')
    .normalize('NFKC');

  if (cleaned.length < 32) {
    return cleaned.padEnd(32, '0');
  }
  return cleaned.slice(0, 32);
};

const ENCRYPTION_KEY = normalizeKey(process.env.ENCRYPTION_KEY);
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function encrypt(text) {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (err) {
    console.error('Erro na criptografia:', err);
    throw new Error('Falha ao criptografar');
  }
}

function decrypt(encryptedText) {
  try {
    const [ivHex, content] = encryptedText.split(':');
    if (!ivHex || !content) throw new Error('Formato inválido');
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(content, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Erro na descriptografia:', err);
    throw new Error('Falha ao descriptografar');
  }
}

module.exports = { encrypt, decrypt };