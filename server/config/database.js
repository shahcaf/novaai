const { Sequelize } = require('sequelize');
require('dotenv').config(); // Load .env (works locally and on Render)

// Support multiple env variable names for flexibility
const dbUrl =
  process.env.DATABASE_URL ||
  process.env.COCKROACHDB_URL ||
  process.env.DATABASE_URL_RENDER;

if (!dbUrl) {
  console.error('\n🚨 DATABASE_URL is not set! 🚨\nDefine DATABASE_URL (or COCKROACHDB_URL) in your environment.\nExample: postgres://user:pass@host:26257/defaultdb\n');
  process.exit(1);
}

// Initialise Sequelize with CockroachDB‑compatible SSL options
const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  logging: false,
});

module.exports = sequelize;
