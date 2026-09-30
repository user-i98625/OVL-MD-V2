const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const databaseUrl = process.env.DATABASE || process.env.DATABASE_URL || process.env.OVL_DATABASE_URL || '';
const sqliteFile = path.resolve(process.env.OVL_REGISTRY_SQLITE || path.join(process.cwd(), 'data', 'ovl-registry.sqlite'));
const durable = Boolean(databaseUrl || process.env.OVL_REGISTRY_SQLITE);
const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
      pool: { max: 5, min: 0, idle: 10000 }
    })
  : new Sequelize({ dialect: 'sqlite', storage: sqliteFile, logging: false });

const OvlRegistry = sequelize.define('OvlRegistry', {
  namespace: { type: DataTypes.STRING(80), primaryKey: true },
  key: { type: DataTypes.STRING(180), primaryKey: true },
  value: { type: DataTypes.JSON, allowNull: false },
  updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.NOW }
}, { tableName: 'ovl_registry', timestamps: false });

let readyPromise;
function ready() {
  if (!readyPromise) {
    readyPromise = (async () => {
      if (!databaseUrl) fs.mkdirSync(path.dirname(sqliteFile), { recursive: true });
      await sequelize.authenticate();
      await OvlRegistry.sync();
      return true;
    })().catch((error) => {
      readyPromise = null;
      console.error('[ovl-registry] connexion indisponible:', error.message);
      throw error;
    });
  }
  return readyPromise;
}
async function get(namespace, key, fallback = null) {
  await ready();
  const row = await OvlRegistry.findOne({ where: { namespace: String(namespace), key: String(key) } });
  return row ? row.value : fallback;
}
async function set(namespace, key, value) {
  await ready();
  await OvlRegistry.upsert({ namespace: String(namespace), key: String(key), value, updatedAt: new Date() });
  return value;
}
async function remove(namespace, key) {
  await ready();
  return OvlRegistry.destroy({ where: { namespace: String(namespace), key: String(key) } });
}
async function list(namespace) {
  await ready();
  const rows = await OvlRegistry.findAll({ where: { namespace: String(namespace) } });
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}
function status() {
  return { durable, backend: databaseUrl ? 'postgres' : 'sqlite', sqliteFile: databaseUrl ? null : sqliteFile, table: 'ovl_registry' };
}
module.exports = { ready, get, set, remove, list, status, sequelize, OvlRegistry };
