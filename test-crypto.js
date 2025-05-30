const { encrypt, decrypt } = require('./crypto-utils');

const testText = "Minha senha secreta!";
try {
  const encrypted = encrypt(testText);
  const decrypted = decrypt(encrypted);
  
  console.log('✅ Teste bem-sucedido!');
  console.log('Original:', testText);
  console.log('Criptografado:', encrypted);
  console.log('Descriptografado:', decrypted);
} catch (err) {
  console.error('❌ Falha no teste:', err.message);
}