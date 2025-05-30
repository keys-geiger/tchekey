document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegister = document.getElementById('show-register');
    const showLogin = document.getElementById('show-login');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const authMessage = document.getElementById('auth-message');

    // Alternar entre login e registro
    showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        authMessage.textContent = '';
    });

    showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
        authMessage.textContent = '';
    });

    // Login
    loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value.trim();

        if (!email || !password) {
            showMessage('Preencha todos os campos', 'error');
            return;
        }

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);
                window.location.href = '/home.html';
            } else {
                showMessage(data.message || 'Credenciais inválidas', 'error');
            }
        } catch (err) {
            showMessage('Erro ao conectar com o servidor', 'error');
            console.error('Erro no login:', err);
        }
    });

    // Registro
    registerBtn.addEventListener('click', async () => {
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value.trim();
        const confirm = document.getElementById('register-confirm').value.trim();

        if (!email || !password || !confirm) {
            showMessage('Preencha todos os campos', 'error');
            return;
        }

        if (password !== confirm) {
            showMessage('As senhas não coincidem', 'error');
            return;
        }

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage('Registro realizado com sucesso! Faça login.', 'success');
                registerForm.style.display = 'none';
                loginForm.style.display = 'block';
                document.getElementById('register-email').value = '';
                document.getElementById('register-password').value = '';
                document.getElementById('register-confirm').value = '';
            } else {
                showMessage(data.message || 'Erro no registro', 'error');
            }
        } catch (err) {
            showMessage('Erro ao conectar com o servidor', 'error');
            console.error('Erro no registro:', err);
        }
    });

    function showMessage(text, type) {
        authMessage.textContent = text;
        authMessage.className = 'message ' + type;
    }
});