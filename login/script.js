// Login page functionality
// Note: auth.js must be loaded before this script

document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    const loginBtn = document.querySelector('.login-btn');
    
    // Hide previous error
    errorMessage.style.display = 'none';
    errorMessage.textContent = '';
    
    // Disable button during authentication
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    
    try {
        const isValid = await authenticate(username, password);
        
        if (isValid) {
            // Redirect to main page
            window.location.href = '../';
        } else {
            // Show error message
            errorMessage.textContent = 'Invalid username or password';
            errorMessage.style.display = 'block';
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
            
            // Clear password field
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        }
    } catch (error) {
        console.error('Authentication error:', error);
        errorMessage.textContent = 'An error occurred. Please try again.';
        errorMessage.style.display = 'block';
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    }
});

// Check if already authenticated, redirect if so
if (isAuthenticated()) {
    window.location.href = '../';
}
