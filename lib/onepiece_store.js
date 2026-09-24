const fs = require('fs');
const path = require('path');

const dataFile = path.resolve(process.env.ONEPIECE_DATA_FILE || path.join(__dirname, 'onepiece_data.json'));
const islands = ['Fuchsia', 'Goat Island', 'Shell Town', 'Orange Town', 'Syrup Village', 'Baratie', 'Arlong Park', 'Loguetown', 'Grand Line'];
const races = ['Humain', 'Homme-poisson', 'Mink', 'Géant', 'Skypien'];
const classes = ['Pirate', 'Marine', 'Chasseur de primes', 'Médecin', 'Navigateur'];
const weapons = ['Poings', 'Sabre rouillé', 'Double katana', 'Lance marine', 'Lame noire'];
const fruits = ['Gomu Gomu', 'Mera Mera', 'Hie Hie', 'Suna Suna', 'Tori Tori'];
const defaults = { users: {}, groups: {}, meta: { version: 1 } };

function load() {
  try { return { ...defaults, ...JSON.parse(fs.readFileSync(dataFile, 'utf8')) }; } catch { return { ...defaults, users: {}, groups: {}, meta: { version: 1 } }; }
}
let db = load();
function save() {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  const tmp = `${dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, dataFile);
}
function key(groupId, userId) { return `${String(groupId || 'private')}:${String(userId || 'unknown')}`; }
function today() { return new Date().toISOString().slice(0, 10); }
function xpFor(level) { return 100 + (Math.max(1, level) - 1) * 75; }
function getUser(groupId, userId) {
  const id = key(groupId, userId);
  if (!db.users[id]) db.users[id] = { id: userId, groupId, name: userId, level: 1, xp: 0, berries: 500, cola: 0, shards: 0, energy: 100, race: null, className: null, weapon: 'Poings', weaponLevel: 1, haki: { observation: 0, armement: 0, conquerant: 0 }, island: 0, chapter: 1, battles: 0, wins: 0, bounty: 0, reputation: 0, crew: null, inventory: ['Potion'], fruit: null, missions: {}, daily: null, lastFish: null, expedition: null, createdAt: Date.now() };
  return db.users[id];
}
function update(user) { db.users[key(user.groupId, user.id)] = user; save(); return user; }
function addXp(user, amount) {
  let gained = Math.max(0, Math.floor(amount)); user.xp += gained;
  let levels = 0;
  while (user.xp >= xpFor(user.level)) { user.xp -= xpFor(user.level); user.level += 1; levels += 1; user.energy = Math.min(100, user.energy + 10); user.bounty += 50; }
  return { gained, levels };
}
function allUsers(groupId) { return Object.values(db.users).filter((u) => String(u.groupId) === String(groupId)); }
function group(groupId) { if (!db.groups[groupId]) db.groups[groupId] = { boss: null, colosseum: [], createdAt: Date.now() }; return db.groups[groupId]; }
function commit() { save(); }
module.exports = { dataFile, islands, races, classes, weapons, fruits, today, xpFor, getUser, update, addXp, allUsers, group, commit };
