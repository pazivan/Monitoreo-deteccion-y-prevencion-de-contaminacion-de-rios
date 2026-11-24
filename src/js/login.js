/**
 * Lógica de inicio de sesión institucional (index.html)
 */
document.getElementById('form-login').addEventListener('submit', function (e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (email === 'admi@gmail.com' && password === '123456') {
        window.location.href = 'dashboard.html';
    } else {
        alert('Correo electrónico o contraseña incorrectos.');
    }
});

function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const icon = document.querySelector('[data-icon="visibility"] span');
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.textContent = 'visibility_off';
    } else {
        passwordInput.type = 'password';
        icon.textContent = 'visibility';
    }
}
