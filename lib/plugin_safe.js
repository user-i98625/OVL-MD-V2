const fs = require('fs');
const path = require('path');
const registry = require('./ovlcmd');

let reloading = false;

function remotePluginsEnabled() {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.ENABLE_REMOTE_PLUGINS || '').toLowerCase());
}

function loadFolder(folder, label) {
  if (!fs.existsSync(folder)) return 0;
  const files = fs.readdirSync(folder).filter((file) => path.extname(file).toLowerCase() === '.js').sort();
  console.log(`📂 Chargement des ${label} (${files.length}) :`);
  let loaded = 0;
  for (const file of files) {
    const fullPath = path.join(folder, file);
    try {
      delete require.cache[require.resolve(fullPath)];
      require(fullPath);
      loaded += 1;
      console.log(`  ✓ ${file}`);
    } catch (error) {
      console.error(`  ✗ ${file}: ${error.message}`);
    }
  }
  return loaded;
}

async function installpg() {
  if (!remotePluginsEnabled()) {
    console.log('ℹ️ Plugins distants désactivés (ENABLE_REMOTE_PLUGINS non activé).');
    return;
  }
  console.log('⚠️ Plugins distants activés : leur chargement peut ralentir le démarrage.');
}

async function reloadCommands() {
  if (reloading) return;
  reloading = true;
  try {
    if (Array.isArray(registry.cmd)) registry.cmd.length = 0;
    if (Array.isArray(registry.func)) registry.func.length = 0;
    loadFolder(path.join(__dirname, '../cmd'), 'commandes');
    if (remotePluginsEnabled()) {
      loadFolder(path.join(__dirname, '../plugins'), 'plugins');
    } else {
      console.log('ℹ️ Aucun plugin distant chargé. Les commandes locales sont prêtes.');
    }
  } finally {
    reloading = false;
  }
}

module.exports = { installpg, reloadCommands, remotePluginsEnabled };
