const { getCategories, getSubcategories, getQuestions, saveUserResult, getUserResults, getSubcategoryById, saveGeneratedQuestions } = require('../../../src/DB/db'); // Added saveGeneratedQuestions
const { generateQuestionsGemini } = require('./gemini.service');

class EnglishTestService {
    constructor() {
        this.userStates = new Map(); // userId -> { state, focus, level, subcategoryId, currentQuestion, questions, answers }
    }

    // ... (generateQuestions, getCategoriesMenu, getSubcategoriesMenu are fine) ...
    async generateQuestions(category, subcategory, level = 'B1', count = 5, questionType = 'multiple_choice') {
        console.log(`[Service] Generating questions for: Cat=${category}, Subcat=${subcategory}, Lvl=${level}, Count=${count}, Type=${questionType}`);
        return await generateQuestionsGemini(category, subcategory, level, count, questionType);
    }

    async getSubcategoriesMenu(categoryId) {
        const subcategories = await getSubcategories(categoryId);
        if (!subcategories) return []; // Handle null/undefined case
        return subcategories.map(sub => ({
            text: sub.name,
            callback_data: `english_subcategory_${sub.id}`
        }));
    }


    async startTest(userId, subcategoryId, level = 'B1') {
        try {
            let questions = await getQuestions(subcategoryId, level); // Fetch by subcategory AND level
            
            if (!questions || questions.length === 0) {
                console.log(`[startTest] No questions in DB for subcategory ${subcategoryId}, level ${level}. Generating...`);
                const subcategory = await getSubcategoryById(subcategoryId);
                if (!subcategory) {
                    console.error(`[startTest] No subcategory found for id=${subcategoryId}`);
                    return null;
                }
                // Assuming category_id in subcategory table refers to id in categories table
                const categories = await getCategories(); // Fetch all categories
                const category = categories.find(cat => cat.id === subcategory.category_id);
                if (!category) {
                    console.error(`[startTest] No category found for category_id=${subcategory.category_id} (from subcategory ${subcategory.name})`);
                    return null;
                }

                // Determine question type based on category (example)
                let qType = 'multiple_choice';
                if (category.name.toLowerCase().includes('vocabulary')) {
                    // qType = 'fill_in_blank'; // Or mix them
                }
                
                let newQuestions;
                try {
                    newQuestions = await this.generateQuestions(category.name, subcategory.name, level, 5, qType); // Generate 5 questions
                } catch (genError) {
                    console.error(`[startTest] Gemini generation failed for ${category.name} - ${subcategory.name}: ${genError.message}`);
                    return null; // Critical failure, can't proceed
                }

                if (newQuestions && newQuestions.length > 0) {
                    console.log(`[startTest] Generated ${newQuestions.length} new questions from Gemini.`);
                    // TODO: Implement saveGeneratedQuestions in db.js
                    // This function should insert questions into your DB table, linking them to subcategoryId and level.
                    try {
                       await saveGeneratedQuestions(subcategoryId, level, newQuestions); // Pass level
                       console.log(`[startTest] Saved ${newQuestions.length} questions to DB for subcategory ${subcategoryId}, level ${level}.`);
                    } catch (dbSaveError) {
                       console.error(`[startTest] Failed to save generated questions to DB: ${dbSaveError.message}. Using them for this session only.`);
                    }
                    questions = newQuestions;
                } else {
                    console.log(`[startTest] Gemini returned no questions for ${category.name} - ${subcategory.name}.`);
                    return null; // No questions available
                }
            }

            if (!questions || questions.length === 0) {
                console.log(`[startTest] Still no questions after attempting generation for subcategory ${subcategoryId}, level ${level}.`);
                return null;
            }

            // Shuffle questions for variety if desired:
            // questions.sort(() => Math.random() - 0.5);


            this.userStates.set(userId, {
                ...this.userStates.get(userId), // Preserve focus, level, subcategoryId
                state: 'taking_test',
                currentQuestion: 0,
                questions: questions, // These are full question objects from DB or Gemini
                answers: [],
            });
            
            return this.getCurrentQuestionData(userId);
        } catch (error) {
            console.error(`[startTest] General error: ${error.message}`, error.stack);
            return null;
        }
    }

