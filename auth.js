// Client-side login gate. Everything here ships to the browser, so it keeps casual
// visitors out but is not real access control.

// To change the password, compute a new hash on /hash/ (with this salt) and paste it below.
const SALT = 'secure_salt_key';
const STORED_PASSWORD_HASH = 'b2af8242cfd88c01dc12b361760ecf9add727fa1ff89f29544626614fce8cab6';
const CORRECT_USERNAME = 'admin';
const AUTH_STORAGE_KEY = 'dailyProgress.authenticated';

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
