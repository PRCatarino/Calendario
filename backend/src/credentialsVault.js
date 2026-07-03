const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Write-only credentials vault. The app ONLY appends — it never reads this back.
// JSON Lines format (one JSON object per line) so writes are pure appends,
// never requiring a read+parse of existing content.
const VAULT_DIR = path.join(__dirname, '..', 'vault');
const VAULT_FILE = path.join(VAULT_DIR, 'client-credentials.jsonl');

/** append a newly created client's plaintext credentials (write-only). */
function appendCredential({ name, username, password }) {
  try {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
    const line = JSON.stringify({
      name,
      username,
      password,
      created_at: new Date().toISOString(),
    }) + '\n';
    fs.appendFileSync(VAULT_FILE, line, { encoding: 'utf8', mode: 0o600 });
    logger.info('client credential appended to vault', { username });
  } catch (e) {
    // never block client creation on a vault failure
    logger.error('vault write failed', { username, message: e.message });
  }
}

module.exports = { appendCredential, VAULT_FILE };
