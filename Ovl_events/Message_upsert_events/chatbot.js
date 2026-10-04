const axios = require('axios');
const { ChatbotConf } = require('../../DataBase/chatbot');

function parseEnabledIds(value) {
  try {
    const parsed = Array.isArray(value) ? value : JSON.parse(value || '[]');
    return parsed.map((item) => String(item));
  } catch { return []; }
}
function cleanJid(value) { return String(value || '').trim(); }
function isEnabled(config, isGroup, chatId) {
  const enabledIds = parseEnabledIds(config.enabled_ids);
  if (enabledIds.includes(cleanJid(chatId))) return true;
  return isGroup ? String(config.chatbot_gc).toLowerCase() === 'oui' : String(config.chatbot_pm).toLowerCase() === 'oui';
}

// Chatbot historique OVL uniquement : aucune clé OpenAI, aucun mode alternatif.
async function chatbot(sender, isGroup, text, reply, _enabledIds, chatId, alternateChatId, botJid) {
  const message = String(text || '').trim();
  if (!message) return;
  try {
    const settings = await ChatbotConf.findByPk('1');
    if (!settings) return;
    const currentChat = cleanJid(chatId || alternateChatId);
    if (!isEnabled(settings, Boolean(isGroup), currentChat)) return;
    const response = await axios.get('https://uta-f1kg.onrender.com/chatbot', {
      params: { user_id: `${cleanJid(sender).split('@')[0]}_${cleanJid(botJid).split('@')[0]}`, text: message },
      timeout: 30000
    });
    const answer = typeof response.data === 'string' ? response.data : response.data?.text;
    if (answer && String(answer).trim()) await reply(String(answer).trim());
    else console.warn('[chatbot] service historique : réponse vide');
  } catch (error) {
    console.error('[chatbot] service historique indisponible:', error.message);
  }
}
module.exports = chatbot;
