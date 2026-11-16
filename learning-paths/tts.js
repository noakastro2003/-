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

const providers = {
  gemini: {
    id: `${GEMINI_MODEL}/${GEMINI_VOICE}`,
    enabled: () => Boolean(envVar('GEMINI_API_KEY')),
    async speak(text) {
      const { GoogleGenAI } = await import('@google/genai');
      const base = envVar('GOOGLE_GEMINI_BASE_URL');
      const client = new GoogleGenAI({ apiKey: envVar('GEMINI_API_KEY'), ...(base ? { httpOptions: { baseUrl: base } } : {}) });
      const res = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ parts: [{ text: `הקריאו בעברית, לאט, בקול חם וברור למורה שמקריאה לילדים בכיתה:\n${text}` }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_VOICE } } },
        },
      });
      const part = res?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part) throw new Error('no audio in the reply');
      const pcm = Buffer.from(part.inlineData.data, 'base64');
      const rate = Number(String(part.inlineData.mimeType || '').match(/rate=(\d+)/)?.[1]) || 24000;
      return { data: wav(pcm, rate), mime: 'audio/wav' };
    },
  },
  openai: {
    id: `${OPENAI_MODEL}/${OPENAI_VOICE}`,
    enabled: () => Boolean(envVar('OPENAI_API_KEY')),
    async speak(text) {
      const { default: OpenAI } = await import('openai');
      const base = envVar('OPENAI_BASE_URL');
      const client = new OpenAI({ apiKey: envVar('OPENAI_API_KEY'), ...(base ? { baseURL: base } : {}) });
      const res = await client.audio.speech.create({
        model: OPENAI_MODEL, voice: OPENAI_VOICE, input: text, response_format: 'mp3',
        instructions: 'Speak Hebrew with a native Israeli accent, slowly and warmly, like a teacher reading to young children.',
      });
      return { data: Buffer.from(await res.arrayBuffer()), mime: 'audio/mpeg' };
    },
  },
};

// 16-bit mono PCM → a WAV file.
export function wav(pcm, rate = 24000) {
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVE', 8);
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
  head.writeUInt32LE(rate, 24); head.writeUInt32LE(rate * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
  head.write('data', 36); head.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([head, pcm]);
}

let working = null;
const order = () => {
  const forced = envVar('TTS_PROVIDER');
  const names = forced && providers[forced] ? [forced] : working ? [working, ...Object.keys(providers).filter((n) => n !== working)] : ['gemini', 'openai'];
  return names.filter((n) => providers[n].enabled());
};

export const ttsConfigured = () => order().length > 0;

// → { enabled, voiceId (part of the cache key), speak(text) → { data, mime } }
export function createTts() {
  return {
    get enabled() { return ttsConfigured(); },
    get voiceId() { return providers[order()[0]]?.id || ''; },
    async speak(text) {
      let lastErr;
      for (const name of order()) {
        try {
          const out = await providers[name].speak(text);
          working = name;
          return { ...out, voiceId: providers[name].id };
        } catch (err) {
          lastErr = err;
          console.error(`tts ${name} failed:`, err?.status ?? '', String(err?.message || err).slice(0, 300));
        }
      }
      if (!lastErr) throw new HttpError(503, 'הקראה בקול טבעי לא הופעלה בשרת הזה.');
      throw new HttpError(502, 'ההקראה לא זמינה כרגע.');
    },
  };
}
