document.addEventListener('DOMContentLoaded', function() {
    // Verifica autenticação
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    // Elementos da interface
    const logoutBtn = document.getElementById('logout-btn');
    const addBtn = document.getElementById('adicionar');
    const generateBtn = document.getElementById('gerar');
    const togglePasswordBtn = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('senha');
    const passwordsContainer = document.getElementById('passwords-container');
    const folderList = document.getElementById('folder-list');
    const createFolderBtn = document.getElementById('create-folder');
    const folderModal = document.getElementById('folder-modal');
    const folderNameInput = document.getElementById('folder-name');
    const saveFolderBtn = document.getElementById('save-folder');
    const closeFolderModal = document.querySelector('.close-folder-modal');
    const userEmailSpan = document.getElementById('user-email');

    // Estado da aplicação
    let currentFolderId = null;

    // Inicialização
    init();

    async function init() {
        try {
            // Carrega email do usuário
            const userData = await parseJwt(token);
            userEmailSpan.textContent = userData.email || 'Usuário';
            
            // Carrega dados iniciais
            await loadFolders();
            await loadPasswords();
            
            // Configura eventos
            setupEventListeners();
        } catch (error) {
            console.error('Erro na inicialização:', error);
            alert('Erro ao carregar dados. Tente novamente.');
        }
    }

    function setupEventListeners() {
        // Logout
        logoutBtn.addEventListener('click', logout);
        
        // Formulário de senha
        addBtn.addEventListener('click', addPassword);
        generateBtn.addEventListener('click', generatePassword);
        togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
        
        // Pastas
        createFolderBtn.addEventListener('click', showFolderModal);
        closeFolderModal.addEventListener('click', hideFolderModal);
        saveFolderBtn.addEventListener('click', saveFolder);
    }

    // Função para decodificar o token JWT
    function parseJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            
            return JSON.parse(jsonPayload);
        } catch (e) {
            return {};
        }
    }

    // Funções de autenticação
    function logout() {
        localStorage.removeItem('token');
        window.location.href = '/';
    }

    async function fetchAuthenticated(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };
        
        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...(options.headers || {})
            }
        };
        
        if (options.body) {
            mergedOptions.body = JSON.stringify(options.body);
        }
        
        const response = await fetch(url, mergedOptions);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Erro na requisição');
        }
        
        return response.json();
    }

    // Funções de senhas
    async function loadPasswords() {
        try {
            const url = currentFolderId 
                ? `/api/passwords?folderId=${currentFolderId}`
                : '/api/passwords';
            
            const passwords = await fetchAuthenticated(url);
            displayPasswords(passwords);
        } catch (error) {
            console.error('Erro ao carregar senhas:', error);
            showPasswordsError(error.message);
        }
    }

    function displayPasswords(passwords) {
        if (passwords.length === 0) {
            passwordsContainer.innerHTML = `
                <div class="empty-message">
                    <i class="fas fa-folder-open"></i>
                    <p>Nenhuma senha encontrada</p>
                </div>
            `;
            return;
        }

        passwordsContainer.innerHTML = passwords.map(password => `
            <div class="password-card">
                <div class="password-header">
                    <h3>${password.servico}</h3>
                    <div class="password-actions">
                        <button class="copy-btn" data-password="${password.senha}">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="delete-btn" data-id="${password._id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="password-field">
                    <strong><i class="fas fa-user"></i> Usuário:</strong>
                    <div class="password-value">
                        <input type="text" value="${password.usuario}" readonly>
                        <button class="copy-btn" data-password="${password.usuario}">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
                <div class="password-field">
                    <strong><i class="fas fa-key"></i> Senha:</strong>
                    <div class="password-value">
                        <input type="password" value="${password.senha}" readonly>
                        <button class="toggle-password-btn">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="copy-btn" data-password="${password.senha}">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
                ${password.folderId ? `
                    <div class="folder-badge">
                        <i class="fas fa-folder"></i> ${password.folderId.name}
                    </div>
                ` : ''}
            </div>
        `).join('');

        // Configura eventos dos botões
        setupPasswordButtons();
    }

    function setupPasswordButtons() {
        // Botões de copiar
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const text = this.getAttribute('data-password');
                copyToClipboard(text);
                showToast('Copiado para a área de transferência!');
            });
        });

        // Botões de mostrar/ocultar senha
        document.querySelectorAll('.toggle-password-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const input = this.parentElement.querySelector('input');
                if (input.type === 'password') {
                    input.type = 'text';
                    this.innerHTML = '<i class="fas fa-eye-slash"></i>';
                } else {
                    input.type = 'password';
                    this.innerHTML = '<i class="fas fa-eye"></i>';
                }
            });
        });

        // Botões de deletar
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const passwordId = this.getAttribute('data-id');
                if (confirm('Tem certeza que deseja excluir esta senha?')) {
                    try {
                        await fetchAuthenticated(`/api/passwords/${passwordId}`, {
                            method: 'DELETE'
                        });
                        await loadPasswords();
                        showToast('Senha excluída com sucesso!');
                    } catch (error) {
                        console.error('Erro ao excluir senha:', error);
                        showToast('Erro ao excluir senha', 'error');
                    }
                }
            });
        });
    }

    async function addPassword() {
        const servico = document.getElementById('servico').value.trim();
        const usuario = document.getElementById('usuario').value.trim();
        const senha = document.getElementById('senha').value.trim();

        if (!servico || !usuario || !senha) {
            showToast('Preencha todos os campos!', 'error');
            return;
        }

        try {
            await fetchAuthenticated('/api/passwords', {
                method: 'POST',
                body: { servico, usuario, senha, folderId: currentFolderId }
            });

            // Limpa os campos
            document.getElementById('servico').value = '';
            document.getElementById('usuario').value = '';
            document.getElementById('senha').value = '';

            // Recarrega a lista
            await loadPasswords();
            showToast('Senha adicionada com sucesso!');
        } catch (error) {
            console.error('Erro ao adicionar senha:', error);
            showToast(error.message || 'Erro ao adicionar senha', 'error');
        }
    }

    function generatePassword() {
        const length = 16;
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
        let password = "";
        
        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * charset.length);
            password += charset[randomIndex];
        }
        
        passwordInput.value = password;
        showToast('Senha forte gerada!');
    }

    function togglePasswordVisibility() {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            togglePasswordBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        } else {
            passwordInput.type = 'password';
            togglePasswordBtn.innerHTML = '<i class="fas fa-eye"></i>';
        }
    }

    // Funções de pastas
    async function loadFolders() {
        try {
            const folders = await fetchAuthenticated('/api/folders');
            displayFolders(folders);
        } catch (error) {
            console.error('Erro ao carregar pastas:', error);
        }
    }

    function displayFolders(folders) {
        folderList.innerHTML = `
            <div class="folder-item ${!currentFolderId ? 'active' : ''}" data-folder-id="null">
                <i class="fas fa-folder-open"></i>
                <span>Todas as Senhas</span>
            </div>
            ${folders.map(folder => `
                <div class="folder-item ${currentFolderId === folder._id ? 'active' : ''}" 
                     data-folder-id="${folder._id}">
                    <i class="fas fa-folder"></i>
                    <span>${folder.name}</span>
                    <button class="delete-folder" data-folder-id="${folder._id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('')}
        `;

        // Configura eventos das pastas
        document.querySelectorAll('.folder-item').forEach(item => {
            item.addEventListener('click', async function() {
                currentFolderId = this.getAttribute('data-folder-id') === 'null' ? null : this.getAttribute('data-folder-id');
                await loadPasswords();
                
                // Atualiza estado ativo
                document.querySelectorAll('.folder-item').forEach(i => 
                    i.classList.remove('active'));
                this.classList.add('active');
            });
        });

        // Configura eventos de deletar pasta
        document.querySelectorAll('.delete-folder').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.stopPropagation();
                const folderId = this.getAttribute('data-folder-id');
                if (confirm('Excluir esta pasta e mover as senhas para "Todas as Senhas"?')) {
                    try {
                        await fetchAuthenticated(`/api/passwords/move-to-root`, {
                            method: 'PUT',
                            body: { folderId }
                        });
                        
                        await fetchAuthenticated(`/api/folders/${folderId}`, {
                            method: 'DELETE'
                        });
                        
                        // Se estiver na pasta que foi deletada, volta para todas as senhas
                        if (currentFolderId === folderId) {
                            currentFolderId = null;
                            document.querySelector('.folder-item[data-folder-id="null"]').click();
                        } else {
                            await loadFolders();
                        }
                        
                        showToast('Pasta excluída com sucesso!');
                    } catch (error) {
                        console.error('Erro ao excluir pasta:', error);
                        showToast(error.message || 'Erro ao excluir pasta', 'error');
                    }
                }
            });
        });
    }

    function showFolderModal() {
        folderModal.style.display = 'block';
        folderNameInput.focus();
    }

    function hideFolderModal() {
        folderModal.style.display = 'none';
        folderNameInput.value = '';
    }

    async function saveFolder() {
        const name = folderNameInput.value.trim();
        if (!name) {
            showToast('Digite um nome para a pasta', 'error');
            return;
        }

        try {
            await fetchAuthenticated('/api/folders', {
                method: 'POST',
                body: { name }
            });
            
            hideFolderModal();
            await loadFolders();
            showToast('Pasta criada com sucesso!');
        } catch (error) {
            console.error('Erro ao criar pasta:', error);
            showToast(error.message || 'Erro ao criar pasta', 'error');
        }
    }

    // Funções utilitárias
    function copyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }

    function showPasswordsError(message) {
        passwordsContainer.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${message || 'Erro ao carregar senhas'}</p>
                <button class="btn primary" id="retry-btn">
                    <i class="fas fa-sync-alt"></i> Tentar novamente
                </button>
            </div>
        `;
        
        document.getElementById('retry-btn').addEventListener('click', loadPasswords);
    }
});

// Adiciona estilos dinâmicos para o toast
const toastStyles = document.createElement('style');
toastStyles.textContent = `
.toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    border-radius: 4px;
    color: white;
    background: #333;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    opacity: 0;
    transition: opacity 0.3s;
    z-index: 1000;
}

.toast.show {
    opacity: 1;
}

.toast.success {
    background: #2ecc71;
}

.toast.error {
    background: #e74c3c;
}
`;
document.head.appendChild(toastStyles);