// Starter content a teacher can create a new path from.

export const TEMPLATES = {
  empty: { description: '', tasks: [] },
  sample: {
    description: 'מסלול לדוגמה – אפשר לערוך, למחוק ולהוסיף משימות.',
    tasks: [
      {
        type: 'checklist', title: 'מתכוננים ללמידה', emoji: '🎒', estMinutes: 2,
        content: { text: 'לפני שמתחילים, נסדר את הסביבה:', items: ['פיניתי את השולחן', 'הוצאתי עיפרון ומחברת', 'שתיתי מים'] },
      },
      {
        type: 'read', title: 'קוראים את הסיפור', emoji: '📖', estMinutes: 5,
        content: { text: 'קראו את הסיפור בעמוד 12 בספר. אפשר לקרוא בקול או בלב.', imageUrl: '' },
      },
      {
        type: 'timer', title: 'עבודה מרוכזת', emoji: '⏱️', estMinutes: 8,
        content: { text: 'כתבו במחברת 3 דברים שקרו בסיפור. כשהשעון מסתיים – סיימתם!', minutes: 8 },
      },
      {
        type: 'choice', title: 'בודקים הבנה', emoji: '🤔', estMinutes: 2,
        content: { text: 'מי הדמות הראשית בסיפור?', options: ['הארנב', 'הצב', 'השועל'], correct: 1, explanation: 'נכון! הצב הוא הגיבור של הסיפור.' },
      },
      {
        type: 'question', title: 'מה דעתי?', emoji: '💬', estMinutes: 4,
        content: { text: 'מה הייתם עושים אם הייתם הדמות הראשית? כתבו משפט אחד או שניים.' },
      },
      {
        type: 'memory', title: 'משחק זיכרון', emoji: '🃏', estMinutes: 4,
        content: { text: 'הפכו שני קלפים בכל פעם ומצאו את כל הזוגות.', pairs: [{ a: '🐢', b: 'צב' }, { a: '🐇', b: 'ארנב' }, { a: '🦊', b: 'שועל' }, { a: '🌳', b: 'עץ' }] },
      },
    ],
  },
};
