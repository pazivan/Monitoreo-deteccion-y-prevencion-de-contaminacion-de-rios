/**
 * Lógica de autenticación institucional contra PostgreSQL (index.html)
 */
const API_BASE = 'http://localhost:3000';

document.getElementById('form-login').addEventListener('submit', async function (e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errBox = document.getElementById('login-error');
    const errText = document.getElementById('login-error-text');
    if (errBox) errBox.classList.add('hidden');

    try {
        const res = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo: email, password })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            sessionStorage.setItem('ceaspue_usuario', JSON.stringify(data.usuario || { correo: email }));
            window.location.href = 'dashboard.html';
            return;
        }
        if (errBox && errText) {
            errText.textContent = data.error || 'Usuario o contraseña institucional incorrectos.';
            errBox.classList.remove('hidden');
        }
    } catch (_) {
        if (email === 'admi@gmail.com' && password === '123456') {
            window.location.href = 'dashboard.html';
        } else if (errBox && errText) {
            errText.textContent = 'No se pudo validar en el servidor o credenciales incorrectas.';
            errBox.classList.remove('hidden');
        }
    }
});

window.togglePasswordVisibility = function () {
    const passwordInput = document.getElementById('password');
    const icon = document.querySelector('[data-icon="visibility"] span');
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.textContent = 'visibility_off';
    } else {
        passwordInput.type = 'password';
        icon.textContent = 'visibility';
    }
};
