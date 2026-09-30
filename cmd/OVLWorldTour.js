const { ovlcmd } = require('../lib/ovlcmd');
const store = require('../lib/onepiece_store');

function argText(arg) { return Array.isArray(arg) ? arg.join(' ').trim() : String(arg || '').trim(); }
function send(repondre, text) { return repondre(text); }

ovlcmd({ nom_cmd: 'oplink', alias: ['ovllink', 'opliaison'], classe: 'OnePiece', react: '🔗', desc: 'Génère un code pour relier le compte WhatsApp à OVL World Tour.' }, async (_jid, _sock, { repondre, auteur_Message }) => {
  const link = store.createLinkCode('whatsapp', auteur_Message);
  return send(repondre, `🔐 *LIAISON OVL WORLD TOUR*\n\nTon code temporaire est : *${link.code}*\n\nIl expire dans 10 minutes. Transmets-le uniquement à ton propre bot Discord OVL, jamais à une autre personne.\n\nQuand le bot Discord sera installé, il utilisera ce code avec la commande *.oplinkcode ${link.code}*.`);
});
ovlcmd({ nom_cmd: 'oplinkstatus', alias: ['ovlcompte', 'opcompte'], classe: 'OnePiece', react: '👤', desc: 'Affiche l’état de liaison du compte OVL.' }, async (_jid, _sock, { repondre, auteur_Message }) => {
  const account = store.getLink('whatsapp', auteur_Message);
  if (!account) return send(repondre, '👤 Aucun compte OVL n’est encore lié. Utilise *.oplink* pour préparer une liaison Discord.');
  return send(repondre, `👤 Compte OVL lié : *${account}*\n\nTu peux utiliser le même compte pour les futures plateformes OVL autorisées.`);
});
ovlcmd({ nom_cmd: 'opunlink', alias: ['ovldelink'], classe: 'OnePiece', react: '🔓', desc: 'Supprime la liaison de cette identité avec OVL.' }, async (_jid, _sock, { repondre, auteur_Message, arg }) => {
  if (argText(arg).toLowerCase() !== 'confirmer') return send(repondre, '⚠️ Pour supprimer la liaison, écris *.opunlink confirmer*.');
  const removed = store.unlink('whatsapp', auteur_Message);
  return send(repondre, removed ? '🔓 Liaison WhatsApp supprimée. Ton profil local reste conservé.' : 'ℹ️ Aucune liaison active trouvée.');
});

module.exports = {};
