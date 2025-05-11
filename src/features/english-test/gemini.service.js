const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const PROMPT_GRAMMAR_MULTIPLE_CHOICE = `Generate 20 English grammar test questions (multiple choice only) for level B1 (CEFR).
Each question should have 4 options, only one or two of which are correct.
For each question, specify the correct answer(s) in the "correct_answer" field (as a string for one answer, or as an array for multiple).
Format as a JSON array:
{
  "question_text": "...",
  "question_type": "multiple_choice",
  "options": ["...", "...", "...", "..."],
  "correct_answer": "...", // or ["...", "..."]
  "explanation": "...",
  "example": "..."
}
Return only the JSON array.`;

async function generateQuestionsGemini(category, subcategory, level = 'B1', count = 20) {
    // Можно добавить уточнение по теме и уровню:
    const prompt = PROMPT_GRAMMAR_MULTIPLE_CHOICE + `\nTopic: ${category} - ${subcategory}. Level: ${level}.`;
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    // Gemini может возвращать markdown, поэтому парсим только JSON
    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON array found in Gemini response');
    const jsonString = text.substring(jsonStart, jsonEnd + 1);
    return JSON.parse(jsonString);
}

module.exports = { generateQuestionsGemini, PROMPT_GRAMMAR_MULTIPLE_CHOICE }; 