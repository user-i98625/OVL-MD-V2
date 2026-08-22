const { ovlcmd } = require('../lib/ovlcmd');
const animeQuestions = require('../lib/aquizz.json');
const extraQuiz = require('../lib/quiz_nouveaux.json');

const animePool = animeQuestions;
const activeGames = new Map();
const groupScores = new Map();

const hangmanWords = [
  'NARUTO', 'KONOHA', 'AKATSUKI', 'RASENGAN', 'SHARINGAN', 'HOKAGE',
  'LUFFY', 'ZORO', 'PIRATE', 'WANO', 'DEMONSLAYER', 'NICHIRIN',
  'HASHIRA', 'MUZAN', 'GOJO', 'SUKUNA', 'JUJUTSU', 'QUIRK', 'POKEMON',
  'PIKACHU', 'ALCHIMIE', 'BANKAI', 'DRAGONBALL', 'SAIYAN', 'TITAN'
];

const trueFalseQuiz = [
  { question: 'Naruto est devenu le Septième Hokage.', answer: 'vrai' },
  { question: 'Luffy est le capitaine de l’équipage du Chapeau de Paille.', answer: 'vrai' },
  { question: 'Pikachu est un Pokémon de type Feu.', answer: 'faux' },
  { question: 'Tanjiro utilise principalement la Respiration de l’Eau au début de son aventure.', answer: 'vrai' },
  { question: 'Light Yagami est le vrai nom de Kira dans Death Note.', answer: 'vrai' },
  { question: 'Goku est originaire de la planète Namek.', answer: 'faux' },
  { question: 'Mikasa appartient à la famille Ackerman.', answer: 'vrai' },
  { question: 'Gojo possède les Six Yeux.', answer: 'vrai' },
  { question: 'Edward Elric est le frère aîné d’Alphonse.', answer: 'vrai' },
  { question: 'Nami est l’archéologue de l’équipage de Luffy.', answer: 'faux' },
  { question: 'Deku est le surnom d’Izuku Midoriya.', answer: 'vrai' },
  { question: 'Ichigo est un Saiyan.', answer: 'faux' },
  { question: 'Nezuko est la sœur de Tanjiro.', answer: 'vrai' },
  { question: 'Saitama est le héros principal de One Punch Man.', answer: 'vrai' },
  { question: 'Le Death Note appartient à un Shinigami nommé Ryuk.', answer: 'vrai' },
  { question: 'Vegeta est le frère de Gohan.', answer: 'faux' },
  { question: 'Asta utilise la magie du vent.', answer: 'faux' },
  { question: 'Killua vient de la famille Zoldyck.', answer: 'vrai' },
  { question: 'Anya peut lire les pensées.', answer: 'vrai' },
  { question: 'Le Titan Colossal est plus petit que le Titan Mâchoire.', answer: 'faux' }
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

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function senderName(jid) {
  return String(jid || 'joueur').split('@')[0];
}

function addPoint(groupId, playerId) {
  if (!groupScores.has(groupId)) groupScores.set(groupId, new Map());
  const scores = groupScores.get(groupId);
  scores.set(playerId, (scores.get(playerId) || 0) + 1);
  return scores.get(playerId);
}

function scoreboard(groupId) {
  const scores = groupScores.get(groupId);
  if (!scores || !scores.size) return 'Aucun point pour le moment.';
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([player, score], index) => `${index + 1}. @${senderName(player)} — ${score} point${score > 1 ? 's' : ''}`)
    .join('\n');
}

function formatMultipleChoice(item) {
  return `❓ *${item.question}*\n\n` +
    `🅰️ ${item.options.a}\n` +
    `🅱️ ${item.options.b}\n` +
    `©️ ${item.options.c}\n` +
    `🆎 ${item.options.d}\n\n` +
    'Réponds avec `.quiz... a`, `.quiz... b`, `.quiz... c` ou `.quiz... d`.';
}

async function reply(repondre, message) {
  await repondre(message);
}

function clearLater(groupId, timeout = 5 * 60 * 1000) {
  const game = activeGames.get(groupId);
  if (game && game.timer) clearTimeout(game.timer);
  if (game) {
    game.timer = setTimeout(() => {
      if (activeGames.get(groupId) === game) endGame(groupId);
    }, timeout);
  }
}

