const { getCategories, getSubcategories, getQuestions, saveUserResult, getUserResults, getSubcategoryById } = require('../../../src/DB/db');
const { generateQuestionsGemini } = require('./gemini.service');

class EnglishTestService {
    constructor() {
        this.userStates = new Map();
    }

    // Генерация вопросов через Gemini
    async generateQuestions(category, subcategory, level = 'B1', count = 5) {
        return await generateQuestionsGemini(category, subcategory, level, count);
    }

    // Получение меню категорий
    async getCategoriesMenu() {
        const categories = await getCategories();
        return categories.map(cat => ({
            text: cat.name,
            callback_data: `english_category_${cat.id}`
        }));
    }

    // Получение меню подкатегорий
    async getSubcategoriesMenu(categoryId) {
        const subcategories = await getSubcategories(categoryId);
        return subcategories.map(sub => ({
            text: sub.name,
            callback_data: `english_subcategory_${sub.id}`
        }));
    }

    // Начало теста
    async startTest(userId, subcategoryId, level = 'B1') {
        let questions = await getQuestions(subcategoryId);
        if (questions.length === 0) {
            // Получаем одну подкатегорию по её id
            const subcategory = await getSubcategoryById(subcategoryId);
            if (!subcategory) {
                console.error(`[startTest] No subcategory found for id=${subcategoryId}`);
                return null;
            }
            const categories = await getCategories();
            const category = categories.find(cat => cat.id === subcategory.category_id);
            if (!category) {
                console.error(`[startTest] No category found for id=${subcategory.category_id}`);
                return null;
            }
            const newQuestions = await this.generateQuestions(category.name, subcategory.name, level);
            // TODO: Сохранить новые вопросы в базу данных
            questions = newQuestions;
        }

        this.userStates.set(userId, {
            state: 'taking_test',
            currentQuestion: 0,
            questions: questions,
            answers: [],
            subcategoryId: subcategoryId
        });

        return this.getCurrentQuestion(userId);
    }

    // Получение текущего вопроса
    getCurrentQuestion(userId) {
        const state = this.userStates.get(userId);
        if (!state || state.currentQuestion >= state.questions.length) {
            return null;
        }

        const question = state.questions[state.currentQuestion];
        return {
            text: question.question_text,
            type: question.question_type,
            options: question.options,
            questionNumber: state.currentQuestion + 1,
            totalQuestions: state.questions.length
        };
    }

    // Проверка ответа
    checkAnswer(userId, answer) {
        const state = this.userStates.get(userId);
        if (!state) return null;

        const currentQuestion = state.questions[state.currentQuestion];
        const isCorrect = answer.toLowerCase() === currentQuestion.correct_answer.toLowerCase();
        
        state.answers.push({
            question: currentQuestion,
            userAnswer: answer,
            isCorrect: isCorrect
        });

        state.currentQuestion++;

        if (state.currentQuestion >= state.questions.length) {
            return this.finishTest(userId);
        }

        return {
            isCorrect,
            explanation: isCorrect ? null : currentQuestion.explanation,
            example: isCorrect ? null : currentQuestion.example,
            nextQuestion: this.getCurrentQuestion(userId)
        };
    }

    // Завершение теста
    async finishTest(userId) {
        const state = this.userStates.get(userId);
        if (!state) return null;

        const correctAnswers = state.answers.filter(a => a.isCorrect).length;
        const totalQuestions = state.questions.length;
        const wrongAnswers = state.answers
            .filter(a => !a.isCorrect)
            .map(a => ({
                question: a.question.question_text,
                correctAnswer: a.question.correct_answer,
                userAnswer: a.userAnswer,
                explanation: a.question.explanation,
                example: a.question.example
            }));

        // Сохраняем результат
        await saveUserResult(userId, state.subcategoryId, correctAnswers, totalQuestions, wrongAnswers);

        // Очищаем состояние
        this.userStates.delete(userId);

        return {
            score: correctAnswers,
            totalQuestions,
            wrongAnswers
        };
    }

    // Получение результатов пользователя
    async getUserTestHistory(userId) {
        return await getUserResults(userId);
    }
}

module.exports = new EnglishTestService(); 