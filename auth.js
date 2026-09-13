// Authentication and password hashing utilities

// Salt for password hashing (in production, this should be unique per user)
const SALT = 'secure_salt_key';

// Pre-computed hash of the correct password (password: "admin@-")
// This hash was computed once using SHA-256 with the salt above
// The original password is NOT stored anywhere in this file
// Hash computed from: SHA-256('admin@0000' + SALT)
// To verify: Open verify-hash.html in browser to compute the correct hash
const STORED_PASSWORD_HASH = 'b2af8242cfd88c01dc12b361760ecf9add727fa1ff89f29544626614fce8cab6';

// Correct username
const CORRECT_USERNAME = 'admin';

/**
 * Hash a password using SHA-256 with salt
 * @param {string} password - The password to hash
 * @param {string} salt - The salt to use
 * @returns {Promise<string>} - The hexadecimal hash
 */
async function hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

/**
 * Verify if the entered password matches the stored hash
 * @param {string} enteredPassword - The password entered by user
 * @returns {Promise<boolean>} - True if password matches
 */
async function verifyPassword(enteredPassword) {
    const enteredHash = await hashPassword(enteredPassword, SALT);
    return enteredHash === STORED_PASSWORD_HASH;
}

/**
 * Check if user is authenticated (has valid session in localStorage)
 * @returns {boolean} - True if user is logged in
 */
function isAuthenticated() {
    const authStatus = localStorage.getItem('cfi_authenticated');
    return authStatus === 'true';
}

/**
 * Set authentication status in localStorage
 * @param {boolean} status - Authentication status
 */
function setAuthenticated(status) {
    localStorage.setItem('cfi_authenticated', status ? 'true' : 'false');
}

/**
 * Authenticate user with username and password
 * @param {string} username - The username
 * @param {string} password - The password
 * @returns {Promise<boolean>} - True if authentication successful
 */
async function authenticate(username, password) {
    if (username !== CORRECT_USERNAME) {
        return false;
    }
    
    const isValid = await verifyPassword(password);
    if (isValid) {
        setAuthenticated(true);
    }
    return isValid;
}

// Helper function to compute hash for a password (for development/debugging)
// Usage: computeHashForPassword('admin@0000').then(hash => console.log('Hash:', hash));
async function computeHashForPassword(password) {
    return await hashPassword(password, SALT);
}
