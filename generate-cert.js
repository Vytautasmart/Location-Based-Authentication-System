const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

const sslDir = path.join(__dirname, 'ssl');

if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir);
}

const attrs = [{ name: 'commonName', value: 'localhost' }];
const pems = selfsigned.generate(attrs, {
    keySize: 2048,
    days: 365,
    algorithm: 'sha256',
    extensions: [{ name: 'basicConstraints', cA: true }],
});

fs.writeFileSync(path.join(sslDir, 'cert.pem'), pems.cert);
fs.writeFileSync(path.join(sslDir, 'key.pem'), pems.private);

console.log('SSL certificate and key generated successfully in ssl/ directory.');
