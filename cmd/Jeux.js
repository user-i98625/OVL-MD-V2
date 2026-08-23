const { ovlcmd } = require('../lib/ovlcmd');
const animeQuestions = require('../lib/aquizz.json');
const extraQuiz = require('../lib/quiz_nouveaux.json');
const thematicQuiz = require('../lib/thematic_quiz');
let Sudo;
try {
  ({ Sudo } = require('../DataBase/sudo'));
} catch (_) {
  Sudo = null;
}

const QUIZ_LENGTHS = { '1': 10, '2': 20, '3': 30 };
const ANSWERS = ['1', '2', '3', '4'];
const ANSWER_KEYS = ['a', 'b', 'c', 'd'];
const activeGames = new Map();
const groupScores = new Map();

const quizDefinitions = {
  anime: { label: 'Anime', bank: animeQuestions },
  gaming: { label: 'Gaming', bank: extraQuiz.gaming },
  culture: { label: 'Culture générale', bank: extraQuiz.culture },
  football: { label: 'Football', bank: extraQuiz.football }
};

const hangmanWords = [
  'NARUTO', 'KONOHA', 'AKATSUKI', 'RASENGAN', 'SHARINGAN', 'HOKAGE',
  'LUFFY', 'ZORO', 'PIRATE', 'WANO', 'DEMONSLAYER', 'NICHIRIN',
  'HASHIRA', 'MUZAN', 'GOJO', 'SUKUNA', 'JUJUTSU', 'QUIRK', 'POKEMON',
  'PIKACHU', 'ALCHIMIE', 'BANKAI', 'DRAGONBALL', 'SAIYAN', 'TITAN'
];

