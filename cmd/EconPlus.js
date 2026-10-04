const { ovlcmd } = require('../lib/ovlcmd');
const registry = require('../lib/ovl_registry');
const { ECONOMIE, ajouterUtilisateur, getInfosUtilisateur, modifierSolde, TopBanque } = require('../DataBase/economie');

const PREFIX = 'ep';
const MENU = `💼 *OVL ECON PLUS*

💰 *.eptravail* — travailler et gagner de l’argent
📜 *.epmission* — mission économique quotidienne
🏦 *.epdepot <montant>* — portefeuille → banque
💸 *.epretrait <montant>* — banque → portefeuille
🤝 *.eptransfert @membre <montant>* — envoyer de l’argent
🎒 *.epinventaire* — objets économiques
🛒 *.epmarche* — marché et objets disponibles
🎁 *.epacheter <objet>* — acheter un objet
🪙 *.epvendre <objet>* — revendre un objet
🎲 *.epcoinflip <montant>* — pile ou face
🎟️ *.eploterie* — ticket quotidien
🏢 *.epentreprise* — créer et gérer son entreprise
📦 *.eprevenus* — récupérer les revenus de l’entreprise
🏛️ *.epcaisse* — caisse économique du groupe
🏆 *.eptop* — classement des fortunes
📊 *.epprofil* — profil économique détaillé

La monnaie est la même que celle de *.myecon*.`;

const ITEMS = {
  potion: { name: 'Potion de travail', price: 500, sell: 250, description: 'réduit le prochain délai de travail' },
  coffre: { name: 'Coffre marchand', price: 2500, sell: 1250, description: 'contient une récompense aléatoire' },
  ticket: { name: 'Ticket de loterie', price: 1000, sell: 500, description: 'ticket supplémentaire' },
  contrat: { name: 'Contrat commercial', price: 5000, sell: 2500, description: 'augmente les revenus d’entreprise' }
};
const JOBS = [
  ['Marchand de Grand Line', 900, 1800], ['Mineur de Wano', 700, 2200], ['Chasseur de primes', 1000, 2500],
  ['Cuisinier de navire', 600, 1600], ['Courtier du marché noir', 1200, 3000]
];
const cooldowns = new Map();

function text(arg) { return Array.isArray(arg) ? arg.join(' ').trim() : String(arg || '').trim(); }
function number(arg) { const matches = String(arg || '').match(/\b\d+\b/g) || []; const n = Number(matches[matches.length - 1] || 0); return Number.isSafeInteger(n) ? n : 0; }
function userName(jid) { return String(jid || '').split('@')[0]; }
function mention(jid) { return `@${userName(jid)}`; }
function groupOnly(jid, reply) { if (!String(jid).endsWith('@g.us')) { reply('❌ Cette commande fonctionne uniquement dans un groupe.'); return false; } return true; }
function targetFrom(arg) { const found = text(arg).match(/@?(\d{5,20})/); return found ? `${found[1]}@s.whatsapp.net` : null; }
async function ensure(id) { await ajouterUtilisateur(id, userName(id)); return getInfosUtilisateur(id); }
async function balance(id) { const info = await ensure(id); return { info, wallet: Number(info?.portefeuille || 0), bank: Number(info?.banque || 0) }; }
async function change(id, field, amount) { await ensure(id); return modifierSolde(id, field, amount); }
function cooldown(id, key, ms) { const k = `${key}:${id}`, now = Date.now(), last = cooldowns.get(k) || 0; if (now - last < ms) return Math.ceil((ms - (now - last)) / 1000); cooldowns.set(k, now); return 0; }
async function reply(r, msg) { return typeof r === 'function' ? r(msg) : null; }
async function getExtra(id) { return registry.get('econplus', id, { inventory: {}, company: null, lastMission: 0, lastLottery: 0 }); }
async function saveExtra(id, data) { return registry.set('econplus', id, data); }

