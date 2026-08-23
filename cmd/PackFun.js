const { ovlcmd } = require('../lib/ovlcmd');
const axios = require('axios');

const sessions = new Map();
const funScores = new Map();
const clueGames = new Map();
const tournamentGames = new Map();
const adventureGames = new Map();
const rpgGames = new Map();

const characters = [
  { name: 'Naruto Uzumaki', anime: 'Naruto', power: 'Mode Ermite', strength: 92, speed: 88, mind: 78 },
  { name: 'Monkey D. Luffy', anime: 'One Piece', power: 'Gear 5', strength: 95, speed: 90, mind: 75 },
  { name: 'Son Goku', anime: 'Dragon Ball', power: 'Ultra Instinct', strength: 99, speed: 98, mind: 84 },
  { name: 'Ichigo Kurosaki', anime: 'Bleach', power: 'Getsuga Tensho', strength: 91, speed: 94, mind: 80 },
  { name: 'Satoru Gojo', anime: 'Jujutsu Kaisen', power: 'Infini', strength: 96, speed: 93, mind: 98 },
  { name: 'Tanjiro Kamado', anime: 'Demon Slayer', power: 'Danse du Dieu du Feu', strength: 82, speed: 87, mind: 86 },
  { name: 'Eren Yeager', anime: 'Attack on Titan', power: 'Titan Originel', strength: 90, speed: 76, mind: 91 },
  { name: 'Light Yagami', anime: 'Death Note', power: 'Death Note', strength: 50, speed: 54, mind: 100 },
  { name: 'Edward Elric', anime: 'Fullmetal Alchemist', power: 'Alchimie', strength: 78, speed: 80, mind: 94 },
  { name: 'Kirito', anime: 'Sword Art Online', power: 'Dual Blades', strength: 84, speed: 97, mind: 82 },
  { name: 'Sailor Moon', anime: 'Sailor Moon', power: 'Cristal d’Argent', strength: 89, speed: 83, mind: 88 },
  { name: 'Levi Ackerman', anime: 'Attack on Titan', power: 'Équipement tridimensionnel', strength: 88, speed: 99, mind: 90 }
];

const quotes = [
  { quote: 'Je deviendrai le roi des pirates !', answer: 'Monkey D. Luffy', hint: 'Un pirate au chapeau de paille.' },
  { quote: 'Ce monde est pourri.', answer: 'Light Yagami', hint: 'Il porte toujours un cahier très dangereux.' },
  { quote: 'Je ne reviendrai jamais sur ma parole.', answer: 'Naruto Uzumaki', hint: 'Un ninja de Konoha.' },
  { quote: 'La peur est nécessaire pour comprendre la puissance.', answer: 'Satoru Gojo', hint: 'Un professeur aux yeux extraordinaires.' },
  { quote: 'Je vais te dépasser, même si je dois mourir !', answer: 'Tanjiro Kamado', hint: 'Il combat des démons avec une épée.' }
];

const openings = [
  { clue: 'Un opening avec des ninjas, des bandeaux frontaux et une grande vallée.', answer: 'Naruto', hint: 'Le héros porte souvent une tenue orange.' },
  { clue: 'Un opening de pirates, de trésors et d’une mer sans fin.', answer: 'One Piece', hint: 'Le capitaine porte un chapeau de paille.' },
  { clue: 'Un opening où des chasseurs affrontent des créatures dans des donjons.', answer: 'Solo Leveling', hint: 'Le héros devient de plus en plus puissant.' },
  { clue: 'Un opening rempli de sabres et de shinigamis.', answer: 'Bleach', hint: 'Le héros a les cheveux orange.' },
  { clue: 'Un opening où des pourfendeurs combattent des démons dans le Japon ancien.', answer: 'Demon Slayer', hint: 'Le héros porte des boucles d’oreilles célèbres.' }
];

const challenges = [
  'Envoie une phrase héroïque comme si tu étais le protagoniste d’un anime.',
  'Décris ton personnage préféré sans donner son nom : le groupe doit deviner.',
  'Écris une attaque spéciale avec un nom complètement ridicule.',
  'Fais une prédiction dramatique sur le prochain message du groupe.',
  'Invente le titre d’un anime basé sur la dernière discussion du groupe.',
  'Choisis un membre : il devient ton rival officiel pendant cinq minutes.'
];

