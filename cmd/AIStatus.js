const { ovlcmd } = require('../lib/ovlcmd');
const { getOpenAIStatus } = require('../lib/openai_client');

function senderNumber(value) {
  return String(value || '').split('@')[0];
}

function isAuthorized(value) {
  const current = senderNumber(value);
  const allowed = String(process.env.NUMERO_OWNER || process.env.SUDO || process.env.SUDOS || '')
    .split(',').map((item) => senderNumber(item.trim())).filter(Boolean);
  return allowed.length === 0 || allowed.includes(current);
}

ovlcmd({
  nom_cmd: 'aistatus',
  alias: ['gptstatus', 'openai-status'],
  classe: 'Owner',
  react: '🩺',
  desc: 'Vérifie la configuration OpenAI sans afficher la clé.'
}, async (_jid, _sock, { repondre, auteur_Message }) => {
  if (!isAuthorized(auteur_Message)) return repondre('❌ Commande réservée au propriétaire ou aux sudo.');
  const status = getOpenAIStatus();
  await repondre([
    '🩺 *État OpenAI*',
    `• Clé détectée : ${status.configured ? 'oui' : 'non'}`,
    `• Empreinte : ${status.keyFingerprint}`,
    `• Base : ${status.baseURL}`,
    `• Modèle GPT : ${status.model}`,
    `• Modèle chatbot : ${status.chatbotModel}`,
    `• Modèle quiz : ${status.quizModel}`,
    '',
    status.configured ? 'La configuration est visible par le bot. Teste maintenant `.gpt bonjour` puis `.quizz-refresh naruto`.' : 'Ajoute OPENAI_API_KEY dans Render puis redéploie le service.'
  ].join('\n'));
});
