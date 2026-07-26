const NOTE_PROMPTS = [
  "How did it feel?",
  "What did you think about?",
  "How did you feel?",
  "Anything on your mind?",
  "Sorted anything out?",
  "Remembered something?",
  "Remembered someone?",
];

export function randomNotePrompt(): string {
  return NOTE_PROMPTS[Math.floor(Math.random() * NOTE_PROMPTS.length)];
}