const titles = ['Roi du retard', 'Maître des réponses rapides', 'Personnage principal', 'Génie incompris', 'Rival légendaire', 'Héros du groupe', 'Ninja discret', 'Source officielle des spoilers'];
const classes = ['Guerrier', 'Mage', 'Ninja', 'Alchimiste', 'Chasseur', 'Samouraï', 'Stratège', 'Porteur de malédiction'];
const worlds = ['Konoha', 'Grand Line', 'Soul Society', 'Lycée des exorcistes', 'Académie des héros', 'Terres d’alchimie'];

function clean(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
function textArg(arg) { return Array.isArray(arg) ? arg.join(' ').trim() : String(arg || '').trim(); }
function isGroup(jid) { return typeof jid === 'string' && jid.endsWith('@g.us'); }
function userName(jid) { return String(jid || 'joueur').split('@')[0]; }
function reply(repondre, text) { return typeof repondre === 'function' ? repondre(text) : Promise.resolve(); }
function todaySeed() { const now = new Date(); return now.getUTCFullYear() * 372 + (now.getUTCMonth() + 1) * 31 + now.getUTCDate(); }
function pick(list, seed = Math.floor(Math.random() * list.length)) { return list[Math.abs(seed) % list.length]; }
function addPoint(jid, amount = 1) { const score = funScores.get(jid) || 0; funScores.set(jid, score + amount); return score + amount; }
function mentionFromToken(token) {
  const match = String(token || '').match(/@?(\d{5,})/);
  return match ? `${match[1]}@s.whatsapp.net` : null;
}
function extractSender(received) { return received?.key?.participant || received?.key?.remoteJid || received?.participant || received?.sender || null; }
function extractText(received) { return received?.message?.conversation || received?.message?.extendedTextMessage?.text || received?.text || ''; }
async function receive(sock, jid, timeout) {
  if (typeof sock.recup_msg !== 'function') return null;
  try { return await sock.recup_msg({ ms_org: jid, temps: timeout }); } catch (_) { return null; }
}
function targetFrom(arg, author) {
  const tokens = Array.isArray(arg) ? arg : String(arg || '').split(/\s+/);
  return tokens.map(mentionFromToken).find(Boolean) || author;
}
function characterCard(character) {
  return `🎴 *${character.name}*\nAnime : ${character.anime}\nPouvoir : ${character.power}\n💪 Force ${character.strength} | ⚡ Vitesse ${character.speed} | 🧠 Esprit ${character.mind}`;
}
function genericGuessText(game) {
  return `${game.icon} *${game.title}*\n\n${game.clue}\n\n💬 Réponds avec *.devine nom*\n💡 *.indice* pour un indice\n🛑 *.stopdevine* pour arrêter.`;
}
async function getAnimeCharacterImage(query) {
  try {
    const response = await axios.get(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(query)}&limit=1`, { timeout: 7000 });
    const result = response?.data?.data?.[0];
    return result?.images?.jpg?.image_url || result?.images?.webp?.image_url || null;
  } catch (_) {
    return null;
  }
}
async function sendImage(sock, jid, url, caption, mentions = []) {
  if (!url || !sock || typeof sock.sendMessage !== 'function') return false;
  try {
    await sock.sendMessage(jid, { image: { url }, caption, mentions });
    return true;
  } catch (_) {
    return false;
  }
}
function groupOnly(jid, repondre) {
  if (isGroup(jid)) return true;
  reply(repondre, '❌ Cette fonction est réservée aux groupes.');
  return false;
}

ovlcmd({ nom_cmd: 'persodujour', alias: ['personnagedujour', 'dailycharacter'], classe: 'Fun', react: '🌟', desc: 'Affiche le personnage anime du jour.' }, async (jid, sock, { repondre }) => {
  const character = pick(characters, todaySeed());
  const caption = `🌟 *Personnage anime du jour*\n\n${characterCard(character)}\n\n📅 Reviens demain pour une nouvelle légende.`;
  const image = await getAnimeCharacterImage(character.name);
  if (!(await sendImage(sock, jid, image, caption))) await reply(repondre, caption);
});

ovlcmd({ nom_cmd: 'monpersonnage', alias: ['createurpersonnage', 'personnage'], classe: 'Fun', react: '🧬', desc: 'Génère un personnage anime personnalisé.' }, async (jid, sock, { repondre, auteur_Message, arg }) => {
  const name = textArg(arg) || userName(auteur_Message);
  const character = pick(characters);
  const level = 10 + Math.floor(Math.random() * 91);
  await reply(repondre, `🧬 *Fiche de personnage de ${name}*\n\nClasse : ${pick(classes)}\nMonde : ${pick(worlds)}\nPouvoir : ${character.power}\nNiveau : ${level}/100\nFaiblesse : ${pick(['les spoilers', 'le manque de sommeil', 'les examens', 'les ramen froids', 'son rival'])}`);
});

ovlcmd({ nom_cmd: 'combat', alias: ['duelanime', 'duel'], classe: 'Fun', react: '⚔️', desc: 'Simule un combat entre deux joueurs ou personnages.' }, async (jid, sock, { repondre, auteur_Message, arg }) => {
  if (!groupOnly(jid, repondre)) return;
  const opponent = targetFrom(arg, null);
  const first = pick(characters);
  const second = pick(characters, characters.indexOf(first) + 1);
  const left = authorLabel(auteur_Message, first);
  const right = opponent ? `@${userName(opponent)}` : second.name;
  const leftPower = first.strength + first.speed + first.mind + Math.floor(Math.random() * 30);
  const rightPower = opponent ? Math.floor(Math.random() * 250) + 100 : second.strength + second.speed + second.mind + Math.floor(Math.random() * 30);
  const winner = leftPower >= rightPower ? left : right;
  await reply(repondre, `⚔️ *COMBAT ANIME*\n\n${left} ⚡ ${leftPower}\nVS\n${right} ⚡ ${rightPower}\n\n🏆 Victoire : *${winner}*\n✨ ${pick(['Une attaque décisive !', 'Le public est en délire !', 'Un retournement de situation incroyable !'])}`);
});
function authorLabel(author, character) { return `@${userName(author)} (${character.name})`; }

ovlcmd({ nom_cmd: 'fusion', alias: ['fusionanime'], classe: 'Fun', react: '🧪', desc: 'Fusionne deux personnages anime.' }, async (jid, sock, { repondre, auteur_Message, arg }) => {
  const first = pick(characters);
  const second = pick(characters, characters.indexOf(first) + 1);
  const target = targetFrom(arg, null);
  const firstName = target ? `@${userName(auteur_Message)}` : first.name;
  const secondName = target ? `@${userName(target)}` : second.name;
  await reply(repondre, `🧪 *FUSION RÉUSSIE*\n\n${firstName} + ${secondName}\n\nNom : *${pick(['Zaruto', 'Gokuffy', 'Gocher', 'Lufuto', 'Tanjo'])}*\nPouvoir : ${first.power} + ${second.power}\nNiveau : ${70 + Math.floor(Math.random() * 31)}/100\nFaiblesse : ${pick(['les réveils matinaux', 'les légumes', 'les devoirs', 'les discours trop longs'])}`);
});

async function startClueGame(jid, repondre, game) {
  clueGames.set(jid, { ...game, attempts: 0 });
  await reply(repondre, genericGuessText(game));
}
ovlcmd({ nom_cmd: 'quisuisje', alias: ['devineperso', 'whami'], classe: 'Fun', react: '🕵️', desc: 'Devine un personnage anime avec des indices.' }, async (jid, sock, { repondre }) => {
  if (!groupOnly(jid, repondre)) return;
  const character = pick(characters);
  const game = { icon: '🕵️', title: 'Qui suis-je ?', clue: `Je viens de ${character.anime}. Mon pouvoir est lié à ${character.power}. Qui suis-je ?`, answer: character.name, hint: `Mon prénom commence par ${character.name[0]}.`, attempts: 0 };
  clueGames.set(jid, game);
  const image = await getAnimeCharacterImage(character.name);
  const text = genericGuessText(game);
  if (!(await sendImage(sock, jid, image, text))) await reply(repondre, text);
});
ovlcmd({ nom_cmd: 'citationanime', alias: ['citationmystere'], classe: 'Fun', react: '💬', desc: 'Devine le personnage d’une citation anime.' }, async (jid, sock, { repondre }) => {
  if (!groupOnly(jid, repondre)) return;
  const item = pick(quotes);
  await startClueGame(jid, repondre, { icon: '💬', title: 'Citation mystère', clue: `« ${item.quote} »`, answer: item.answer, hint: item.hint });
});
ovlcmd({ nom_cmd: 'opening', alias: ['openinganime'], classe: 'Fun', react: '🎵', desc: 'Devine un anime à partir d’un indice d’opening.' }, async (jid, sock, { repondre }) => {
  if (!groupOnly(jid, repondre)) return;
  const item = pick(openings);
  await startClueGame(jid, repondre, { icon: '🎵', title: 'Opening mystère', clue: item.clue, answer: item.answer, hint: item.hint });
});
ovlcmd({ nom_cmd: 'devine', alias: ['guess'], classe: 'Fun', react: '🎯', desc: 'Propose une réponse au jeu de devinettes actif.' }, async (jid, sock, { repondre, auteur_Message, arg }) => {
  const game = clueGames.get(jid);
  if (!game) { await reply(repondre, 'ℹ️ Aucun jeu de devinette actif. Lance `.quisuisje`, `.citationanime` ou `.opening`.'); return; }
  const guess = clean(textArg(arg));
  game.attempts += 1;
  if (guess && (guess === clean(game.answer) || clean(game.answer).includes(guess) && guess.length >= 4)) {
    clueGames.delete(jid);
    const score = addPoint(jid);
    await reply(repondre, `✅ Bonne réponse @${userName(auteur_Message)} ! C’était *${game.answer}*. +1 point (total fun : ${score}).`);
  } else {
    await reply(repondre, `❌ Ce n’est pas ça, @${userName(auteur_Message)}. Essaie encore ou demande *.indice*.`);
  }
});
ovlcmd({ nom_cmd: 'indice', alias: ['hint'], classe: 'Fun', react: '💡', desc: 'Donne un indice pour la devinette active.' }, async (jid, sock, { repondre }) => {
  const game = clueGames.get(jid);
  await reply(repondre, game ? `💡 Indice : ${game.hint}` : 'ℹ️ Aucun indice disponible.');
});
ovlcmd({ nom_cmd: 'stopdevine', alias: ['stopindice'], classe: 'Fun', react: '🛑', desc: 'Arrête la devinette active.' }, async (jid, sock, { repondre }) => {
  if (clueGames.delete(jid)) await reply(repondre, '🛑 Devinette arrêtée.'); else await reply(repondre, 'ℹ️ Aucune devinette active.');
});

ovlcmd({ nom_cmd: 'tournoi', alias: ['tournoianime', 'bracket'], classe: 'Fun', react: '🏆', desc: 'Lance un tournoi de personnages anime.' }, async (jid, sock, { repondre }) => {
  if (!groupOnly(jid, repondre)) return;
  const participants = [...characters].sort(() => Math.random() - 0.5).slice(0, 8);
  tournamentGames.set(jid, { participants, round: 1, votes: new Map() });
  await reply(repondre, `🏆 *TOURNOI ANIME*\n\n1️⃣ ${participants[0].name}\n2️⃣ ${participants[1].name}\n\nVote avec *.vote 1* ou *.vote 2*. Le personnage avec le plus de votes avance.`);
});
ovlcmd({ nom_cmd: 'vote', alias: ['voter'], classe: 'Fun', react: '🗳️', desc: 'Vote dans le tournoi ou la tier list active.' }, async (jid, sock, { repondre, auteur_Message, arg }) => {
  const game = tournamentGames.get(jid);
  if (!game) { await reply(repondre, 'ℹ️ Aucun vote actif. Lance `.tournoi`.'); return; }
  const choice = clean(textArg(arg));
  if (!['1', '2'].includes(choice)) { await reply(repondre, '❌ Réponds avec `.vote 1` ou `.vote 2`.'); return; }
  game.votes.set(auteur_Message, choice);
  const count1 = [...game.votes.values()].filter((value) => value === '1').length;
  const count2 = [...game.votes.values()].filter((value) => value === '2').length;
  if (game.votes.size < 2) { await reply(repondre, `🗳️ Vote enregistré. Scores actuels : 1️⃣ ${count1} — 2️⃣ ${count2}`); return; }
  const winner = count1 >= count2 ? game.participants[0] : game.participants[1];
  game.participants.splice(0, 2, winner);
  game.votes.clear();
  if (game.participants.length === 1) { tournamentGames.delete(jid); await reply(repondre, `🏆 *CHAMPION DU TOURNOI* : ${winner.name} !`); return; }
  await reply(repondre, `✅ ${winner.name} avance !\n\n1️⃣ ${game.participants[0].name}\n2️⃣ ${game.participants[1].name}\n\nVote avec *.vote 1* ou *.vote 2*.`);
});

ovlcmd({ nom_cmd: 'roulette', alias: ['roulettegroupe'], classe: 'Fun', react: '🎡', desc: 'Choisit un membre au hasard.' }, async (jid, sock, { repondre }) => {
  if (!groupOnly(jid, repondre)) return;
  let people = [];
  try { const metadata = await sock.groupMetadata(jid); people = (metadata.participants || []).map((item) => item.id || item.jid).filter(Boolean); } catch (_) {}
  const winner = pick(people.length ? people : ['le groupe entier']);
  await reply(repondre, `🎡 La roulette choisit : *${winner.includes('@') ? `@${userName(winner)}` : winner}* !`);
});
ovlcmd({ nom_cmd: 'pileface', alias: ['coinflip'], classe: 'Fun', react: '🪙', desc: 'Lance une pièce.' }, async (jid, sock, { repondre }) => { await reply(repondre, `🪙 Résultat : *${Math.random() < 0.5 ? 'PILE' : 'FACE'}*`); });
ovlcmd({ nom_cmd: 'de', alias: ['dés', 'dice'], classe: 'Fun', react: '🎲', desc: 'Lance un dé.' }, async (jid, sock, { repondre, arg }) => { const sides = Math.min(100, Math.max(2, parseInt(textArg(arg), 10) || 6)); await reply(repondre, `🎲 Dé à ${sides} faces : *${1 + Math.floor(Math.random() * sides)}*`); });
ovlcmd({ nom_cmd: 'defi', alias: ['challenge'], classe: 'Fun', react: '🔥', desc: 'Propose un défi au groupe.' }, async (jid, sock, { repondre }) => { await reply(repondre, `🔥 *Défi du groupe*\n\n${pick(challenges)}\n\nRécompense symbolique : +1 point fun.`); });
ovlcmd({ nom_cmd: 'actionverite', alias: ['av', 'actionouverite'], classe: 'Fun', react: '🎭', desc: 'Lance une question action ou vérité.' }, async (jid, sock, { repondre }) => { const action = Math.random() < 0.5; await reply(repondre, `🎭 *${action ? 'ACTION' : 'VÉRITÉ'}*\n\n${action ? pick(['Imite une attaque d’anime.', 'Écris un message uniquement avec des titres d’anime.', 'Défie quelqu’un en duel verbal.']) : pick(['Quel anime pourrais-tu revoir 100 fois ?', 'Quel personnage te ressemble le plus ?', 'Quel est ton plus grand talent inutile ?'])}`); });

ovlcmd({ nom_cmd: 'histoire', alias: ['story'], classe: 'Fun', react: '📖', desc: 'Construit une histoire avec les membres du groupe.' }, async (jid, sock, { repondre, arg, auteur_Message }) => {
  if (!groupOnly(jid, repondre)) return;
  const input = textArg(arg);
  let story = sessions.get(`story:${jid}`);
  if (!story || clean(input) === 'start') { story = { lines: [], author: auteur_Message }; sessions.set(`story:${jid}`, story); await reply(repondre, '📖 Histoire lancée ! Ajoute une phrase avec `.histoire ta phrase`. Termine avec `.histoire fin`.'); return; }
  if (clean(input) === 'fin') { sessions.delete(`story:${jid}`); await reply(repondre, `📖 *HISTOIRE FINALE*\n\n${story.lines.join('\n') || 'Le héros n’a même pas quitté son lit.'}`); return; }
  if (!input) { await reply(repondre, `📖 ${story.lines.length ? story.lines.join('\n') : 'L’histoire est vide…'}`); return; }
  if (story.lines.length >= 20) { await reply(repondre, '📖 L’histoire est complète. Utilise `.histoire fin`.'); return; }
  story.lines.push(`• @${userName(auteur_Message)} : ${input}`); await reply(repondre, `✅ Phrase ajoutée (${story.lines.length}/20).`);
});

const adventures = [
  { text: 'Un portail s’ouvre devant vous. Que faites-vous ?', choices: ['Entrer dans le portail', 'Fuir vers la forêt', 'Appeler le rival'] },
  { text: 'Un gardien bloque le chemin.', choices: ['Combattre', 'Négocier', 'Chercher un passage secret'] },
  { text: 'Le trésor final est devant vous.', choices: ['Le prendre', 'Le partager', 'Le détruire'] }
];
ovlcmd({ nom_cmd: 'aventure', alias: ['aventureanime', 'quest'], classe: 'Fun', react: '🗺️', desc: 'Lance une aventure interactive de groupe.' }, async (jid, sock, { repondre, arg }) => {
  if (!groupOnly(jid, repondre)) return;
  const input = clean(textArg(arg));
  let game = adventureGames.get(jid);
  if (!game || input === 'start') { game = { step: 0, choices: [] }; adventureGames.set(jid, game); await reply(repondre, `🗺️ *AVENTURE*\n\n${adventures[0].text}\n\n1️⃣ ${adventures[0].choices[0]}\n2️⃣ ${adventures[0].choices[1]}\n3️⃣ ${adventures[0].choices[2]}\n\nRéponds avec *.choix 1*, *.choix 2* ou *.choix 3*.`); return; }
  await reply(repondre, '🗺️ Une aventure est déjà en cours. Utilise `.choix 1`, `.choix 2` ou `.choix 3`.');
});
ovlcmd({ nom_cmd: 'choix', alias: ['choice'], classe: 'Fun', react: '🧭', desc: 'Choisit une action dans l’aventure.' }, async (jid, sock, { repondre, arg, auteur_Message }) => {
  const game = adventureGames.get(jid);
  if (!game) { await reply(repondre, 'ℹ️ Aucune aventure active. Lance `.aventure`.'); return; }
  const choice = parseInt(textArg(arg), 10);
  if (![1, 2, 3].includes(choice)) { await reply(repondre, '❌ Choisis 1, 2 ou 3.'); return; }
  game.choices.push({ user: auteur_Message, choice }); game.step += 1;
  if (game.step >= adventures.length) { adventureGames.delete(jid); const ending = pick(['Victoire légendaire !', 'Fin secrète débloquée !', 'Le groupe devient une légende !']); await reply(repondre, `🏁 *FIN DE L’AVENTURE*\n\n${ending}\nDécisions du groupe : ${game.choices.map((item) => item.choice).join(' → ')}`); return; }
  const next = adventures[game.step]; await reply(repondre, `🧭 Choix enregistré par @${userName(auteur_Message)}.\n\n${next.text}\n\n1️⃣ ${next.choices[0]}\n2️⃣ ${next.choices[1]}\n3️⃣ ${next.choices[2]}`);
});

ovlcmd({ nom_cmd: 'rpg', alias: ['rpganime', 'roleplay'], classe: 'Fun', react: '🛡️', desc: 'Crée ou affiche le RPG anime du groupe.' }, async (jid, sock, { repondre, auteur_Message, arg }) => {
  if (!groupOnly(jid, repondre)) return;
  let game = rpgGames.get(jid);
  if (!game) { game = { players: new Map() }; rpgGames.set(jid, game); }
  const input = clean(textArg(arg));
  if (!game.players.has(auteur_Message) || input === 'creer') game.players.set(auteur_Message, { class: pick(classes), level: 1, xp: 0, hp: 100 });
  const player = game.players.get(auteur_Message);
  if (input === 'mission' || input === 'quete') { player.xp += 25; if (player.xp >= 100) { player.level += 1; player.xp -= 100; } await reply(repondre, `⚔️ Mission accomplie ! @${userName(auteur_Message)} gagne 25 XP. Niveau ${player.level}, XP ${player.xp}/100.`); return; }
  await reply(repondre, `🛡️ *RPG DU GROUPE*\n\n@${userName(auteur_Message)}\nClasse : ${player.class}\nNiveau : ${player.level}\nXP : ${player.xp}/100\nPV : ${player.hp}\n\nUtilise `.replace('`', '') + `.rpg mission pour gagner de l’XP.`);
});
ovlcmd({ nom_cmd: 'rpgstats', alias: ['statsrpg'], classe: 'Fun', react: '📜', desc: 'Affiche les héros du RPG.' }, async (jid, sock, { repondre }) => { const game = rpgGames.get(jid); if (!game || !game.players.size) { await reply(repondre, 'ℹ️ Le RPG n’a pas encore commencé.'); return; } const text = [...game.players.entries()].map(([user, player]) => `@${userName(user)} — ${player.class}, niv. ${player.level}, ${player.xp} XP`).join('\n'); await reply(repondre, `📜 *HÉROS DU GROUPE*\n\n${text}`); });

ovlcmd({ nom_cmd: 'meteoanime', alias: ['weatheranime'], classe: 'Fun', react: '🌤️', desc: 'Affiche la météo d’un monde anime.' }, async (jid, sock, { repondre, arg }) => { const place = textArg(arg) || pick(worlds); await reply(repondre, `🌤️ *Météo de ${place}*\n\n${pick(['Ciel dramatique et vent héroïque.', 'Pluie légère, parfaite pour un flashback.', 'Soleil intense : transformation imminente.', 'Orage de niveau boss final.'])}\nTempérature : ${Math.floor(12 + Math.random() * 25)}°C`); });
ovlcmd({ nom_cmd: 'horoscopeanime', alias: ['horoscope'], classe: 'Fun', react: '🔮', desc: 'Donne un horoscope anime.' }, async (jid, sock, { repondre, auteur_Message }) => { const character = pick(characters); await reply(repondre, `🔮 *Horoscope de @${userName(auteur_Message)}*\n\nTon énergie ressemble à celle de *${character.name}*.\nChance : ${Math.floor(50 + Math.random() * 51)}%\nConseil : ${pick(['fais confiance à ton équipe', 'évite les spoilers', 'prépare ton attaque spéciale', 'ne sous-estime jamais le rival'])}.`); });
ovlcmd({ nom_cmd: 'prediction', alias: ['predire'], classe: 'Fun', react: '🔮', desc: 'Fait une prédiction amusante.' }, async (jid, sock, { repondre, arg }) => { await reply(repondre, `🔮 *Prédiction*\n\n${textArg(arg) ? `À propos de « ${textArg(arg)} » : ` : ''}${pick(['un retournement de situation arrive bientôt.', 'le prochain message sera décisif.', 'un membre va devenir le héros du jour.', 'le groupe va découvrir un nouvel anime culte.'])}`); });
ovlcmd({ nom_cmd: 'rivalite', alias: ['rival'], classe: 'Fun', react: '🥊', desc: 'Compare deux membres du groupe.' }, async (jid, sock, { repondre, auteur_Message, arg }) => { const target = targetFrom(arg, null) || auteur_Message; const scoreA = 40 + Math.floor(Math.random() * 61); const scoreB = 40 + Math.floor(Math.random() * 61); await reply(repondre, `🥊 *RIVALITÉ*\n\n@${userName(auteur_Message)} : ${scoreA}/100\n@${userName(target)} : ${scoreB}/100\n\n🏆 ${scoreA >= scoreB ? `@${userName(auteur_Message)}` : `@${userName(target)}`} remporte le duel symbolique.`); });
ovlcmd({ nom_cmd: 'memeanime', alias: ['meme'], classe: 'Fun', react: '😂', desc: 'Génère un scénario de mème anime.' }, async (jid, sock, { repondre }) => { await reply(repondre, `😂 *MÈME DU JOUR*\n\nQuand tu dis « je regarde juste un épisode » et que le soleil se lève déjà.\n\nPersonnage principal : ${pick(characters).name}`); });
ovlcmd({ nom_cmd: 'bingoanime', alias: ['bingo'], classe: 'Fun', react: '🎯', desc: 'Génère une grille de bingo anime.' }, async (jid, sock, { repondre }) => { const cells = ['flashback triste', 'attaque nommée', 'rival arrogant', 'pouvoir caché', 'repas spectaculaire', 'promesse de héros', 'transformation', 'personnage mort', 'cri de guerre']; await reply(repondre, `🎯 *BINGO ANIME*\n\n${cells.slice(0, 3).join(' | ')}\n${cells.slice(3, 6).join(' | ')}\n${cells.slice(6, 9).join(' | ')}\n\nLe premier à repérer une ligne écrit *.bingo gagné*.`); });
ovlcmd({ nom_cmd: 'awards', alias: ['awardsgroupe', 'titres'], classe: 'Fun', react: '🏅', desc: 'Attribue des titres humoristiques au groupe.' }, async (jid, sock, { repondre }) => {
  if (!groupOnly(jid, repondre)) return;
  let people = [];
  try { const metadata = await sock.groupMetadata(jid); people = (metadata.participants || []).map((item) => item.id || item.jid).filter(Boolean); } catch (_) {}
  const selected = people.length ? people.slice(0, 6) : [];
  if (!selected.length) { await reply(repondre, 'ℹ️ Impossible de récupérer les membres du groupe pour les awards.'); return; }
  const text = `🏅 *AWARDS DU GROUPE*\n\n${selected.map((person, index) => `${pick(['🥇', '🥈', '🥉', '🏅', '🎖️', '⭐'], index)} @${userName(person)} — *${pick(titles, index)}*`).join('\n')}`;
  if (sock && typeof sock.sendMessage === 'function') await sock.sendMessage(jid, { text, mentions: selected });
  else await reply(repondre, text);
});
ovlcmd({ nom_cmd: 'journalgroupe', alias: ['journalanime'], classe: 'Fun', react: '📰', desc: 'Génère le journal humoristique du groupe.' }, async (jid, sock, { repondre }) => { await reply(repondre, `📰 *JOURNAL DU GROUPE*\n\n• Une nouvelle légende est née dans les quiz.\n• Le débat du jour n’a toujours pas trouvé de vainqueur.\n• La météo annonce un risque élevé de spoilers.\n• Prochaine édition : après le prochain événement historique.`); });
ovlcmd({ nom_cmd: 'eventanime', alias: ['event'], classe: 'Fun', react: '🎉', desc: 'Affiche un événement anime temporaire.' }, async (jid, sock, { repondre }) => { await reply(repondre, `🎉 *ÉVÉNEMENT DU GROUPE*\n\n${pick(['Semaine des rivalités : les duels rapportent double.', 'Festival des openings : chaque bonne réponse vaut un bonus.', 'Arc du héros : les défis du jour donnent des points fun.', 'Tournoi légendaire : choisissez votre champion avec `.tournoi`.'])}`); });
ovlcmd({ nom_cmd: 'scorefun', alias: ['pointsfun', 'topfun'], classe: 'Fun', react: '🏆', desc: 'Affiche les points des activités fun.' }, async (jid, sock, { repondre }) => { const score = funScores.get(jid) || 0; await reply(repondre, `🏆 Points fun de ce groupe : *${score}*\n\nLes points sont gagnés avec les devinettes et activités compatibles.`); });
ovlcmd({ nom_cmd: 'stopfun', alias: ['stopaventure', 'stoprpg'], classe: 'Fun', react: '🛑', desc: 'Arrête les activités créatives du groupe.' }, async (jid, sock, { repondre }) => { clueGames.delete(jid); tournamentGames.delete(jid); adventureGames.delete(jid); sessions.delete(`story:${jid}`); await reply(repondre, '🛑 Les activités créatives du groupe ont été arrêtées.'); });

ovlcmd({ nom_cmd: 'devineimage', alias: ['imagequiz', 'imageanime'], classe: 'Fun', react: '🖼️', desc: 'Lance une devinette visuelle anime.' }, async (jid, sock, { repondre }) => {
  if (!groupOnly(jid, repondre)) return;
  const character = pick(characters);
  const clues = ['Indice visuel : silhouette aux cheveux reconnaissables.', `Indice visuel : son anime est ${character.anime}.`, `Indice final : son pouvoir est ${character.power}.`];
  const game = { icon: '🖼️', title: 'Image mystère', clue: `${clues[0]}\n\nRéponds avec *.devine nom*.`, answer: character.name, hint: clues.slice(1).join(' '), attempts: 0 };
  clueGames.set(jid, game);
  const image = await getAnimeCharacterImage(character.name);
  const text = genericGuessText(game);
  if (!(await sendImage(sock, jid, image, text))) await reply(repondre, text);
});
ovlcmd({ nom_cmd: 'tierlist', alias: ['classementanime'], classe: 'Fun', react: '📊', desc: 'Lance une tier list anime.' }, async (jid, sock, { repondre }) => {
  if (!groupOnly(jid, repondre)) return;
  const list = [...characters].sort(() => Math.random() - 0.5).slice(0, 5);
  await reply(repondre, `📊 *TIER LIST ANIME*\n\n${list.map((item, index) => `${index + 1}. ${item.name} — ${item.anime}`).join('\\n')}\n\nVotez avec *.tier 1-5* pour choisir le meilleur. Le groupe peut ensuite débattre du classement.`);
});
ovlcmd({ nom_cmd: 'tier', alias: ['tier-vote'], classe: 'Fun', react: '📈', desc: 'Vote pour un personnage dans la tier list.' }, async (jid, sock, { repondre, arg }) => {
  const choice = parseInt(textArg(arg), 10);
  if (!Number.isInteger(choice) || choice < 1 || choice > 5) { await reply(repondre, '❌ Choisis un numéro entre 1 et 5.'); return; }
  await reply(repondre, `📈 Vote enregistré pour le personnage numéro ${choice}.`);
});
ovlcmd({ nom_cmd: 'concoursphoto', alias: ['photoconcours', 'photochallenge'], classe: 'Fun', react: '📸', desc: 'Lance un concours photo thématique.' }, async (jid, sock, { repondre, arg }) => {
  if (!groupOnly(jid, repondre)) return;
  const theme = textArg(arg) || pick(['ton personnage anime préféré', 'une image drôle', 'ton bureau de gamer', 'un cosplay', 'un paysage qui ressemble à un anime']);
  await reply(repondre, `📸 *CONCOURS PHOTO*\n\nThème : *${theme}*\nEnvoyez vos photos dans le groupe, puis votez avec des réactions. Fin des participations quand l’organisateur écrit *.concoursphoto fin*.`);
});
ovlcmd({ nom_cmd: 'blindtest', alias: ['blindtestanime', 'blind'], classe: 'Fun', react: '🎧', desc: 'Lance un blind test anime sous forme d’indices.' }, async (jid, sock, { repondre }) => {
  const item = pick(openings);
  await startClueGame(jid, repondre, { icon: '🎧', title: 'Blind test anime', clue: `🎵 Imagine un opening dont voici les indices : ${item.clue}`, answer: item.answer, hint: item.hint });
});

module.exports = { sessions, funScores, clueGames, tournamentGames, adventureGames, rpgGames };