function clean(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function textArg(arg) {
  if (Array.isArray(arg)) return arg.join(' ').trim();
  return String(arg || '').trim();
}

function isGroup(jid) {
  return typeof jid === 'string' && jid.endsWith('@g.us');
}

function senderName(jid) {
  return String(jid || 'joueur').split('@')[0];
}

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function reply(repondre, message) {
  return typeof repondre === 'function' ? repondre(message) : Promise.resolve();
}

function send(sock, jid, text, mentions = []) {
  return sock.sendMessage(jid, { text, mentions });
}

function clearGameTimers(game) {
  if (!game) return;
  if (game.timeout) clearTimeout(game.timeout);
  if (game.countdown) clearInterval(game.countdown);
  game.timeout = null;
  game.countdown = null;
}

function endGame(groupId) {
  const game = activeGames.get(groupId);
  clearGameTimers(game);
  activeGames.delete(groupId);
}

function addScore(game, playerId) {
  if (!playerId) return 0;
  const score = (game.scores.get(playerId) || 0) + 1;
  game.scores.set(playerId, score);
  if (!groupScores.has(game.groupId)) groupScores.set(game.groupId, new Map());
  const groupScore = groupScores.get(game.groupId);
  groupScore.set(playerId, (groupScore.get(playerId) || 0) + 1);
  return score;
}

function quizAnswer(item) {
  const key = clean(item.answer);
  const index = ANSWER_KEYS.indexOf(key);
  return index >= 0 ? String(index + 1) : null;
}

function quizAnswerText(item) {
  const answer = quizAnswer(item);
  return answer ? `${answer}. ${item.options[ANSWER_KEYS[Number(answer) - 1]]}` : 'indisponible';
}

function formatQuizQuestion(game) {
  const item = game.questions[game.index];
  return `🧠 *QUIZZ ${game.label.toUpperCase()}*\n` +
    `Question ${game.index + 1}/${game.total}\n\n` +
    `❓ ${item.question}\n\n` +
    `1️⃣ ${item.options.a}\n` +
    `2️⃣ ${item.options.b}\n` +
    `3️⃣ ${item.options.c}\n` +
    `4️⃣ ${item.options.d}\n\n` +
    'Réponds uniquement avec *1*, *2*, *3* ou *4*. ⏱️ *10 secondes*';
}

function formatFinalScores(game) {
  const rows = [...game.scores.entries()].sort((left, right) => right[1] - left[1]);
  if (!rows.length) {
    return { text: `🏁 *FIN DU QUIZZ ${game.label.toUpperCase()}*\n\nAucun point marqué.`, mentions: [] };
  }
  const mentions = rows.filter(([, score]) => score > 0).map(([player]) => player);
  const ranking = rows.map(([player, score], index) => {
    const medal = ['🥇', '🥈', '🥉'][index] || `${index + 1}.`;
    return `${medal} @${senderName(player)} — ${score} point${score > 1 ? 's' : ''}`;
  }).join('\n');
  return {
    text: `🏁 *FIN DU QUIZZ ${game.label.toUpperCase()}*\n\n📊 *Classement final*\n${ranking}\n\n👏 Bravo à tous les participants !`,
    mentions
  };
}

function extractText(received) {
  if (!received) return '';
  if (typeof received === 'string') return received.trim();
  return String(
    received?.message?.conversation ||
    received?.message?.extendedTextMessage?.text ||
    received?.msg?.conversation ||
    received?.msg?.extendedTextMessage?.text ||
    received?.text ||
    ''
  ).trim();
}

function extractSender(received) {
  if (!received || typeof received === 'string') return null;
  return received?.key?.participant ||
    received?.key?.remoteJid ||
    received?.participant ||
    received?.sender ||
    null;
}

async function resolveSender(received, groupId, sock, getJid) {
  const rawSender = extractSender(received);
  if (!rawSender) return null;
  if (typeof getJid === 'function') {
    try {
      const resolved = await getJid(rawSender, groupId, sock);
      if (resolved) return resolved;
    } catch (_) {
      // Le JID brut reste utilisable si la résolution échoue.
    }
  }
  return rawSender;
}

function isStopCommand(value) {
  return ['stop', '.stop', 'annuler', 'cancel'].includes(clean(value));
}

async function isGroupAdmin(sock, groupId, userId) {
  if (!sock || typeof sock.groupMetadata !== 'function' || !userId) return false;
  try {
    const metadata = await sock.groupMetadata(groupId);
    const userNumber = senderName(userId);
    return (metadata.participants || []).some((participant) => {
      const participantId = participant.id || participant.jid || participant.phoneNumber;
      return participantId && senderName(participantId) === userNumber && ['admin', 'superadmin'].includes(participant.admin);
    });
  } catch (_) {
    return false;
  }
}

async function isSudoUser(userId) {
  if (!userId) return false;
  const candidates = [userId, senderName(userId)];
  if (Sudo && typeof Sudo.findByPk === 'function') {
    for (const candidate of candidates) {
      try {
        if (await Sudo.findByPk(candidate)) return true;
      } catch (_) {
        // La base peut ne pas être initialisée au moment du premier message.
      }
    }
  }
  const configured = String(process.env.SUDO || process.env.SUDOS || process.env.NUMERO_OWNER || '').split(',').map((item) => item.trim()).filter(Boolean);
  return configured.some((item) => senderName(item) === senderName(userId));
}

async function canStopGame(sock, groupId, userId) {
  return await isSudoUser(userId) || await isGroupAdmin(sock, groupId, userId);
}

function sameUser(first, second) {
  if (!first || !second) return false;
  if (first === second) return true;
  return String(first).split('@')[0] === String(second).split('@')[0];
}

async function receiveMessage(sock, groupId, timeout) {
  if (typeof sock.recup_msg !== 'function') return null;
  try {
    return await sock.recup_msg({ ms_org: groupId, temps: timeout });
  } catch (_) {
    return null;
  }
}

async function finishQuiz(groupId, sock, game) {
  if (activeGames.get(groupId) !== game) return;
  const result = formatFinalScores(game);
  endGame(groupId);
  await send(sock, groupId, result.text, result.mentions);
}

async function runQuiz(groupId, sock, game, getJid) {
  for (game.index = 0; game.index < game.total; game.index += 1) {
    if (activeGames.get(groupId) !== game) return;
    await send(sock, groupId, formatQuizQuestion(game));
    const startedAt = Date.now();
    game.countdown = setInterval(() => {
      const remaining = Math.ceil((10000 - (Date.now() - startedAt)) / 1000);
      if ([5, 3, 1].includes(remaining)) send(sock, groupId, `⏳ ${remaining}s restantes`);
    }, 1000);
    let answered = false;

    while (Date.now() - startedAt < 10000 && activeGames.get(groupId) === game) {
      const remaining = Math.max(250, 10000 - (Date.now() - startedAt));
      const received = await receiveMessage(sock, groupId, remaining);
      if (!received) break;
      const answer = clean(extractText(received));
      const player = await resolveSender(received, groupId, sock, getJid);
      if (!player) continue;
      if (isStopCommand(answer) && (sameUser(player, game.starter) || await canStopGame(sock, groupId, player))) {
        endGame(groupId);
        await send(sock, groupId, `🛑 Quizz annulé par @${senderName(player)}.`, [player]);
        return;
      }
      if (!ANSWERS.includes(answer)) continue;
      if (answer !== quizAnswer(game.questions[game.index])) continue;

      const score = addScore(game, player);
      answered = true;
      await send(sock, groupId, `✅ Bonne réponse, c’est bien @${senderName(player)} ! +1 point (total : ${score}).`, [player]);
      break;
    }

    if (activeGames.get(groupId) !== game) return;
    if (game.countdown) clearInterval(game.countdown);
    game.countdown = null;
    if (!answered) {
      await send(sock, groupId, `⏰ Temps écoulé ! La bonne réponse était *${quizAnswerText(game.questions[game.index])}*.`);
    }
    if (game.index < game.total - 1) {
      await send(sock, groupId, '➡️ Prochaine question dans 2 secondes.');
      await sleep(2000);
    }
  }
  await finishQuiz(groupId, sock, game);
}

function setupPrompt(label) {
  return `🎯 *QUIZZ ${label.toUpperCase()}*\n\nChoisis le nombre de questions :\n1️⃣ 10 questions\n2️⃣ 20 questions\n3️⃣ 30 questions\n\nRéponds avec *1*, *2* ou *3*. Seule la personne qui a lancé le quizz peut choisir.`;
}

async function startQuiz(groupId, sock, definition, total, starter, getJid) {
  const questions = shuffle(definition.bank).slice(0, Math.min(total, definition.bank.length));
  const game = {
    type: 'quiz',
    groupId,
    mode: definition.mode,
    label: definition.label,
    questions,
    total: questions.length,
    index: 0,
    starter,
    scores: new Map(),
    timeout: null
  };
  activeGames.set(groupId, game);
  await send(sock, groupId, `✅ *QUIZZ ${definition.label.toUpperCase()} LANCÉ !*\n${game.total} questions. Tout le groupe peut répondre.\nUne seule bonne réponse par question rapporte 1 point.`);
  await runQuiz(groupId, sock, game, getJid);
}

async function chooseQuizLength(groupId, sock, setup, definition, getJid) {
  const startedAt = Date.now();
  while (activeGames.get(groupId) === setup && Date.now() - startedAt < 60000) {
    const received = await receiveMessage(sock, groupId, Math.max(250, 60000 - (Date.now() - startedAt)));
    if (!received) break;
    const player = await resolveSender(received, groupId, sock, getJid);
    if (!player) continue;
    const answer = clean(extractText(received));
    if (isStopCommand(answer)) {
      if (sameUser(player, setup.starter) || await canStopGame(sock, groupId, player)) {
        endGame(groupId);
        await send(sock, groupId, `🛑 Quizz annulé par @${senderName(player)}.`, [player]);
        return;
      }
      continue;
    }
    if (!sameUser(player, setup.starter)) continue;
    const selection = QUIZ_LENGTHS[answer];
    if (!selection) {
      await send(sock, groupId, '❌ Choix invalide. Le quizz est annulé. Réponds avec 1, 2 ou 3 la prochaine fois.');
      endGame(groupId);
      return;
    }
    await startQuiz(groupId, sock, { ...definition, mode: setup.mode }, selection, setup.starter, getJid);
    return;
  }
  if (activeGames.get(groupId) === setup) {
    endGame(groupId);
    await send(sock, groupId, '⌛ Choix non reçu. Le quizz est annulé.');
  }
}

async function handleQuizCommand({ jid, sock, repondre, auteur_Message, getJid }, definition) {
  if (!isGroup(jid)) {
    await reply(repondre, '❌ Les quizz sont disponibles uniquement dans les groupes.');
    return;
  }
  if (typeof sock.recup_msg !== 'function') {
    await reply(repondre, '❌ Le module de récupération des messages est indisponible sur ce déploiement.');
    return;
  }
  const current = activeGames.get(jid);
  if (current) {
    await reply(repondre, '⚠️ Un autre jeu ou quizz est déjà en cours dans ce groupe.');
    return;
  }
  const setup = {
    type: 'quiz-setup',
    groupId: jid,
    mode: definition.mode,
    label: definition.label,
    starter: auteur_Message
  };
  activeGames.set(jid, setup);
  await reply(repondre, setupPrompt(definition.label));
  await chooseQuizLength(jid, sock, setup, definition, getJid);
}

function requireGroup(jid, repondre) {
  if (isGroup(jid)) return true;
  reply(repondre, '❌ Cette commande est réservée aux groupes WhatsApp.');
  return false;
}

for (const [commandName, mode, label, bank, aliases] of [
  ['quizz-anime', 'anime', 'Anime', quizDefinitions.anime.bank, ['quizanimeplus', 'quizanime']],
  ['quizz-gaming', 'gaming', 'Gaming', quizDefinitions.gaming.bank, ['quizgaming', 'gamingquiz']],
  ['quizz-cultire-g', 'culture', 'Culture générale', quizDefinitions.culture.bank, ['quizz-culture-g', 'quizculture', 'quizz-culture', 'culturequiz']],
  ['quizz-foot', 'football', 'Football', quizDefinitions.football.bank, ['quizfoot', 'quizz-football', 'footballquiz']]
]) {
  ovlcmd({
    nom_cmd: commandName,
    alias: aliases,
    classe: 'Jeux',
    react: '🧠',
    desc: `Lance le quizz ${label} avec 10, 20 ou 30 questions.`
  }, async (jid, sock, context) => {
    await handleQuizCommand({ jid, sock, ...context }, { mode, label, bank });
  });
}

ovlcmd({
  nom_cmd: 'jeux',
  alias: ['games', 'multijeux'],
  classe: 'Jeux',
  react: '🎮',
  desc: 'Affiche les jeux et quizz de groupe disponibles.'
}, async (jid, sock, { repondre }) => {
  await reply(repondre,
    '🎮 *Jeux et quizz de groupe*\n\n' +
    '• `.quizz-anime` — 10, 20 ou 30 questions anime\n' +
    '• `.quizz-gaming` — quiz jeux vidéo\n' +
    '• `.quizz-cultire-g` — culture générale\n' +
    '• `.quizz-foot` — quiz football\n' +
    '• `.quizz <animé>` — génère ou réutilise un quiz thématique\n' +
    '• `.quizz-refresh <animé>` — régénère la banque thématique\n' +
    '• `.akinator` — deviner un personnage avec Akinator\n' +
    '• `.pendu` — pendu collaboratif\n' +
    '• `.anagramme` — mot mélangé à deviner\n' +
    '• `.scorejeux` — scores du groupe\n' +
    '• `.stopjeu` — arrêter la partie active\n' +
    '• `.stopakinator` — arrêter Akinator\n\n' +
    'Après le lancement, le créateur choisit 1, 2 ou 3. Ensuite, tout le groupe répond avec 1, 2, 3 ou 4.');
});

async function handleThematicQuizCommand({ jid, sock, repondre, auteur_Message, getJid, arg }, forceRefresh = false) {
  if (!isGroup(jid)) {
    await reply(repondre, '❌ Les quizz sont disponibles uniquement dans les groupes.');
    return;
  }
  const topic = thematicQuiz.normalizeTopic(textArg(arg));
  if (!topic) {
    await reply(repondre, '❌ Indique un animé. Exemple : `.quizz yu gi oh`.');
    return;
  }
  if (activeGames.has(jid)) {
    await reply(repondre, '⚠️ Un autre jeu ou quizz est déjà en cours dans ce groupe.');
    return;
  }
  const setup = {
    type: 'quiz-setup',
    groupId: jid,
    mode: 'thematic',
    label: topic,
    starter: auteur_Message
  };
  activeGames.set(jid, setup);
  try {
    if (forceRefresh) thematicQuiz.clearQuizCache(topic);
    await reply(repondre, `🔎 Je ${forceRefresh ? 'régénère' : 'cherche'} la banque de questions pour *${topic}*…`);
    const result = await thematicQuiz.loadOrGenerateQuiz(topic);
    setup.label = result.topic;
    setup.bank = result.questions;
    await reply(repondre, result.cached
      ? `✅ Banque trouvée pour *${result.topic}*. Je la réutilise.\n\n${setupPrompt(result.topic)}`
      : `✨ Banque créée pour *${result.topic}* et sauvegardée.\n\n${setupPrompt(result.topic)}`);
    await chooseQuizLength(jid, sock, setup, { mode: 'thematic', label: result.topic, bank: result.questions }, getJid);
  } catch (error) {
    endGame(jid);
    console.error('[Quiz thématique]', error);
    await reply(repondre, `❌ Impossible de préparer le quiz sur *${topic}* pour le moment. ${error.message.includes('OPENAI_API_KEY') ? 'Ajoute OPENAI_API_KEY dans les variables Render.' : 'Réessaie plus tard.'}`);
  }
}

ovlcmd({
  nom_cmd: 'quizz',
  alias: ['quiz', 'quizzanimeperso', 'quizz-theme'],
  classe: 'Jeux',
  react: '🧠',
  desc: 'Génère ou réutilise un quiz de 30 questions sur un animé.'
}, async (jid, sock, context) => {
  await handleThematicQuizCommand({ jid, sock, ...context });
});

ovlcmd({
  nom_cmd: 'quizz-refresh',
  alias: ['quiz-refresh', 'refreshquizz'],
  classe: 'Jeux',
  react: '🔄',
  desc: 'Régénère la banque de questions d’un animé.'
}, async (jid, sock, context) => {
  await handleThematicQuizCommand({ jid, sock, ...context }, true);
});

ovlcmd({
  nom_cmd: 'pendu',
  alias: ['hangman'],
  classe: 'Jeux',
  react: '🔤',
  desc: 'Joue au pendu à plusieurs dans un groupe.'
}, async (jid, sock, { repondre, auteur_Message, arg }) => {
  if (!requireGroup(jid, repondre)) return;
  const guess = clean(textArg(arg)).replace(/[^a-z]/g, '');
  let game = activeGames.get(jid);
  if (!guess || !game || game.type !== 'hangman') {
    if (game && game.type !== 'hangman') {
      await reply(repondre, '⚠️ Une autre partie est déjà en cours. Utilise `.stopjeu` ou termine-la d’abord.');
      return;
    }
    game = {
      type: 'hangman', groupId: jid, word: randomItem(hangmanWords), guessed: new Set(), errors: 0, maxErrors: 7,
      timeout: setTimeout(() => endGame(jid), 10 * 60 * 1000), scores: groupScores.get(jid) || new Map()
    };
    activeGames.set(jid, game);
    await reply(repondre, `🎯 *Pendu de groupe*\n\nMot : ${[...game.word].map(() => '＿').join(' ')}\n\nUtilise ".pendu lettre" ou ".pendu mot complet".`);
    return;
  }
  if (guess.length === 1) {
    const letter = guess.toUpperCase();
    if (game.guessed.has(letter)) {
      await reply(repondre, 'Cette lettre a déjà été essayée.');
      return;
    }
    game.guessed.add(letter);
    if (!game.word.includes(letter)) game.errors += 1;
  } else if (guess.toUpperCase() === game.word) {
    const score = addScore(game, auteur_Message);
    endGame(jid);
    await reply(repondre, `🏆 @${senderName(auteur_Message)} a trouvé *${game.word}* ! +1 point (total : ${score}).`);
    return;
  } else {
    game.errors += 1;
  }
  const masked = [...game.word].map((letter) => game.guessed.has(letter) ? letter : '＿').join(' ');
  const won = [...game.word].every((letter) => game.guessed.has(letter));
  if (won) {
    const score = addScore(game, auteur_Message);
    endGame(jid);
    await reply(repondre, `🏆 Le groupe a trouvé *${game.word}* ! @${senderName(auteur_Message)} reçoit 1 point (total : ${score}).`);
  } else if (game.errors >= game.maxErrors) {
    endGame(jid);
    await reply(repondre, `💥 Partie terminée ! Le mot était *${game.word}*.`);
  } else {
    await reply(repondre, `🎯 Mot : ${masked}\nLettres essayées : ${[...game.guessed].join(', ') || 'aucune'}\nErreurs : ${game.errors}/${game.maxErrors}`);
  }
});

function scramble(word) {
  const letters = word.split('');
  for (let index = letters.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [letters[index], letters[randomIndex]] = [letters[randomIndex], letters[index]];
  }
  const result = letters.join('');
  return result === word && word.length > 2 ? scramble(word) : result;
}

ovlcmd({
  nom_cmd: 'anagramme',
  alias: ['motmelange', 'scramble'],
  classe: 'Jeux',
  react: '🔀',
  desc: 'Devine un mot mélangé avec les membres du groupe.'
}, async (jid, sock, { repondre, auteur_Message, arg }) => {
  if (!requireGroup(jid, repondre)) return;
  const guess = clean(textArg(arg)).replace(/[^a-z]/g, '');
  let game = activeGames.get(jid);
  if (!guess || !game || game.type !== 'anagram') {
    if (game && game.type !== 'anagram') {
      await reply(repondre, '⚠️ Une autre partie est déjà en cours. Utilise `.stopjeu` ou termine-la d’abord.');
      return;
    }
    game = {
      type: 'anagram', groupId: jid, word: randomItem(hangmanWords.filter((word) => word.length >= 5)), timeout: null,
      scores: groupScores.get(jid) || new Map()
    };
    game.scrambled = scramble(game.word);
    game.timeout = setTimeout(() => endGame(jid), 7 * 60 * 1000);
    activeGames.set(jid, game);
    await reply(repondre, `🔀 *Anagramme*\n\nLettres mélangées : *${game.scrambled}*\n\nRéponds avec ".anagramme mot".`);
    return;
  }
  if (guess === clean(game.word)) {
    const score = addScore(game, auteur_Message);
    endGame(jid);
    await reply(repondre, `✅ Bravo @${senderName(auteur_Message)} ! Le mot était *${game.word}*. +1 point (total : ${score}).`);
  } else {
    await reply(repondre, '❌ Ce n’est pas le bon mot. Les autres joueurs peuvent encore essayer.');
  }
});

ovlcmd({
  nom_cmd: 'scorejeux',
  alias: ['scores', 'classementjeux'],
  classe: 'Jeux',
  react: '🏆',
  desc: 'Affiche le classement des jeux du groupe.'
}, async (jid, sock, { repondre }) => {
  if (!requireGroup(jid, repondre)) return;
  const scores = groupScores.get(jid);
  if (!scores || !scores.size) {
    await reply(repondre, '🏆 Aucun point pour le moment.');
    return;
  }
  const ranking = [...scores.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([player, score], index) => `${index + 1}. @${senderName(player)} — ${score} point${score > 1 ? 's' : ''}`)
    .join('\n');
  await send(sock, jid, `🏆 *Classement des jeux*\n\n${ranking}`, [...scores.keys()]);
});

ovlcmd({
  nom_cmd: 'stopjeu',
  alias: ['stopgame', 'finjeu'],
  classe: 'Jeux',
  react: '🛑',
  desc: 'Arrête la partie active dans le groupe.'
}, async (jid, sock, { repondre }) => {
  if (!requireGroup(jid, repondre)) return;
  if (!activeGames.has(jid)) {
    await reply(repondre, 'ℹ️ Aucune partie active dans ce groupe.');
    return;
  }
  endGame(jid);
  await reply(repondre, '🛑 La partie a été arrêtée.');
});

module.exports = { activeGames, groupScores };
