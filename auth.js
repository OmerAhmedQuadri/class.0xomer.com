// Client-side login gate. Everything here ships to the browser, so it keeps casual
// visitors out but is not real access control.

// To change the password, compute a new hash on /hash/ (with this salt) and paste it below.
const SALT = 'secure_salt_key';
const STORED_PASSWORD_HASH = 'c36099cfa468b2f6d615e32eaff4e4fadcaca8d2773b0737834c22eb0477aa6f';
const CORRECT_USERNAME = 'admin';
const AUTH_STORAGE_KEY = 'dailyProgress.authenticated';

// Browsers only provide crypto.subtle over HTTPS or on localhost, not on e.g. http://192.168.x.x
const CAN_HASH = Boolean(window.crypto && window.crypto.subtle);
const INSECURE_CONTEXT_MESSAGE = 'Passwords can only be checked over HTTPS or on localhost. Open this page with https:// or http://localhost.';

/**
 * Hash a password using SHA-256 with salt
 * @param {string} password - The password to hash
 * @param {string} salt - The salt to use
 * @returns {Promise<string>} - The hexadecimal hash
 */
async function hashPassword(password, salt) {
    const data = new TextEncoder().encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, '0')).join('');
}

function isAuthenticated() {
    return localStorage.getItem(AUTH_STORAGE_KEY) === 'true';
}

/**
 * Check the credentials and remember the login in localStorage if they match
 * @returns {Promise<boolean>} - True if authentication successful
 */
async function authenticate(username, password) {
    if (username !== CORRECT_USERNAME) {
        return false;
    }

    const isValid = await hashPassword(password, SALT) === STORED_PASSWORD_HASH;
    if (isValid) {
        localStorage.setItem(AUTH_STORAGE_KEY, 'true');
    }
    return isValid;
}

function logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
}
