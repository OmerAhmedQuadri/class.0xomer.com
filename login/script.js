// Login page functionality
// Note: auth.js must be loaded before this script

if (isAuthenticated()) {
    window.location.href = '../';
}

if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-mode');
}

const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('errorMessage');
const loginBtn = document.querySelector('.login-btn');

function showLoginError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
}

document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();

    errorMessage.hidden = true;
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';

    try {
        if (await authenticate(username, passwordInput.value)) {
            window.location.href = '../';
            return;
        }
        showLoginError('Invalid username or password');
        passwordInput.value = '';
        passwordInput.focus();
    } catch (error) {
        console.error('Authentication error:', error);
        showLoginError('An error occurred. Please try again.');
    }
});
