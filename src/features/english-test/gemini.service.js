const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// More dynamic prompt construction
function getGeminiPrompt(category, subcategory, level, count, questionType) {
    let specificInstructions = '';
    let exampleFormat = '';

    switch (questionType) {
        case 'multiple_choice':
            specificInstructions = `Each question should be multiple choice with 4 options. Only one option should be correct.`;
            exampleFormat = `{
  "question_text": "Which sentence is grammatically correct?",
  "question_type": "multiple_choice",
  "options": ["He don't like coffee.", "He doesn't likes coffee.", "He no like coffee.", "He doesn't like coffee."],
  "correct_answer": "He doesn't like coffee.",
  "explanation": "'Doesn't' is the correct contraction for 'does not', used with third-person singular subjects like 'he'.",
  "example": "She doesn't want to go."
}`;
            break;
        case 'true_false':
            specificInstructions = `Each question should be a statement that is either true or false.`;
            exampleFormat = `{
  "question_text": "The word 'apple' is a verb.",
  "question_type": "true_false",
  "options": ["True", "False"], 
  "correct_answer": "False",
  "explanation": "'Apple' is a noun.",
  "example": "'Run' is a verb, 'quickly' is an adverb."
}`; // Note: options might be redundant if always T/F, but good for consistency.
            break;
        case 'fill_in_blank':
            specificInstructions = `Each question should be a sentence with a blank (e.g., "___" or "[blank]"). The user needs to fill in the missing word or phrase.`;
            exampleFormat = `{
  "question_text": "She ___ to the store yesterday.",
  "question_type": "fill_in_blank",
  "options": [], // No options for fill_in_blank directly from Gemini unless it's for distraction, usually not.
  "correct_answer": "went",
  "explanation": "The past tense of 'go' is 'went'.",
  "example": "They went to the park."
}`;
            break;
        default:
            specificInstructions = `Generate a generic English question.`;
            exampleFormat = `{"question_text": "...", "question_type": "...", ...}`;
    }

    // Constructing the main prompt
    return `You are an expert English language teacher creating test questions.
Generate ${count} English questions for the topic "${category} - ${subcategory}" at CEFR level ${level}.
${specificInstructions}

For each question, provide:
- "question_text": The question itself.
- "question_type": "${questionType}" (must be this exact string).
- "options": An array of strings (for multiple_choice or true_false). For fill_in_blank, this can be an empty array.
- "correct_answer": The correct answer as a string. If multiple_choice, it's one of the options.
- "explanation": A brief explanation of why the answer is correct, especially for grammar.
- "example": A sentence using the correct answer or illustrating the grammar point.

Format the entire response as a single JSON array of question objects. Do NOT include any text outside this JSON array.
Example of one object in the array:
${exampleFormat}

Return ONLY the JSON array.`;
}


async function generateQuestionsGemini(category, subcategory, level = 'B1', count = 5, questionType = 'multiple_choice') {
    const prompt = getGeminiPrompt(category, subcategory, level, count, questionType);
    console.log(`[Gemini Service] Generating ${count} ${questionType} questions for ${category} - ${subcategory}, Level: ${level}`);
    // console.debug("[Gemini Prompt]:\n", prompt); // Uncomment for debugging prompts

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Or your preferred model

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Attempt to parse JSON robustly
        let jsonString = text.trim();
        if (jsonString.startsWith('```json')) {
            jsonString = jsonString.substring(7, jsonString.length - 3).trim();
        } else if (jsonString.startsWith('```')) {
             jsonString = jsonString.substring(3, jsonString.length - 3).trim();
        }
        
        // Find the start and end of the JSON array if it's embedded
        const arrayStartIndex = jsonString.indexOf('[');
        const arrayEndIndex = jsonString.lastIndexOf(']');

        if (arrayStartIndex === -1 || arrayEndIndex === -1 || arrayEndIndex < arrayStartIndex) {
            console.error('[Gemini Service] No valid JSON array found in response. Raw text:', text);
            throw new Error('Gemini response did not contain a valid JSON array.');
        }

        jsonString = jsonString.substring(arrayStartIndex, arrayEndIndex + 1);
        
        const parsedQuestions = JSON.parse(jsonString);

        if (!Array.isArray(parsedQuestions)) {
            console.error('[Gemini Service] Parsed response is not an array. Raw text:', text);
            throw new Error('Gemini response was not a JSON array after parsing.');
        }
        
        // Validate and ensure question_type is set
        return parsedQuestions.map(q => ({
            ...q,
            question_type: q.question_type || questionType, // Ensure type is set
            options: q.options || [] // Ensure options is an array
        }));

    } catch (error) {
        console.error(`[Gemini Service] Error generating or parsing questions: ${error.message}`);
        if (error.response && error.response.promptFeedback) {
            console.error('[Gemini Service] Prompt Feedback:', error.response.promptFeedback);
        }
        // console.error('[Gemini Service] Raw text on error:', error.text ? error.text() : "N/A"); // If the original error contained the text
        throw error; // Re-throw to be handled by the service
    }
}

module.exports = { generateQuestionsGemini };