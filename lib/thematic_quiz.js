const fs = require('fs');
const path = require('path');
const { getOpenAIConfig, chatCompletion } = require('./openai_client');

const CACHE_DIR = path.join(__dirname, 'quiz_cache');
const QUESTION_COUNT = 30;
const MAX_TOPIC_LENGTH = 80;

function normalizeTopic(topic) {
  return String(topic || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TOPIC_LENGTH);
}

function topicKey(topic) {
  return normalizeTopic(topic)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'theme';
}

function cacheFile(topic) {
  return path.join(CACHE_DIR, `${topicKey(topic)}.json`);
}

function parseJsonContent(content) {
  const text = String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : parsed.questions;
}

function validateQuestions(questions, topic, minimum = QUESTION_COUNT) {
  if (!Array.isArray(questions) || questions.length < minimum) {
    throw new Error(`La génération n’a fourni que ${Array.isArray(questions) ? questions.length : 0} questions valides.`);
  }
  const seen = new Set();
  const valid = questions.slice(0, QUESTION_COUNT).map((item, index) => {
    const question = String(item?.question || '').replace(/\s+/g, ' ').trim();
    const options = item?.options || {};
    const normalizedOptions = {
      a: String(options.a || '').trim(),
      b: String(options.b || '').trim(),
      c: String(options.c || '').trim(),
      d: String(options.d || '').trim()
    };
    const answer = String(item?.answer || '').trim().toLowerCase();
    const signature = question.toLowerCase();
    if (!question || question.length < 8 || seen.has(signature)) throw new Error(`Question ${index + 1} invalide ou en doublon.`);
    if (Object.values(normalizedOptions).some((value) => !value)) throw new Error(`Options manquantes à la question ${index + 1}.`);
    if (!['a', 'b', 'c', 'd'].includes(answer)) throw new Error(`Réponse invalide à la question ${index + 1}.`);
    seen.add(signature);
    return { question, options: normalizedOptions, answer, topic };
  });
  return valid;
}

function loadCachedQuiz(topic) {
  const file = cacheFile(topic);
  if (!fs.existsSync(file)) return null;
  try {
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    return validateQuestions(payload.questions, payload.topic || topic);
  } catch (error) {
    console.warn(`[Quiz thématique] Cache ignoré pour ${topic}: ${error.message}`);
    return null;
  }
}

function saveCachedQuiz(topic, questions) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = cacheFile(topic);
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify({ topic, generatedAt: new Date().toISOString(), questions }, null, 2), 'utf8');
  fs.renameSync(temporary, file);
}

async function generateQuiz(topic) {
  const normalizedTopic = normalizeTopic(topic);
  if (!normalizedTopic) throw new Error('Indique le nom d’un animé.');
  if (!getOpenAIConfig()) throw new Error('La génération automatique n’est pas configurée. Ajoute OPENAI_API_KEY dans les variables d’environnement de Render.');
  const schema = {
    name: 'anime_quiz_batch',
    strict: true,
    schema: {
      type: 'object',
      properties: { questions: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, options: { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' }, c: { type: 'string' }, d: { type: 'string' } }, required: ['a', 'b', 'c', 'd'], additionalProperties: false }, answer: { type: 'string', enum: ['a', 'b', 'c', 'd'] } }, required: ['question', 'options', 'answer'], additionalProperties: false } } },
      required: ['questions'], additionalProperties: false
    }
  };
  const allQuestions = [];
  for (let batch = 0; batch < 3; batch += 1) {
    const content = await chatCompletion([
      { role: 'system', content: 'Tu crées des quiz fiables en français. Réponds uniquement avec le JSON demandé. N’invente pas de titres, personnages ou événements.' },
      { role: 'user', content: `Crée exactement 10 questions différentes sur l’animé « ${normalizedTopic} ». C’est le lot ${batch + 1}/3. Couvre histoire, personnages, lieux, pouvoirs, saisons et événements connus. Ne répète aucune question déjà générée dans ce lot. Chaque question doit avoir quatre choix a,b,c,d et answer vaut a,b,c ou d.` }
    ], { model: getOpenAIConfig().quizModel, temperature: 0.25, maxTokens: 3000, jsonSchema: schema, timeout: 90000 });
    const batchQuestions = validateQuestions(parseJsonContent(content), normalizedTopic, 10);
    allQuestions.push(...batchQuestions);
  }
  const questions = validateQuestions(allQuestions, normalizedTopic);
  saveCachedQuiz(normalizedTopic, questions);
  return questions;
}

async function loadOrGenerateQuiz(topic) {
  const normalizedTopic = normalizeTopic(topic);
  const cached = loadCachedQuiz(normalizedTopic);
  if (cached) return { topic: normalizedTopic, questions: cached, cached: true };
  const questions = await generateQuiz(normalizedTopic);
  return { topic: normalizedTopic, questions, cached: false };
}

function clearQuizCache(topic) {
  const file = cacheFile(topic);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return file;
}

module.exports = {
  QUESTION_COUNT,
  normalizeTopic,
  topicKey,
  validateQuestions,
  loadCachedQuiz,
  loadOrGenerateQuiz,
  clearQuizCache
};