    // Renamed from getCurrentQuestion to avoid confusion, and to ensure it returns full data
    getCurrentQuestionData(userId) {
        const state = this.userStates.get(userId);
        if (!state || state.currentQuestion >= state.questions.length) {
            return null;
        }

        const question = state.questions[state.currentQuestion];
        return {
            text: question.question_text,
            type: question.question_type, // e.g., 'multiple_choice', 'fill_in_blank', 'true_false'
            options: question.options, // Array of strings for multiple_choice
            questionNumber: state.currentQuestion + 1,
            totalQuestions: state.questions.length
            // No need to return correct_answer to client here
        };
    }

    checkAnswer(userId, userAnswer) {
        const state = this.userStates.get(userId);
        if (!state || state.state !== 'taking_test' || state.currentQuestion >= state.questions.length) {
            console.error(`[checkAnswer] Invalid state for user ${userId} or question index out of bounds.`);
            return null;
        }

        const currentQuestionObject = state.questions[state.currentQuestion];
        let isCorrect;

        // Normalize answers for comparison
        const normalizedUserAnswer = userAnswer.trim().toLowerCase();
        const normalizedCorrectAnswer = String(currentQuestionObject.correct_answer).trim().toLowerCase(); // Ensure it's a string

        if (Array.isArray(currentQuestionObject.correct_answer)) { // If Gemini returns an array of correct answers
            isCorrect = currentQuestionObject.correct_answer.some(ans => String(ans).trim().toLowerCase() === normalizedUserAnswer);
        } else {
            isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
        }
        
        state.answers.push({
            question: currentQuestionObject.question_text, // For results display
            userAnswer: userAnswer,
            isCorrect: isCorrect,
            correctAnswer: currentQuestionObject.correct_answer, // For results display
            explanation: currentQuestionObject.explanation, // For results display
            example: currentQuestionObject.example // For results display
        });

        state.currentQuestion++; // Advance to the next question index

        const explanationOrCorrect = currentQuestionObject.explanation || currentQuestionObject.correct_answer;

        return {
            isCorrect,
            explanation_or_correct_answer: isCorrect ? "Correct!" : explanationOrCorrect,
            example: currentQuestionObject.example, // Send example even if correct, or only if incorrect
            nextQuestion: (state.currentQuestion < state.questions.length) ? this.getCurrentQuestionData(userId) : null
        };
    }

    async finishTest(userId) {
        const state = this.userStates.get(userId);
        if (!state) return null;

        const correctAnswersCount = state.answers.filter(a => a.isCorrect).length;
        const totalQuestions = state.questions.length;
        
        const wrongAnswersDetailed = state.answers
            .filter(a => !a.isCorrect)
            .map(a => ({ // Already have this structure from checkAnswer storage
                question: a.question,
                userAnswer: a.userAnswer,
                correctAnswer: a.correctAnswer,
                explanation: a.explanation,
                example: a.example
            }));

        try {
            // Ensure subcategoryId is available in state
            if (state.subcategoryId) {
                 await saveUserResult(userId, state.subcategoryId, correctAnswersCount, totalQuestions, JSON.stringify(wrongAnswersDetailed)); // Store wrong answers as JSON string
            } else {
                console.warn(`[finishTest] subcategoryId missing for user ${userId}, results not saved to DB history.`);
            }
        } catch (dbError) {
            console.error(`[finishTest] Error saving user result to DB: ${dbError.message}`);
        }
        
        const finalResults = {
            score: correctAnswersCount,
            totalQuestions,
            wrongAnswers: wrongAnswersDetailed
        };

        // Clean up state for this test
        this.userStates.delete(userId); // Or update state to 'finished_test' if you want to keep results temporarily

        return finalResults;
    }

    // ... (getUserTestHistory is fine)
}

module.exports = new EnglishTestService();