// Natural Hebrew read-aloud. On Netlify the AI Gateway provides the keys (Gemini and OpenAI);
// elsewhere set GEMINI_API_KEY or OPENAI_API_KEY. The first provider that answers is used and
// remembered. TTS_PROVIDER ("gemini" or "openai") forces one. Every recording is cached by the
// server, so a text is synthesized once for all students.
import { HttpError } from './validate.js';
import { envVar } from './ai.js';

export const TTS_MAX_CHARS = 700;
const GEMINI_MODEL = 'gemini-2.5-flash-preview-tts';
const GEMINI_VOICE = 'Kore';
const OPENAI_MODEL = 'gpt-4o-mini-tts';
const OPENAI_VOICE = 'coral';

const SPEAK_HE = 'הקריאו בעברית, לאט, בקול חם וברור של מורה שמקריאה לילדים בכיתה. הקריאו רק את הטקסט, בלי להוסיף דבר:';
const geminiClient = async () => {
  const { GoogleGenAI } = await import('@google/genai');
  const base = envVar('GOOGLE_GEMINI_BASE_URL');
  return new GoogleGenAI({ apiKey: envVar('GEMINI_API_KEY'), ...(base ? { httpOptions: { baseUrl: base } } : {}) });
};
const openaiClient = async () => {
  const { default: OpenAI } = await import('openai');
  const base = envVar('OPENAI_BASE_URL');
  return new OpenAI({ apiKey: envVar('OPENAI_API_KEY'), ...(base ? { baseURL: base } : {}) });
};

function geminiTts(model) {
  return {
    id: `${model}/${GEMINI_VOICE}`, family: 'gemini',
    enabled: () => Boolean(envVar('GEMINI_API_KEY')),
    async speak(text) {
      const res = await (await geminiClient()).models.generateContent({
        model,
        contents: [{ parts: [{ text: `${SPEAK_HE}\n${text}` }] }],
        config: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_VOICE } } } },
      });
      const part = res?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part) throw new Error('no audio in the reply');
      const pcm = Buffer.from(part.inlineData.data, 'base64');
      const rate = Number(String(part.inlineData.mimeType || '').match(/rate=(\d+)/)?.[1]) || 24000;
      return { data: wav(pcm, rate), mime: 'audio/wav' };
    },
  };
}

// The speech endpoint returns raw audio; some gateways refuse the SDK's binary Accept header,
// so ask for any type.
const openaiSpeech = {
  id: `${OPENAI_MODEL}/${OPENAI_VOICE}`, family: 'openai',
  enabled: () => Boolean(envVar('OPENAI_API_KEY')),
  async speak(text) {
    const res = await (await openaiClient()).audio.speech.create({
      model: OPENAI_MODEL, voice: OPENAI_VOICE, input: text, response_format: 'mp3',
      instructions: 'Speak Hebrew with a native Israeli accent, slowly and warmly, like a teacher reading to young children.',
    }, { headers: { Accept: '*/*' } });
    return { data: Buffer.from(await res.arrayBuffer()), mime: 'audio/mpeg' };
  },
};

// Chat models that answer with audio (JSON with base64 audio).
function openaiChatAudio(model) {
  return {
    id: `${model}/${OPENAI_VOICE}`, family: 'openai',
    enabled: () => Boolean(envVar('OPENAI_API_KEY')),
    async speak(text) {
      const res = await (await openaiClient()).chat.completions.create({
        model, modalities: ['text', 'audio'], audio: { voice: OPENAI_VOICE, format: 'mp3' },
        messages: [
          { role: 'system', content: 'You are a text-to-speech voice. Read the user\'s Hebrew text aloud exactly as written, word for word, slowly and warmly, with a native Israeli accent. Do not add, answer or translate anything.' },
          { role: 'user', content: text },
        ],
      });
      const data = res?.choices?.[0]?.message?.audio?.data;
      if (!data) throw new Error('no audio in the reply');
      return { data: Buffer.from(data, 'base64'), mime: 'audio/mpeg' };
    },
  };
}

const providers = [
  geminiTts('gemini-2.5-flash-preview-tts'),
  geminiTts('gemini-2.5-flash-tts'),
  geminiTts('gemini-2.5-pro-preview-tts'),
  openaiSpeech,
  openaiChatAudio('gpt-4o-mini-audio-preview'),
  openaiChatAudio('gpt-audio-mini'),
  openaiChatAudio('gpt-4o-audio-preview'),
  openaiChatAudio('gpt-audio'),
];

// 16-bit mono PCM → a WAV file.
export function wav(pcm, rate = 24000) {
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVE', 8);
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
  head.writeUInt32LE(rate, 24); head.writeUInt32LE(rate * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
  head.write('data', 36); head.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([head, pcm]);
}

let working = null; // the provider that answered last
const order = () => {
  const forced = envVar('TTS_PROVIDER'); // "gemini", "openai" or one id
  let list = providers.filter((p) => p.enabled() && (!forced || p.family === forced || p.id.startsWith(forced)));
  if (working && list.includes(working)) list = [working, ...list.filter((p) => p !== working)];
  return list;
};

export const ttsConfigured = () => order().length > 0;

// → { enabled, voiceId (part of the cache key), speak(text) → { data, mime, voiceId } }
export function createTts() {
  return {
    get enabled() { return ttsConfigured(); },
    get voiceId() { return order()[0]?.id || ''; },
    get voiceIds() { return order().map((p) => p.id); },
    async speak(text) {
      let lastErr;
      for (const p of order()) {
        try {
          const out = await p.speak(text);
          if (!out.data?.length) throw new Error('empty audio');
          working = p;
          return { ...out, voiceId: p.id };
        } catch (err) {
          lastErr = err;
          console.error(`tts ${p.id} failed:`, err?.status ?? '', String(err?.message || err).slice(0, 200));
        }
      }
      if (!lastErr) throw new HttpError(503, 'הקראה בקול טבעי לא הופעלה בשרת הזה.');
      throw new HttpError(502, 'ההקראה לא זמינה כרגע.');
    },
  };
}
