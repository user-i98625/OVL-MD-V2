const { AkinatorClient, Languages, Themes, Answers } = require('akinator-client');
const { ovlcmd } = require('../lib/ovlcmd');

let Sudo;
try {
  ({ Sudo } = require('../DataBase/sudo'));
} catch (_) {
  Sudo = null;
}

const sessions = new Map();
const RESPONSE_MAP = {
  '1': Answers.Yes,
  '2': Answers.No,
  '3': Answers.IDontKnow,
  '4': Answers.Probably,
  '5': Answers.ProbablyNot
};
const RESPONSE_HELP = 'Réponds avec 1️⃣ Oui, 2️⃣ Non, 3️⃣ Je ne sais pas, 4️⃣ Probablement oui ou 5️⃣ Probablement non.';

function clean(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isGroup(jid) {
  return typeof jid === 'string' && jid.endsWith('@g.us');
}

function senderName(jid) {
  return String(jid || 'joueur').split('@')[0];
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
  return received?.key?.participant || received?.key?.remoteJid || received?.participant || received?.sender || null;
}

async function resolveSender(received, groupId, sock, getJid) {
  const rawSender = extractSender(received);
  if (!rawSender) return null;
  if (typeof getJid === 'function') {
    try {
      const resolved = await getJid(rawSender, groupId, sock);
      if (resolved) return resolved;
    } catch (_) {
      // Utilise le JID brut si la résolution n’est pas disponible.
    }
  }
  return rawSender;
}

function sameUser(first, second) {
  if (!first || !second) return false;
  return String(first).split('@')[0] === String(second).split('@')[0];
}

function isStopCommand(value) {
  return ['stop', '.stop', 'stopakinator', '.stopakinator', 'annuler', 'cancel'].includes(clean(value));
}

async function isGroupAdmin(sock, groupId, userId) {
  if (!sock || typeof sock.groupMetadata !== 'function' || !userId) return false;
  try {
    const metadata = await sock.groupMetadata(groupId);
    const number = senderName(userId);
    return (metadata.participants || []).some((participant) => {
      const participantId = participant.id || participant.jid || participant.phoneNumber;
      return participantId && senderName(participantId) === number && ['admin', 'superadmin'].includes(participant.admin);
    });
  } catch (_) {
    return false;
  }
}

async function isSudoUser(userId) {
  if (!userId) return false;
  if (Sudo && typeof Sudo.findByPk === 'function') {
    for (const candidate of [userId, senderName(userId)]) {
      try {
        if (await Sudo.findByPk(candidate)) return true;
      } catch (_) {
        // La base peut être indisponible pendant le démarrage.
      }
    }
  }
  const configured = String(process.env.SUDO || process.env.SUDOS || process.env.NUMERO_OWNER || '')
    .split(',').map((item) => item.trim()).filter(Boolean);
  return configured.some((item) => senderName(item) === senderName(userId));
}

async function canStop(sock, groupId, userId, starter) {
  return sameUser(userId, starter) || await isSudoUser(userId) || await isGroupAdmin(sock, groupId, userId);
}

function endSession(groupId) {
  const session = sessions.get(groupId);
  if (session?.timer) clearTimeout(session.timer);
  sessions.delete(groupId);
}

async function receiveMessage(sock, groupId, timeout) {
  if (typeof sock.recup_msg !== 'function') return null;
  try {
    return await sock.recup_msg({ ms_org: groupId, temps: timeout });
  } catch (_) {
    return null;
  }
}

function questionText(result, client) {
  const question = result?.question || client.question || 'Question indisponible';
  const step = Number(result?.step ?? client.step ?? 0) + 1;
  const progress = Number(result?.progression ?? client.progression ?? 0).toFixed(1);
  return `🧞 *AKINATOR*\nQuestion ${step} — progression ${progress}%\n\n❓ ${question}\n\n${RESPONSE_HELP}\n\nÉcris *stop* pour annuler (créateur, admin ou sudo).`;
}

async function sendGuess(groupId, sock, client) {
  const win = client.winResult || {};
  let text = `🔮 *Akinator propose :*\n\n*${win.name || 'un personnage inconnu'}*`;
  if (win.description) text += `\n\n${win.description}`;
  text += '\n\nRéponds *oui* si c’est correct, ou *non* pour continuer.';
  await sock.sendMessage(groupId, { text });
  if (win.pictureUrl) {
    try {
      await sock.sendMessage(groupId, { image: { url: win.pictureUrl }, caption: win.name || 'Proposition Akinator' });
    } catch (_) {
      // L’image est optionnelle : le texte reste disponible.
    }
  }
}

async function waitForGuessConfirmation(groupId, sock, session, getJid) {
  const startedAt = Date.now();
  while (sessions.get(groupId) === session && Date.now() - startedAt < 60000) {
    const received = await receiveMessage(sock, groupId, Math.max(250, 60000 - (Date.now() - startedAt)));
    if (!received) break;
    const answer = clean(extractText(received));
    const player = await resolveSender(received, groupId, sock, getJid);
    if (!player) continue;
    if (isStopCommand(answer)) {
      if (await canStop(sock, groupId, player, session.starter)) {
        endSession(groupId);
        await sock.sendMessage(groupId, { text: `🛑 Partie Akinator arrêtée par @${senderName(player)}.`, mentions: [player] });
        return null;
      }
      continue;
    }
    if (['oui', 'yes', '1', 'o'].includes(answer)) return true;
    if (['non', 'no', '2', 'n'].includes(answer)) return false;
  }
  return null;
}

async function runAkinator(groupId, sock, session, getJid) {
  try {
    let result = await session.client.start();
    while (sessions.get(groupId) === session && !session.client.won && !session.client.ko) {
      await sock.sendMessage(groupId, { text: questionText(result, session.client) });
      const received = await receiveMessage(sock, groupId, 90000);
      if (!received) {
        endSession(groupId);
        await sock.sendMessage(groupId, { text: '⌛ Aucun choix reçu depuis 90 secondes. Partie Akinator terminée.' });
        return;
      }
      const answer = clean(extractText(received));
      const player = await resolveSender(received, groupId, sock, getJid);
      if (!player) continue;
      if (isStopCommand(answer)) {
        if (await canStop(sock, groupId, player, session.starter)) {
          endSession(groupId);
          await sock.sendMessage(groupId, { text: `🛑 Partie Akinator arrêtée par @${senderName(player)}.`, mentions: [player] });
          return;
        }
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(RESPONSE_MAP, answer)) {
        await sock.sendMessage(groupId, { text: `❌ Réponse invalide. ${RESPONSE_HELP}` });
        continue;
      }
      result = await session.client.answer(RESPONSE_MAP[answer]);
      if (result.won) {
        await sendGuess(groupId, sock, session.client);
        const confirmation = await waitForGuessConfirmation(groupId, sock, session, getJid);
        if (confirmation === null) return;
        if (confirmation) {
          await session.client.submitWin();
          const name = session.client.winResult?.name || 'ce personnage';
          endSession(groupId);
          await sock.sendMessage(groupId, { text: `🎉 Bien joué ! Akinator a trouvé *${name}*.` });
          return;
        }
        result = await session.client.continue();
      }
      if (result.ko || session.client.ko) {
        endSession(groupId);
        await sock.sendMessage(groupId, { text: '🤔 Akinator abandonne. Vous avez gagné !' });
        return;
      }
    }
  } catch (error) {
    if (sessions.get(groupId) !== session) return;
    endSession(groupId);
    console.error('[Akinator]', error);
    await sock.sendMessage(groupId, { text: '❌ Akinator est temporairement indisponible. Réessaie dans quelques instants.' });
  }
}

ovlcmd({
  nom_cmd: 'akinator',
  alias: ['aki', 'akinatorjeu'],
  classe: 'Jeux',
  react: '🧞',
  desc: 'Joue à Akinator en groupe.'
}, async (jid, sock, { repondre, auteur_Message, getJid }) => {
  if (!isGroup(jid)) {
    await repondre('❌ Akinator fonctionne uniquement dans les groupes.');
    return;
  }
  if (sessions.has(jid)) {
    await repondre('⚠️ Une partie Akinator est déjà en cours dans ce groupe.');
    return;
  }
  const session = {
    groupId: jid,
    starter: auteur_Message,
    client: new AkinatorClient({ language: Languages.French, theme: Themes.Character, childMode: true, retries: 2 }),
    timer: null
  };
  sessions.set(jid, session);
  await repondre('🧞 Je prépare Akinator en français…');
  await runAkinator(jid, sock, session, getJid);
});

ovlcmd({
  nom_cmd: 'stopakinator',
  alias: ['finakinator', 'stopaki'],
  classe: 'Jeux',
  react: '🛑',
  desc: 'Arrête la partie Akinator du groupe.'
}, async (jid, sock, { repondre, auteur_Message }) => {
  const session = sessions.get(jid);
  if (!session) {
    await repondre('ℹ️ Aucune partie Akinator active.');
    return;
  }
  if (!await canStop(sock, jid, auteur_Message, session.starter)) {
    await repondre('❌ Seul le créateur, un administrateur ou un sudo peut arrêter cette partie.');
    return;
  }
  endSession(jid);
  await repondre('🛑 Partie Akinator arrêtée.');
});

module.exports = { sessions, RESPONSE_MAP };
