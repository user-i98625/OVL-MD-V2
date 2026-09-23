const axios = require('axios');

function normalizeBaseURL(value) {
  const base = String(value || 'https://api.openai.com/v1').trim().replace(/\/$/, '');
  return base.replace(/\/(chat\/completions|responses)$/, '');
}

function getOpenAIConfig() {
  const key = String(process.env.OPENAI_API_KEY || '').trim();
  if (!key) return null;
  return {
    key,
    baseURL: normalizeBaseURL(process.env.OPENAI_API_BASE),
    model: String(process.env.OPENAI_MODEL || 'gpt-4o-mini').trim(),
    chatbotModel: String(process.env.OPENAI_CHATBOT_MODEL || process.env.OPENAI_MODEL || 'gpt-5-mini').trim(),
    quizModel: String(process.env.OPENAI_QUIZ_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini').trim()
  };
}

function keyFingerprint(key) {
  const value = String(key || '').trim();
  return value ? `${value.slice(0, 4)}…${value.slice(-4)}` : 'absente';
}

function getOpenAIStatus() {
  const config = getOpenAIConfig();
  return {
    configured: Boolean(config),
    keyFingerprint: keyFingerprint(config?.key),
    baseURL: config?.baseURL || normalizeBaseURL(process.env.OPENAI_API_BASE),
    model: config?.model || String(process.env.OPENAI_MODEL || 'gpt-4o-mini'),
    chatbotModel: config?.chatbotModel || String(process.env.OPENAI_CHATBOT_MODEL || process.env.OPENAI_MODEL || 'gpt-5-mini'),
    quizModel: config?.quizModel || String(process.env.OPENAI_QUIZ_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini')
  };
}

function explainOpenAIError(error) {
  const status = error?.response?.status;
  const apiMessage = error?.response?.data?.error?.message || error?.response?.data?.message;
  if (status === 400) return `Requête OpenAI invalide${apiMessage ? ` : ${apiMessage}` : '.'}`;
  if (status === 401) return 'La clé OPENAI_API_KEY est refusée ou invalide (HTTP 401).';
  if (status === 403) return 'OpenAI refuse cette opération (modèle, organisation ou autorisation).';
  if (status === 429) return 'OpenAI a limité la requête (quota, facturation ou trop de demandes).';
  if (status === 404) return 'Le modèle ou l’endpoint OpenAI est introuvable. Vérifie OPENAI_MODEL et OPENAI_API_BASE.';
  if (apiMessage) return `OpenAI : ${apiMessage}`;
  if (error?.code === 'ECONNABORTED') return 'OpenAI n’a pas répondu dans le délai prévu.';
  return error?.message || 'Erreur inconnue pendant l’appel à OpenAI.';
}

function headers(config) {
  return { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' };
}

async function request(path, payload, options = {}) {
  const config = getOpenAIConfig();
  if (!config) throw new Error('OPENAI_API_KEY est absente dans les variables d’environnement.');
  try {
    return await axios.post(`${config.baseURL}${path}`, payload, {
      headers: headers(config),
      timeout: options.timeout || 90000,
      validateStatus: (status) => status >= 200 && status < 300
    });
  } catch (error) {
    error.userMessage = explainOpenAIError(error);
    throw error;
  }
}

async function chatCompletion(messages, options = {}) {
  const config = getOpenAIConfig();
  if (!config) throw new Error('OPENAI_API_KEY est absente dans les variables d’environnement.');
  const payload = {
    model: options.model || config.model,
    messages,
    temperature: options.temperature ?? 0.7
  };
  if (options.maxTokens) payload.max_tokens = options.maxTokens;
  if (options.jsonSchema) {
    payload.response_format = { type: 'json_schema', json_schema: options.jsonSchema };
  } else if (options.json) {
    payload.response_format = { type: 'json_object' };
  }
  const response = await request('/chat/completions', payload, options);
  const choice = response?.data?.choices?.[0];
  const content = choice?.message?.content || '';
  if (choice?.finish_reason === 'length') {
    const error = new Error('La réponse OpenAI a été tronquée par la limite de sortie.');
    error.userMessage = 'La réponse OpenAI était trop longue. Réessaie avec une demande plus courte.';
    throw error;
  }
  return content;
}

function extractResponseText(data) {
  if (data?.output_text) return data.output_text;
  return (data?.output || []).flatMap((item) => item?.content || [])
    .filter((item) => item?.type === 'output_text' && item?.text)
    .map((item) => item.text).join('\n');
}

function extractCitations(data) {
  return (data?.output || []).flatMap((item) => item?.content || [])
    .flatMap((content) => content?.annotations || [])
    .filter((annotation) => annotation?.type === 'url_citation' && annotation.url)
    .map((annotation) => ({ url: annotation.url, title: annotation.title || annotation.url }))
    .filter((item, index, list) => list.findIndex((candidate) => candidate.url === item.url) === index);
}

async function responsesCompletion(input, options = {}) {
  const config = getOpenAIConfig();
  if (!config) throw new Error('OPENAI_API_KEY est absente dans les variables d’environnement.');
  const payload = {
    model: options.model || config.chatbotModel,
    input,
    store: false
  };
  if (options.webSearch) payload.tools = [{ type: 'web_search' }];
  if (options.toolChoice) payload.tool_choice = options.toolChoice;
  if (options.maxOutputTokens) payload.max_output_tokens = options.maxOutputTokens;
  const response = await request('/responses', payload, options);
  const data = response?.data || {};
  if (data.status === 'incomplete') {
    const error = new Error('Réponse Responses incomplète.');
    error.userMessage = 'La réponse de recherche est incomplète. Réessaie avec une question plus courte.';
    throw error;
  }
  return { text: extractResponseText(data), citations: extractCitations(data), raw: data };
}

module.exports = {
  getOpenAIConfig,
  getOpenAIStatus,
  chatCompletion,
  responsesCompletion,
  explainOpenAIError
};
