const axios = require('axios');
const { ChatbotConf } = require('../../DataBase/chatbot');
const { getOpenAIConfig, responsesCompletion, chatCompletion } = require('../../lib/openai_client');

function parseEnabledIds(value) {
  try {
    const parsed = Array.isArray(value) ? value : JSON.parse(value || '[]');
    return parsed.map((item) => String(item));
  } catch {
    return [];
  }
}

function cleanJid(value) {
  return String(value || '').trim();
}

function formatCitations(citations) {
  if (!citations?.length) return '';
  return `\n\nSources :\n${citations.slice(0, 5).map((item, index) => `${index + 1}. ${item.title} — ${item.url}`).join('\n')}`;
}

function isEnabled(config, isGroup, chatId) {
  const enabledIds = parseEnabledIds(config.enabled_ids);
  if (enabledIds.includes(cleanJid(chatId))) return true;
  return isGroup ? String(config.chatbot_gc).toLowerCase() === 'oui' : String(config.chatbot_pm).toLowerCase() === 'oui';
}

async function legacyFallback(sender, botJid, text, reply) {
  if (process.env.CHATBOT_LEGACY_FALLBACK === 'false') return;
  try {
    const response = await axios.get('https://uta-f1kg.onrender.com/chatbot', {
      params: { user_id: `${sender.split('@')[0]}_${botJid.split('@')[0]}`, text },
      timeout: 30000
    });
    if (response.data?.text) await reply(response.data.text);
  } catch (error) {
    console.error('[chatbot] fallback indisponible:', error.message);
  }
}

async function chatbot(sender, isGroup, text, reply, _enabledIds, chatId, alternateChatId, botJid) {
  const message = String(text || '').trim();
  if (!message) return;
  try {
    const settings = await ChatbotConf.findByPk('1');
    if (!settings) return;
    const currentChat = cleanJid(chatId || alternateChatId);
    if (!isEnabled(settings, Boolean(isGroup), currentChat)) return;

    const config = getOpenAIConfig();
    if (!config) return legacyFallback(cleanJid(sender), cleanJid(botJid), message, reply);

    const system = [
      'Tu es le chatbot WhatsApp d’un groupe francophone.',
      'Réponds en français, de manière concise, utile et naturelle.',
      'Pour les actualités, résultats, sorties, prix, versions ou toute information susceptible d’avoir changé, utilise la recherche web.',
      'Ne présente jamais une supposition comme un fait. Si les sources sont insuffisantes, dis-le clairement.',
      'N’affiche pas de Markdown complexe ; les liens simples sont acceptés dans WhatsApp.'
    ].join(' ');
    let result;
    try {
      result = await responsesCompletion([
        { role: 'system', content: system },
        { role: 'user', content: message }
      ], { model: config.chatbotModel, webSearch: true, toolChoice: 'auto', maxOutputTokens: 1200, timeout: 90000 });
    } catch (error) {
      console.error('[chatbot] Responses API:', error.userMessage || error.message);
      if (process.env.OPENAI_CHATBOT_ALLOW_NO_SEARCH === 'false') return;
      const fallbackText = await chatCompletion([
        { role: 'system', content: `${system} La recherche web est momentanément indisponible ; indique que les informations peuvent ne pas être à jour.` },
        { role: 'user', content: message }
      ], { model: config.model, temperature: 0.5, maxTokens: 700, timeout: 60000 });
      result = { text: fallbackText, citations: [] };
    }
    if (result?.text) await reply(`${result.text.trim()}${formatCitations(result.citations)}`);
  } catch (error) {
    console.error('[chatbot] erreur:', error.userMessage || error.message);
  }
}

module.exports = chatbot;
