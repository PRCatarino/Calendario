const oracledb = require('oracledb');

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.CLOB];
oracledb.fetchAsBuffer = [oracledb.BLOB];

let pool;

async function init() {
  if (pool) return pool;
  pool = await oracledb.createPool({
    user: process.env.ORACLE_USER || 'cal',
    password: process.env.ORACLE_PASSWORD || 'cal',
    connectString: process.env.ORACLE_CONNECT || 'localhost:1521/XEPDB1',
    poolMin: 1,
    poolMax: 8,
    poolIncrement: 1,
  });
  return pool;
}

// run a callback with a pooled connection, auto-close
async function withConn(fn) {
  const conn = await oracledb.getConnection();
  try {
    return await fn(conn);
  } finally {
    await conn.close();
  }
}

module.exports = { oracledb, init, withConn };
