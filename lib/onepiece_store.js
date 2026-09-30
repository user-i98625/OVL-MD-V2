const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const registry = require('./ovl_registry');

const dataFile = path.resolve(process.env.ONEPIECE_DATA_FILE || path.join(__dirname, 'onepiece_data.json'));
const islands = ['Fuchsia', 'Goat Island', 'Shell Town', 'Orange Town', 'Syrup Village', 'Baratie', 'Arlong Park', 'Loguetown', 'Grand Line'];
const races = ['Humain', 'Homme-poisson', 'Mink', 'Géant', 'Skypien'];
const classes = ['Pirate', 'Marine', 'Chasseur de primes', 'Médecin', 'Navigateur'];
const weapons = ['Poings', 'Sabre rouillé', 'Double katana', 'Lance marine', 'Lame noire'];
const fruits = ['Gomu Gomu', 'Mera Mera', 'Hie Hie', 'Suna Suna', 'Tori Tori'];
const defaults = { users: {}, groups: {}, accounts: {}, links: {}, linkCodes: {}, meta: { version: 2 } };

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    return { ...defaults, ...data, accounts: data.accounts || {}, links: data.links || {}, linkCodes: data.linkCodes || {} };
  } catch { return { ...defaults, users: {}, groups: {}, accounts: {}, links: {}, linkCodes: {}, meta: { version: 2 } }; }
}
let db = load();
function save() {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  const tmp = `${dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, dataFile);
  registry.set('onepiece', 'state', db).catch((error) => console.error('[onepiece] miroir registre indisponible:', error.message));
}
async function hydrate() {
  try {
    const remote = await registry.get('onepiece', 'state', null);
    if (remote && typeof remote === 'object') {
      db = { ...defaults, ...remote, accounts: remote.accounts || {}, links: remote.links || {}, linkCodes: remote.linkCodes || {} };
      fs.mkdirSync(path.dirname(dataFile), { recursive: true });
      fs.writeFileSync(dataFile, JSON.stringify(db, null, 2));
    } else {
      await registry.set('onepiece', 'state', db);
    }
    return db;
  } catch (error) {
    console.error('[onepiece] restauration du registre impossible:', error.message);
    return db;
  }
}
function key(groupId, userId) { return `${String(groupId || 'private')}:${String(userId || 'unknown')}`; }
function identity(platform, userId) { return `${String(platform).toLowerCase()}:${String(userId)}`; }
function today() { return new Date().toISOString().slice(0, 10); }
function xpFor(level) { return 100 + (Math.max(1, level) - 1) * 75; }
function accountId() { return `ovl_${crypto.randomBytes(8).toString('hex')}`; }
function getLink(platform, userId) { return db.links[identity(platform, userId)] || null; }
function ensureAccount(platform, userId) {
  const linked = getLink(platform, userId);
  if (linked && db.accounts[linked]) return db.accounts[linked];
  const id = accountId();
  db.accounts[id] = { id, links: [identity(platform, userId)], createdAt: Date.now() };
  db.links[identity(platform, userId)] = id;
  save();
  return db.accounts[id];
}
function createLinkCode(platform, userId) {
  const account = ensureAccount(platform, userId);
  for (const [code, value] of Object.entries(db.linkCodes)) if (value.accountId === account.id) delete db.linkCodes[code];
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  db.linkCodes[code] = { accountId: account.id, platform, userId, expiresAt: Date.now() + 10 * 60 * 1000 };
  save();
  return { code, expiresAt: db.linkCodes[code].expiresAt, accountId: account.id };
}
function redeemLinkCode(code, platform, userId) {
  const normalized = String(code || '').trim().toUpperCase();
  const pending = db.linkCodes[normalized];
  if (!pending || pending.expiresAt < Date.now()) { if (pending) { delete db.linkCodes[normalized]; save(); } throw new Error('Code de liaison invalide ou expiré'); }
  const current = getLink(platform, userId);
  if (current && current !== pending.accountId) throw new Error('Cette identité est déjà liée à un autre compte OVL');
  db.links[identity(platform, userId)] = pending.accountId;
  db.accounts[pending.accountId] = db.accounts[pending.accountId] || { id: pending.accountId, links: [], createdAt: Date.now() };
  if (!db.accounts[pending.accountId].links.includes(identity(platform, userId))) db.accounts[pending.accountId].links.push(identity(platform, userId));
  delete db.linkCodes[normalized]; save();
  return db.accounts[pending.accountId];
}
function unlink(platform, userId) { const id = identity(platform, userId); const account = db.links[id]; if (!account) return false; delete db.links[id]; if (db.accounts[account]) db.accounts[account].links = db.accounts[account].links.filter((x) => x !== id); save(); return true; }
function getUser(groupId, userId) {
  const id = key(groupId, userId);
  if (!db.users[id]) db.users[id] = { id: userId, groupId, accountId: getLink('whatsapp', userId), name: userId, level: 1, xp: 0, berries: 500, cola: 0, shards: 0, energy: 100, race: null, className: null, weapon: 'Poings', weaponLevel: 1, haki: { observation: 0, armement: 0, conquerant: 0 }, island: 0, chapter: 1, battles: 0, wins: 0, bounty: 0, reputation: 0, crew: null, inventory: ['Potion'], fruit: null, missions: {}, daily: null, lastFish: null, expedition: null, createdAt: Date.now() };
  return db.users[id];
}
function update(user) { db.users[key(user.groupId, user.id)] = user; save(); return user; }
function addXp(user, amount) { let gained = Math.max(0, Math.floor(amount)); user.xp += gained; let levels = 0; while (user.xp >= xpFor(user.level)) { user.xp -= xpFor(user.level); user.level += 1; levels += 1; user.energy = Math.min(100, user.energy + 10); user.bounty += 50; } return { gained, levels }; }
function allUsers(groupId) { return Object.values(db.users).filter((u) => String(u.groupId) === String(groupId)); }
function group(groupId) { if (!db.groups[groupId]) db.groups[groupId] = { boss: null, colosseum: [], createdAt: Date.now() }; return db.groups[groupId]; }
function commit() { save(); }
module.exports = { dataFile, islands, races, classes, weapons, fruits, today, xpFor, getUser, update, addXp, allUsers, group, commit, hydrate, getLink, ensureAccount, createLinkCode, redeemLinkCode, unlink };
