// Illustrations made by an image model, for tasks (the editor's "🎨" button and the
// generator's "add pictures" option). On Netlify the AI Gateway provides the Gemini key;
// elsewhere set GEMINI_API_KEY. IMAGE_MODEL picks the model; otherwise the first of
// MODELS that answers is used (and remembered).
import { HttpError } from './validate.js';
import { envVar } from './ai.js';

const MODELS = ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview', 'gemini-3-pro-image', 'gemini-2.5-flash-image-preview'];
let working = null;

export const imagesConfigured = () => Boolean(envVar('GEMINI_API_KEY'));

// Wraps the teacher's words so the picture suits young students and has no writing in it
// (image models misspell Hebrew).
export function imagePrompt(subject) {
  return [
    'A friendly, clear illustration for a children\'s school worksheet (ages 6–12).',
    'Simple flat colourful style, white background, one main subject, nothing scary or violent.',
    'Absolutely no text, letters, numbers or words anywhere in the picture.',
    `Subject: ${subject}`,
  ].join('\n');
}

export function createImageTool(make = async () => {
  const { GoogleGenAI } = await import('@google/genai');
  const base = envVar('GOOGLE_GEMINI_BASE_URL');
  return new GoogleGenAI({ apiKey: envVar('GEMINI_API_KEY'), ...(base ? { httpOptions: { baseUrl: base } } : {}) });
}) {
  return async function generateImage(subject) {
    if (!imagesConfigured()) throw new HttpError(503, 'יצירת תמונות לא הופעלה בשרת הזה.');
    const client = await make();
    const models = envVar('IMAGE_MODEL') ? [envVar('IMAGE_MODEL')] : working ? [working] : MODELS;
    let lastErr;
    for (const model of models) {
      try {
        const res = await client.models.generateContent({
          model,
          contents: imagePrompt(subject),
          config: { responseModalities: ['IMAGE'] },
        });
        const part = res?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
        if (!part) throw new HttpError(422, 'לא נוצרה תמונה לתיאור הזה. נסו לתאר אחרת.');
        working = model;
        return { data: Buffer.from(part.inlineData.data, 'base64'), mime: part.inlineData.mimeType || 'image/png' };
      } catch (err) {
        lastErr = err;
        if (err instanceof HttpError) throw err;
        console.error(`image model ${model} failed:`, err?.status ?? '', String(err?.message || err).slice(0, 300));
        // Content blocked: another model won't help. Anything else (a model this gateway
        // doesn't offer, a busy model): try the next one.
        if (/safety|blocked|prohibited/i.test(String(err?.message))) break;
      }
    }
    console.error('image generation failed:', lastErr?.status ?? '', String(lastErr?.message || lastErr).slice(0, 300));
    if (/safety|blocked|prohibited/i.test(String(lastErr?.message))) throw new HttpError(422, 'התמונה נחסמה. נסו תיאור אחר.');
    throw new HttpError(502, 'לא הצלחנו ליצור תמונה כרגע. נסו שוב בעוד דקה.');
  };
}
