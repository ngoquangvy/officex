const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEY_PATH = path.resolve(__dirname, '..', 'extension-key.pem');
const CONFIG_PATH = path.resolve(__dirname, '..', 'config.json');

// Generate RSA 2048 key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// Chrome extension ID = first 128 bits of SHA256(SubjectPublicKeyInfo)
// Encoded as 32 chars using a-p alphabet (4 bits per char)
const hash = crypto.createHash('sha256').update(publicKey).digest();
const chars = 'abcdefghijklmnop';
let extensionId = '';
for (let i = 0; i < 16; i++) {
    extensionId += chars[(hash[i] >> 4) & 0x0f];
    extensionId += chars[hash[i] & 0x0f];
}

console.log('Extension ID:', extensionId);
console.log('Saving private key to:', KEY_PATH);

fs.writeFileSync(KEY_PATH, privateKey, 'utf8');
console.log('Private key saved!');

// Update config.json
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
config.extensionId = extensionId;
fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4) + '\n', 'utf8');
console.log('config.json updated with extensionId:', extensionId);