function endGame(groupId) {
  const game = activeGames.get(groupId);
  if (game && game.timer) clearTimeout(game.timer);
  activeGames.delete(groupId);
}

function startChoiceQuiz(groupId, mode, bank, commandName) {
  const item = randomItem(bank);
  const game = {
    type: 'choice-quiz',
    mode,
    commandName,
    answer: clean(item.answer),
    item,
    startedAt: Date.now()
  };
  activeGames.set(groupId, game);
  clearLater(groupId, 10 * 60 * 1000);
  return game;
}

function startTrueFalse(groupId) {
  const item = randomItem(trueFalseQuiz);
  const game = {
    type: 'true-false',
    answer: clean(item.answer),
    item,
    startedAt: Date.now()
  };
  activeGames.set(groupId, game);
  clearLater(groupId, 10 * 60 * 1000);
  return game;
}

function showHangman(game) {
  const masked = [...game.word]
    .map((letter) => game.guessed.has(letter) ? letter : '＿')
    .join(' ');
  return `🎯 *Pendu de groupe*\n\nMot : ${masked}\nLettres essayées : ${[...game.guessed].join(', ') || 'aucune'}\nErreurs : ${game.errors}/${game.maxErrors}\n\nUtilise ".pendu lettre" ou ".pendu mot complet".`;
}

function startHangman(groupId) {
  const game = {
    type: 'hangman',
    word: randomItem(hangmanWords),
    guessed: new Set(),
    errors: 0,
    maxErrors: 7,
    startedAt: Date.now()
  };
  activeGames.set(groupId, game);
  clearLater(groupId, 10 * 60 * 1000);
  return game;
}