ovlcmd({ nom_cmd: 'econplus', alias: ['econplusmenu', 'menueconplus', 'economieplus'], classe: 'Economie Plus', react: '💼', desc: 'Affiche la nouvelle catégorie Econ Plus.' }, async (jid, sock, { repondre }) => reply(repondre, MENU));
ovlcmd({ nom_cmd: 'eptravail', alias: ['travailplus', 'travail-econ'], classe: 'Economie Plus', react: '⚒️', desc: 'Travaille et gagne de l’argent ECON-Y.' }, async (jid, sock, { repondre, auteur_Message }) => {
  const wait = cooldown(auteur_Message, 'work', 30 * 60 * 1000); if (wait) return reply(repondre, `⏳ Ton prochain travail sera disponible dans ${wait} secondes.`);
  const job = JOBS[Math.floor(Math.random() * JOBS.length)]; const reward = job[1] + Math.floor(Math.random() * (job[2] - job[1] + 1));
  await change(auteur_Message, 'portefeuille', reward);
  return reply(repondre, `⚒️ ${mention(auteur_Message)} a travaillé comme *${job[0]}* et gagne *${reward.toLocaleString()} pièces*.
✅ L’argent est directement ajouté à ton solde *.myecon*.`);
});
ovlcmd({ nom_cmd: 'epmission', alias: ['missioneco', 'missionplus'], classe: 'Economie Plus', react: '📜', desc: 'Effectue une mission économique quotidienne.' }, async (jid, sock, { repondre, auteur_Message }) => {
  const extra = await getExtra(auteur_Message); if (Date.now() - extra.lastMission < 86400000) return reply(repondre, '⏳ Tu as déjà terminé ta mission économique aujourd’hui.');
  const reward = 2500 + Math.floor(Math.random() * 3501); extra.lastMission = Date.now(); await saveExtra(auteur_Message, extra); await change(auteur_Message, 'portefeuille', reward);
  return reply(repondre, `📜 Mission terminée par ${mention(auteur_Message)}.
🪙 Récompense : *${reward.toLocaleString()} pièces* ajoutées à *.myecon*.`);
});
ovlcmd({ nom_cmd: 'epdepot', alias: ['depotplus', 'deposecon'], classe: 'Economie Plus', react: '🏦', desc: 'Dépose l’argent du portefeuille vers la banque.' }, async (jid, sock, { repondre, auteur_Message, arg }) => {
  const amount = number(text(arg)); if (amount <= 0) return reply(repondre, '❌ Exemple : *.epdepot 5000*'); const b = await balance(auteur_Message); if (b.wallet < amount) return reply(repondre, '❌ Ton portefeuille ne contient pas cette somme.'); await change(auteur_Message, 'portefeuille', -amount); await change(auteur_Message, 'banque', amount); return reply(repondre, `🏦 *${amount.toLocaleString()} pièces* déposées. Utilise *.myecon* pour vérifier ton compte.`);
});
ovlcmd({ nom_cmd: 'epretrait', alias: ['retraitplus', 'retirecon'], classe: 'Economie Plus', react: '💸', desc: 'Retire l’argent de la banque vers le portefeuille.' }, async (jid, sock, { repondre, auteur_Message, arg }) => {
  const amount = number(text(arg)); if (amount <= 0) return reply(repondre, '❌ Exemple : *.epretrait 5000*'); const b = await balance(auteur_Message); if (b.bank < amount) return reply(repondre, '❌ Ta banque ne contient pas cette somme.'); await change(auteur_Message, 'banque', -amount); await change(auteur_Message, 'portefeuille', amount); return reply(repondre, `💸 *${amount.toLocaleString()} pièces* retirées vers ton portefeuille.`);
});
ovlcmd({ nom_cmd: 'eptransfert', alias: ['transfertplus', 'donnecon'], classe: 'Economie Plus', react: '🤝', desc: 'Transfère des pièces ECON-Y à un membre.' }, async (jid, sock, { repondre, auteur_Message, arg }) => {
  const target = targetFrom(arg), amount = number(text(arg)); if (!target || target === auteur_Message || amount <= 0) return reply(repondre, '❌ Exemple : *.eptransfert @membre 1000*'); const b = await balance(auteur_Message); if (b.wallet < amount) return reply(repondre, '❌ Solde insuffisant dans ton portefeuille.'); await change(auteur_Message, 'portefeuille', -amount); await change(target, 'portefeuille', amount); const msg = `🤝 ${mention(auteur_Message)} a envoyé *${amount.toLocaleString()} pièces* à ${mention(target)}.`; if (sock?.sendMessage) return sock.sendMessage(jid, { text: msg, mentions: [auteur_Message, target] }); return reply(repondre, msg);
});
ovlcmd({ nom_cmd: 'epinventaire', alias: ['inventaireplus', 'sacecon'], classe: 'Economie Plus', react: '🎒', desc: 'Affiche l’inventaire économique.' }, async (jid, sock, { repondre, auteur_Message }) => { const e = await getExtra(auteur_Message); const list = Object.entries(e.inventory || {}).filter(([, n]) => n > 0).map(([k, n]) => `• ${ITEMS[k]?.name || k} x${n}`).join('\n') || 'Aucun objet'; return reply(repondre, `🎒 *INVENTAIRE ÉCON PLUS*\n\n${list}`); });
ovlcmd({ nom_cmd: 'epmarche', alias: ['marcheecon', 'shopplus'], classe: 'Economie Plus', react: '🛒', desc: 'Affiche le marché Econ Plus.' }, async (jid, sock, { repondre }) => reply(repondre, `🛒 *MARCHÉ ECON PLUS*\n\n${Object.entries(ITEMS).map(([k, v]) => `• *${k}* — ${v.name} : ${v.price.toLocaleString()} pièces\n  ${v.description}`).join('\n')}\n\nAcheter : *.epacheter <objet>*`));
ovlcmd({ nom_cmd: 'epacheter', alias: ['acheterplus', 'achetecon'], classe: 'Economie Plus', react: '🛍️', desc: 'Achète un objet avec la monnaie ECON-Y.' }, async (jid, sock, { repondre, auteur_Message, arg }) => { const key = text(arg).toLowerCase().split(/\s+/)[0], item = ITEMS[key]; if (!item) return reply(repondre, '❌ Objet inconnu. Utilise *.epmarche*.'); const b = await balance(auteur_Message); if (b.wallet < item.price) return reply(repondre, '❌ Tu n’as pas assez de pièces dans ton portefeuille.'); const e = await getExtra(auteur_Message); e.inventory[key] = (e.inventory[key] || 0) + 1; await saveExtra(auteur_Message, e); await change(auteur_Message, 'portefeuille', -item.price); return reply(repondre, `✅ ${item.name} acheté pour *${item.price.toLocaleString()} pièces*.`); });
ovlcmd({ nom_cmd: 'epvendre', alias: ['vendreplus', 'vendecon'], classe: 'Economie Plus', react: '💰', desc: 'Revends un objet du nouvel inventaire.' }, async (jid, sock, { repondre, auteur_Message, arg }) => { const key = text(arg).toLowerCase().split(/\s+/)[0], item = ITEMS[key], e = await getExtra(auteur_Message); if (!item || !(e.inventory[key] > 0)) return reply(repondre, '❌ Objet absent de ton inventaire.'); e.inventory[key] -= 1; await saveExtra(auteur_Message, e); await change(auteur_Message, 'portefeuille', item.sell); return reply(repondre, `💰 ${item.name} revendu : *+${item.sell.toLocaleString()} pièces*.`); });
ovlcmd({ nom_cmd: 'epcoinflip', alias: ['coinflipecon', 'pilefaceeco'], classe: 'Economie Plus', react: '🎲', desc: 'Mise des pièces ECON-Y sur pile ou face.' }, async (jid, sock, { repondre, auteur_Message, arg }) => { const amount = number(text(arg)); if (amount < 100 || amount > 50000) return reply(repondre, '❌ Mise autorisée : entre 100 et 50 000 pièces.'); const b = await balance(auteur_Message); if (b.wallet < amount) return reply(repondre, '❌ Solde insuffisant.'); await change(auteur_Message, 'portefeuille', -amount); const win = Math.random() < 0.48; const gain = win ? amount * 2 : 0; if (gain) await change(auteur_Message, 'portefeuille', gain); return reply(repondre, win ? `🎉 ${mention(auteur_Message)} gagne *${gain.toLocaleString()} pièces* !` : `💥 ${mention(auteur_Message)} perd sa mise de *${amount.toLocaleString()} pièces*.`); });
ovlcmd({ nom_cmd: 'eploterie', alias: ['loterieeco', 'ticketeco'], classe: 'Economie Plus', react: '🎟️', desc: 'Achète un ticket quotidien de loterie.' }, async (jid, sock, { repondre, auteur_Message }) => { const e = await getExtra(auteur_Message); if (Date.now() - e.lastLottery < 86400000) return reply(repondre, '⏳ Tu as déjà participé à la loterie aujourd’hui.'); const b = await balance(auteur_Message); if (b.wallet < 1000) return reply(repondre, '❌ Il faut 1 000 pièces pour participer.'); e.lastLottery = Date.now(); await saveExtra(auteur_Message, e); await change(auteur_Message, 'portefeuille', -1000); const win = Math.random() < 0.08, gain = win ? 12000 + Math.floor(Math.random() * 18001) : 0; if (gain) await change(auteur_Message, 'portefeuille', gain); return reply(repondre, win ? `🎉 LOTERIE GAGNÉE : *${gain.toLocaleString()} pièces* !` : '🎟️ Ticket enregistré. Pas de gain aujourd’hui, retente demain.'); });
ovlcmd({ nom_cmd: 'epprofil', alias: ['profilecon', 'profilplus'], classe: 'Economie Plus', react: '📊', desc: 'Affiche le portefeuille et la banque ECON-Y.' }, async (jid, sock, { repondre, auteur_Message }) => { const b = await balance(auteur_Message), e = await getExtra(auteur_Message); return reply(repondre, `📊 *PROFIL ÉCONOMIQUE*\n\n${mention(auteur_Message)}\n💰 Portefeuille : *${b.wallet.toLocaleString()}*\n🏦 Banque : *${b.bank.toLocaleString()}*\n💎 Fortune : *${(b.wallet + b.bank).toLocaleString()}*\n🎒 Objets : *${Object.values(e.inventory || {}).reduce((a, n) => a + n, 0)}*`); });
ovlcmd({ nom_cmd: 'eptop', alias: ['richesseeco', 'topfortune'], classe: 'Economie Plus', react: '🏆', desc: 'Affiche le classement des fortunes.' }, async (jid, sock, { repondre }) => { const rows = await TopBanque(); if (!rows.length) return reply(repondre, 'ℹ️ Aucun joueur économique enregistré.'); return reply(repondre, `🏆 *TOP FORTUNUNES*\n\n${rows.map((x, i) => `${i + 1}. @${userName(x.id)} — banque ${Number(x.banque || 0).toLocaleString()} | portefeuille ${Number(x.portefeuille || 0).toLocaleString()}`).join('\n')}`); });
ovlcmd({ nom_cmd: 'epentreprise', alias: ['entrepriseeco', 'businessplus'], classe: 'Economie Plus', react: '🏢', desc: 'Crée ou améliore une entreprise économique.' }, async (jid, sock, { repondre, auteur_Message, arg }) => { const e = await getExtra(auteur_Message); const action = text(arg).toLowerCase(); if (!e.company) { const b = await balance(auteur_Message); if (b.wallet < 10000) return reply(repondre, '❌ Il faut 10 000 pièces dans ton portefeuille pour créer une entreprise.'); e.company = { name: 'Commerce OVL', level: 1, lastClaim: 0 }; await saveExtra(auteur_Message, e); await change(auteur_Message, 'portefeuille', -10000); return reply(repondre, `🏢 Entreprise créée : *${e.company.name}*\nNiveau 1 — utilise *.epentreprise upgrade* pour l’améliorer.`); } if (['upgrade', 'ameliorer', 'améliorer'].includes(action)) { const price = e.company.level * 15000; const b = await balance(auteur_Message); if (b.wallet < price) return reply(repondre, `❌ Amélioration : ${price.toLocaleString()} pièces nécessaires.`); e.company.level += 1; await saveExtra(auteur_Message, e); await change(auteur_Message, 'portefeuille', -price); return reply(repondre, `⬆️ Entreprise améliorée au niveau *${e.company.level}*.`); } return reply(repondre, `🏢 *${e.company.name}* — niveau ${e.company.level}\nRevenus disponibles : ${((e.company.level * 1800)).toLocaleString()} pièces\nUtilise *.eprevenus* pour collecter.`); });
ovlcmd({ nom_cmd: 'eprevenus', alias: ['revenusplus', 'collecterevenus'], classe: 'Economie Plus', react: '📦', desc: 'Collecte les revenus de son entreprise.' }, async (jid, sock, { repondre, auteur_Message }) => { const e = await getExtra(auteur_Message); if (!e.company) return reply(repondre, '❌ Crée d’abord ton entreprise avec *.epentreprise*.'); const wait = cooldown(auteur_Message, 'company', 6 * 60 * 60 * 1000); if (wait) return reply(repondre, `⏳ Prochaine collecte dans ${wait} secondes.`); const gain = e.company.level * 1800 + Math.floor(Math.random() * 1201); await change(auteur_Message, 'portefeuille', gain); return reply(repondre, `📦 Revenus collectés : *+${gain.toLocaleString()} pièces* dans ton portefeuille *.myecon*.`); });
ovlcmd({ nom_cmd: 'epcaisse', alias: ['caisseecon', 'caisseplus'], classe: 'Economie Plus', react: '🏛️', desc: 'Consulte ou alimente la caisse du groupe.' }, async (jid, sock, { repondre, auteur_Message, arg }) => { if (!groupOnly(jid, repondre)) return; const state = await registry.get('econplus_group', jid, { balance: 0, contributors: {} }); const parts = text(arg).toLowerCase().split(/\s+/); if (['deposer', 'deposit', 'donner'].includes(parts[0])) { const amount = number(parts[1]); if (amount <= 0) return reply(repondre, '❌ Exemple : *.epcaisse deposer 1000*'); const b = await balance(auteur_Message); if (b.wallet < amount) return reply(repondre, '❌ Solde insuffisant.'); state.balance += amount; state.contributors[auteur_Message] = (state.contributors[auteur_Message] || 0) + amount; await registry.set('econplus_group', jid, state); await change(auteur_Message, 'portefeuille', -amount); return reply(repondre, `🏛️ *${amount.toLocaleString()} pièces* ajoutées à la caisse du groupe.`); } return reply(repondre, `🏛️ *CAISSE DU GROUPE*\n\nSolde : *${Number(state.balance).toLocaleString()} pièces*\nContributeurs : ${Object.keys(state.contributors).length}\n\nAlimenter : *.epcaisse deposer <montant>*`); });
