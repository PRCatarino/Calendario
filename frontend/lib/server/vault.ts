import { query } from './db';

// Write-only credentials vault. The app only INSERTs — it never SELECTs this table.
// (Serverless has no writable filesystem, so we persist to Postgres instead of a file.)
export async function appendCredential(c: { name: string; username: string; password: string }) {
  try {
    await query(
      `insert into client_credentials (name, username, password) values ($1, $2, $3)`,
      [c.name, c.username, c.password],
    );
  } catch {
    // never block client creation on a vault failure
  }
}
