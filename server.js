require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { encrypt, decrypt } = require('./crypto-utils');

// Configuração inicial
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Verificação de variáveis de ambiente
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'ENCRYPTION_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Variável de ambiente necessária não encontrada: ${envVar}`);
    process.exit(1);
  }
}

// Conexão com MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: true,
  w: 'majority'
})
.then(() => console.log('✅ Conectado ao MongoDB'))
.catch(err => {
  console.error('❌ Falha na conexão com MongoDB:', err);
  process.exit(1);
});

// Schemas e Models
const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const FolderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const PasswordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder' },
  service: { type: String, required: true },
  username: { type: String, required: true },
  encryptedPassword: { type: String, required: true },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Folder = mongoose.model('Folder', FolderSchema);
const Password = mongoose.model('Password', PasswordSchema);

// Middleware de autenticação JWT
const authenticate = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token de acesso não fornecido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Usuário não encontrado' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Erro na verificação do token:', err);
    res.status(403).json({ success: false, message: 'Token inválido ou expirado' });
  }
};

// Rotas de Autenticação
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email e senha são obrigatórios' 
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email já está em uso' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({ email, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { 
      expiresIn: '8h' 
    });

    res.status(201).json({ 
      success: true,
      token,
      user: { id: user._id, email: user.email }
    });
  } catch (err) {
    console.error('Erro no registro:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao registrar usuário' 
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email e senha são obrigatórios' 
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciais inválidas' 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciais inválidas' 
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { 
      expiresIn: '8h' 
    });

    res.json({ 
      success: true,
      token,
      user: { id: user._id, email: user.email }
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao fazer login' 
    });
  }
});

// Rotas de Pastas
app.post('/api/folders', authenticate, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nome da pasta é obrigatório' 
      });
    }

    const folder = new Folder({
      userId: req.user._id,
      name: name.trim()
    });

    await folder.save();
    res.status(201).json({ 
      success: true, 
      folder 
    });
  } catch (err) {
    console.error('Erro ao criar pasta:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao criar pasta' 
    });
  }
});

app.get('/api/folders', authenticate, async (req, res) => {
  try {
    const folders = await Folder.find({ userId: req.user._id })
      .sort({ createdAt: -1 });

    res.json({ 
      success: true, 
      folders 
    });
  } catch (err) {
    console.error('Erro ao buscar pastas:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar pastas' 
    });
  }
});

app.delete('/api/folders/:id', authenticate, async (req, res) => {
  try {
    const folder = await Folder.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!folder) {
      return res.status(404).json({ 
        success: false, 
        message: 'Pasta não encontrada' 
      });
    }

    // Move senhas para fora da pasta
    await Password.updateMany(
      { userId: req.user._id, folderId: folder._id },
      { $set: { folderId: null } }
    );

    res.json({ 
      success: true, 
      message: 'Pasta removida com sucesso' 
    });
  } catch (err) {
    console.error('Erro ao remover pasta:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao remover pasta' 
    });
  }
});

// Rotas de Senhas
app.post('/api/passwords', authenticate, async (req, res) => {
  try {
    const { service, username, password, folderId, notes } = req.body;

    if (!service?.trim() || !username?.trim() || !password?.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Serviço, usuário e senha são obrigatórios' 
      });
    }

    const encryptedPassword = encrypt(password.trim());

    const newPassword = new Password({
      userId: req.user._id,
      folderId: folderId || null,
      service: service.trim(),
      username: username.trim(),
      encryptedPassword,
      notes: notes?.trim() || ''
    });

    await newPassword.save();
    res.status(201).json({ 
      success: true,
      password: {
        ...newPassword.toObject(),
        encryptedPassword: undefined // Remove o campo da resposta
      }
    });
  } catch (err) {
    console.error('Erro ao criar senha:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao criar senha' 
    });
  }
});

app.get('/api/passwords', authenticate, async (req, res) => {
  try {
    const { folderId } = req.query;
    const query = { userId: req.user._id };

    if (folderId && folderId !== 'null') {
      query.folderId = folderId;
    }

    const passwords = await Password.find(query)
      .populate('folderId')
      .sort({ createdAt: -1 })
      .lean();

    // Remove o campo criptografado da resposta
    const sanitizedPasswords = passwords.map(pwd => ({
      ...pwd,
      encryptedPassword: undefined
    }));

    res.json({ 
      success: true, 
      passwords: sanitizedPasswords 
    });
  } catch (err) {
    console.error('Erro ao buscar senhas:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar senhas' 
    });
  }
});

app.post('/api/passwords/decrypt', authenticate, async (req, res) => {
  try {
    const { encryptedPassword } = req.body;

    if (!encryptedPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Senha criptografada não fornecida' 
      });
    }

    const decryptedPassword = decrypt(encryptedPassword);
    res.json({ 
      success: true, 
      decryptedPassword 
    });
  } catch (err) {
    console.error('Erro ao descriptografar:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao descriptografar senha' 
    });
  }
});

app.put('/api/passwords/:id', authenticate, async (req, res) => {
  try {
    const { service, username, password, folderId, notes } = req.body;
    const updates = {};

    if (service?.trim()) updates.service = service.trim();
    if (username?.trim()) updates.username = username.trim();
    if (folderId) updates.folderId = folderId;
    if (notes !== undefined) updates.notes = notes?.trim() || '';
    if (password?.trim()) {
      updates.encryptedPassword = encrypt(password.trim());
    }

    updates.updatedAt = new Date();

    const updatedPassword = await Password.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: updates },
      { new: true }
    );

    if (!updatedPassword) {
      return res.status(404).json({ 
        success: false, 
        message: 'Senha não encontrada' 
      });
    }

    res.json({ 
      success: true,
      password: {
        ...updatedPassword.toObject(),
        encryptedPassword: undefined
      }
    });
  } catch (err) {
    console.error('Erro ao atualizar senha:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao atualizar senha' 
    });
  }
});

app.delete('/api/passwords/:id', authenticate, async (req, res) => {
  try {
    const deletedPassword = await Password.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!deletedPassword) {
      return res.status(404).json({ 
        success: false, 
        message: 'Senha não encontrada' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Senha removida com sucesso' 
    });
  } catch (err) {
    console.error('Erro ao remover senha:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao remover senha' 
    });
  }
});

// Rota de verificação de saúde
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'Operacional',
    timestamp: new Date().toISOString()
  });
});

// Middleware de erro global
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Erro interno no servidor' 
  });
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🔐 Modo: ${process.env.NODE_ENV || 'development'}`);
});