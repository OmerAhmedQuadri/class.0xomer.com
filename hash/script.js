// Hash generator functionality

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

document.getElementById('hashForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const password = document.getElementById('password').value;
    const salt = document.getElementById('salt').value || 'secure_salt_key';
    const hashBtn = document.querySelector('.hash-btn');
    const resultSection = document.getElementById('resultSection');
    const hashOutput = document.getElementById('hashOutput');
    
    // Disable button during computation
    hashBtn.disabled = true;
    hashBtn.textContent = 'Computing...';
    
    try {
        const hash = await hashPassword(password, salt);
        
        // Display result
        hashOutput.textContent = hash;
        resultSection.style.display = 'block';
        
        // Scroll to result
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
        console.error('Hash computation error:', error);
        hashOutput.textContent = 'Error computing hash. Please try again.';
        hashOutput.style.color = '#dc3545';
        resultSection.style.display = 'block';
    } finally {
        hashBtn.disabled = false;
        hashBtn.textContent = 'Compute Hash';
    }
});

// Copy hash to clipboard
document.getElementById('copyHashBtn').addEventListener('click', function() {
    const hashText = document.getElementById('hashOutput').textContent;
    
    navigator.clipboard.writeText(hashText).then(function() {
        const btn = document.getElementById('copyHashBtn');
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        
        setTimeout(function() {
            btn.textContent = originalText;
            btn.classList.remove('copied');
        }, 2000);
    }).catch(function(err) {
        console.error('Failed to copy hash: ', err);
        alert('Failed to copy to clipboard. Please select and copy manually.');
    });
});
