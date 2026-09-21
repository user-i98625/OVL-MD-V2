const axios = require('axios');

function getOpenAIConfig() {
  const key = String(process.env.OPENAI_API_KEY || process.env.QUIZ_AI_API_KEY || '').trim();
  if (!key) return null;
  return {
    key,
    baseURL: String(process.env.OPENAI_API_BASE || process.env.QUIZ_AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.OPENAI_MODEL || process.env.QUIZ_AI_MODEL || process.env.AI_MODEL || 'gpt-4o-mini'
  };
}

function explainOpenAIError(error) {
  const status = error?.response?.status;
  const apiMessage = error?.response?.data?.error?.message || error?.response?.data?.message;
  if (status === 401) return 'La clé OPENAI_API_KEY est refusée ou invalide (HTTP 401).';
  if (status === 429) return 'OpenAI a limité la requête (quota, facturation ou trop de demandes).';
  if (status === 404) return 'Le modèle ou l’endpoint OpenAI est introuvable. Vérifie OPENAI_MODEL et OPENAI_API_BASE.';
  if (apiMessage) return `OpenAI : ${apiMessage}`;
  return error?.message || 'Erreur inconnue pendant l’appel à OpenAI.';
}

async function chatCompletion(messages, options = {}) {
  const config = getOpenAIConfig();
  if (!config) throw new Error('OPENAI_API_KEY est absente dans les variables d’environnement.');
  const payload = {
    model: options.model || config.model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens || 1200
  };
  if (options.json) payload.response_format = { type: 'json_object' };
  try {
    const response = await axios.post(`${config.baseURL}/chat/completions`, payload, {
      headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
      timeout: options.timeout || 90000
    });
    return response?.data?.choices?.[0]?.message?.content || '';
  } catch (error) {
    error.userMessage = explainOpenAIError(error);
    throw error;
  }
}

module.exports = { getOpenAIConfig, chatCompletion, explainOpenAIError };
