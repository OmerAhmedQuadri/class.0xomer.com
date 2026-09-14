// Hash generator: computes the value for STORED_PASSWORD_HASH in auth.js
// Note: auth.js must be loaded before this script (for hashPassword and SALT)

if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-mode');
}

const saltInput = document.getElementById('salt');
const hashBtn = document.querySelector('.hash-btn');
const resultSection = document.getElementById('resultSection');
const hashOutput = document.getElementById('hashOutput');

saltInput.value = SALT;

if (!CAN_HASH) {
    hashOutput.textContent = INSECURE_CONTEXT_MESSAGE;
    hashOutput.classList.add('is-error');
    document.getElementById('copyHashBtn').hidden = true;
    resultSection.hidden = false;
    hashBtn.disabled = true;
}

document.getElementById('hashForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const password = document.getElementById('password').value;
    const salt = saltInput.value || SALT;

    hashBtn.disabled = true;
    hashBtn.textContent = 'Computing...';

    try {
        hashOutput.textContent = await hashPassword(password, salt);
        hashOutput.classList.remove('is-error');
    } catch (error) {
        console.error('Hash computation error:', error);
        hashOutput.textContent = 'Error computing hash. Please try again.';
        hashOutput.classList.add('is-error');
    } finally {
        resultSection.hidden = false;
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        hashBtn.disabled = false;
        hashBtn.textContent = 'Compute Hash';
    }
});

document.getElementById('copyHashBtn').addEventListener('click', function() {
    const btn = this;

    navigator.clipboard.writeText(hashOutput.textContent).then(function() {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');

        setTimeout(function() {
            btn.textContent = 'Copy Hash';
            btn.classList.remove('copied');
        }, 2000);
    }).catch(function(err) {
        console.error('Failed to copy hash: ', err);
        alert('Failed to copy to clipboard. Please select and copy manually.');
    });
});