function scramble(word) {
  const letters = word.split('');
  for (let i = letters.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  const result = letters.join('');
  return result === word && word.length > 2 ? scramble(word) : result;
}

function startAnagram(groupId) {
  const source = randomItem(hangmanWords.filter((word) => word.length >= 5));
  const game = {
    type: 'anagram',
    word: source,
    scrambled: scramble(source),
    startedAt: Date.now()
  };
  activeGames.set(groupId, game);
  clearLater(groupId, 7 * 60 * 1000);
  return game;
}

function requireGroup(jid, repondre) {
  if (isGroup(jid)) return true;
  reply(repondre, '❌ Ce jeu est réservé aux groupes WhatsApp.');
  return false;
}

ovlcmd({
  nom_cmd: 'jeux',
  alias: ['games', 'multijeux'],
  classe: 'Jeux',
  react: '🎮',
  desc: 'Affiche les jeux et quiz de groupe disponibles.'
}, async (jid, sock, { repondre }) => {
  await reply(repondre,
    '🎮 *Jeux de groupe disponibles*\n\n' +
    '• `.pendu` — pendu collaboratif\n' +
    '• `.anagramme` — mot mélangé à deviner\n' +
    '• `.quizanimeplus` — quiz anime enrichi\n' +
    '• `.quizculture` — culture générale\n' +
    '• `.quizfoot` — quiz football\n' +
    '• `.quizgaming` — quiz jeux vidéo\n' +
    '• `.vraioufaux` — vrai ou faux anime\n' +
    '• `.scorejeux` — classement du groupe\n' +
    '• `.stopjeu` — arrêter la partie en cours\n\n' +
    'Pour répondre à une question, relance la même commande avec ta réponse.');
});

for (const [commandName, mode, bank] of [
  ['quizanimeplus', 'anime', animePool],
  ['quizculture', 'culture', extraQuiz.culture],
  ['quizfoot', 'football', extraQuiz.football],
  ['quizgaming', 'gaming', extraQuiz.gaming]
]) {
  ovlcmd({
    nom_cmd: commandName,
    classe: 'Jeux',
    react: '🧠',
    desc: `Lance un quiz ${mode} jouable à plusieurs dans un groupe.`
  }, async (jid, sock, { repondre, auteur_Message, arg }) => {
    if (!requireGroup(jid, repondre)) return;
    const answer = clean(textArg(arg));
    const current = activeGames.get(jid);
    if (!answer || !current || current.type !== 'choice-quiz' || current.mode !== mode) {
      if (current && current.type !== 'choice-quiz') {
        await reply(repondre, '⚠️ Une autre partie est déjà en cours. Utilise `.stopjeu` ou termine-la d’abord.');
        return;
      }
      const game = startChoiceQuiz(jid, mode, bank, commandName);
      await reply(repondre, `🎲 *Quiz ${mode}*\n\n${formatMultipleChoice(game.item)}`);
      return;
    }
    if (answer === current.answer) {
      const points = addPoint(jid, auteur_Message);
      endGame(jid);
      await reply(repondre, `✅ Bonne réponse, @${senderName(auteur_Message)} ! Tu gagnes 1 point et tu totalises ${points}.\n\nRelance ".${commandName}" pour la prochaine question.`);
    } else {
      await reply(repondre, '❌ Mauvaise réponse. La partie continue : essaie encore avec a, b, c ou d.');
    }
  });
}

ovlcmd({
  nom_cmd: 'vraioufaux',
  alias: ['vof', 'quizvf'],
  classe: 'Jeux',
  react: '⚖️',
  desc: 'Lance un quiz vrai ou faux anime dans un groupe.'
}, async (jid, sock, { repondre, auteur_Message, arg }) => {
  if (!requireGroup(jid, repondre)) return;
  const answer = clean(textArg(arg));
  const current = activeGames.get(jid);
  if (!answer || !current || current.type !== 'true-false') {
    if (current && current.type !== 'true-false') {
      await reply(repondre, '⚠️ Une autre partie est déjà en cours. Utilise `.stopjeu` ou termine-la d’abord.');
      return;
    }
    const game = startTrueFalse(jid);
    await reply(repondre, `⚖️ *Vrai ou faux*\n\n${game.item.question}\n\nRéponds avec ".vraioufaux vrai" ou ".vraioufaux faux".`);
    return;
  }
  if (answer === current.answer) {
    const points = addPoint(jid, auteur_Message);
    endGame(jid);
    await reply(repondre, `✅ Exact, @${senderName(auteur_Message)} ! +1 point, total : ${points}.\n\nRelance ".vraioufaux" pour continuer.`);
  } else {
    await reply(repondre, '❌ Raté. La partie continue : réponds encore vrai ou faux.');
  }
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
    game = startHangman(jid);
    await reply(repondre, `${showHangman(game)}\n\n🎉 @${senderName(auteur_Message)} lance la partie !`);
    return;
  }
  if (guess.length === 1) {
    if (game.guessed.has(guess.toUpperCase())) {
      await reply(repondre, 'Cette lettre a déjà été essayée.');
      return;
    }
    const letter = guess.toUpperCase();
    game.guessed.add(letter);
    if (!game.word.includes(letter)) game.errors += 1;
  } else if (guess.toUpperCase() === game.word) {
    const points = addPoint(jid, auteur_Message);
    endGame(jid);
    await reply(repondre, `🏆 @${senderName(auteur_Message)} a trouvé le mot *${game.word}* ! +1 point, total : ${points}.`);
    return;
  } else {
    game.errors += 1;
  }
  const won = [...game.word].every((letter) => game.guessed.has(letter));
  if (won) {
    const points = addPoint(jid, auteur_Message);
    endGame(jid);
    await reply(repondre, `🏆 Le groupe a trouvé *${game.word}* ! @${senderName(auteur_Message)} reçoit 1 point, total : ${points}.`);
  } else if (game.errors >= game.maxErrors) {
    endGame(jid);
    await reply(repondre, `💥 Partie terminée ! Le mot était *${game.word}*.`);
  } else {
    await reply(repondre, showHangman(game));
  }
});

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
    game = startAnagram(jid);
    await reply(repondre, `🔀 *Anagramme*\n\nLettres mélangées : *${game.scrambled}*\n\nRéponds avec ".anagramme mot". Bonne chance !`);
    return;
  }
  if (guess === clean(game.word)) {
    const points = addPoint(jid, auteur_Message);
    endGame(jid);
    await reply(repondre, `✅ Bravo @${senderName(auteur_Message)} ! Le mot était *${game.word}*. +1 point, total : ${points}.`);
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
  await reply(repondre, `🏆 *Classement du groupe*\n\n${scoreboard(jid)}`);
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
