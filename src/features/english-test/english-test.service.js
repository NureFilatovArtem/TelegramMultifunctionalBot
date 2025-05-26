// src/features/english-test/english-test.service.js
const { getCategories, getSubcategories, saveUserResult, getSubcategoryByName } = require('../../DB/db'); // Убедись, что db.js в src/DB
// Убраны getQuestions, getSubcategoryById, saveGeneratedQuestions, так как мы их больше не используем напрямую для вопросов
// const { generateQuestionsGemini } = require('./gemini.service'); // Отключено, если не используется
const fs = require('fs');
const path = require('path');

const MY_QUESTIONS_PATH = path.join(__dirname, '../../../my_questions.json');
let localQuestionsCache = null;

function loadLocalQuestions() {
    if (localQuestionsCache !== null) { return localQuestionsCache; }
    try {
        if (fs.existsSync(MY_QUESTIONS_PATH)) {
            const jsonData = fs.readFileSync(MY_QUESTIONS_PATH, 'utf-8');
            localQuestionsCache = JSON.parse(jsonData);
            if (!Array.isArray(localQuestionsCache)) {
                console.error("[Service ERROR] Parsed data from my_questions.json is NOT an array. Setting cache to empty array.");
                localQuestionsCache = [];
            }
            console.log(`[Service LOG] Loaded ${localQuestionsCache.length} questions from my_questions.json`);
            return localQuestionsCache;
        } else {
            console.warn(`[Service WARN] my_questions.json not found at ${MY_QUESTIONS_PATH}`);
            localQuestionsCache = []; return [];
        }
    } catch (error) {
        console.error(`[Service ERROR] Failed to load or parse my_questions.json: ${error.message}`);
        localQuestionsCache = []; return [];
    }
}

function getGeneralCategoryForSubcategory(subcategoryName) {
    const subNameLower = subcategoryName.toLowerCase();
    const grammarSubcategories = ["present simple", "past simple", "present continuous", "past continuous", "present perfect", "future simple", "conditionals", "reported speech", "passive voice", "modal verbs"];
    const vocabularySubcategories = ["articles", "idioms", "phrasal verbs", "prepositions", "adjectives and adverbs", "collocations", "synonyms"];
    if (grammarSubcategories.includes(subNameLower)) return "Grammar";
    if (vocabularySubcategories.includes(subNameLower)) return "Vocabulary";
    return "Other";
}

class EnglishTestService {
    constructor() {
        this.userStates = new Map();
        loadLocalQuestions();
    }

    getQuestionsFromJsonOnly(subcategoryName, requestedCount, userFocus = null) {
        const allLocalQuestions = loadLocalQuestions();
        if (!allLocalQuestions || allLocalQuestions.length === 0) { console.log(`[getQuestionsFromJsonOnly LOG] No local questions in cache.`); return [];}

        const targetSubcategoryName = subcategoryName.trim().toLowerCase();
        console.log(`[getQuestionsFromJsonOnly LOG] Filtering JSON for subcategory: "${targetSubcategoryName}", requested: ${requestedCount}`);

        let primaryFilteredQuestions = allLocalQuestions.filter(q => {
            if (!q || typeof q.subcategory_name !== 'string' || q.question_type === 'fill_in_blank') return false; // Исключаем fill_in_blank
            return q.subcategory_name.trim().toLowerCase() === targetSubcategoryName;
        });
        
        console.log(`[getQuestionsFromJsonOnly LOG] Found ${primaryFilteredQuestions.length} primary questions for "${targetSubcategoryName}".`);

        if (primaryFilteredQuestions.length < requestedCount && userFocus) {
            const neededMore = requestedCount - primaryFilteredQuestions.length;
            console.log(`[getQuestionsFromJsonOnly LOG] Not enough primary. Need ${neededMore} more. User focus: ${userFocus}`);
            const generalCategoryTarget = userFocus.toLowerCase();
            const supplementaryQuestions = allLocalQuestions.filter(q => {
                if (!q || typeof q.subcategory_name !== 'string' || q.question_type === 'fill_in_blank') return false;
                if (q.subcategory_name.trim().toLowerCase() === targetSubcategoryName) return false; 
                return getGeneralCategoryForSubcategory(q.subcategory_name).toLowerCase() === generalCategoryTarget;
            });
            console.log(`[getQuestionsFromJsonOnly LOG] Found ${supplementaryQuestions.length} supplementary questions from general category "${userFocus}".`);
            if (supplementaryQuestions.length > 0) {
                supplementaryQuestions.sort(() => Math.random() - 0.5);
                primaryFilteredQuestions = primaryFilteredQuestions.concat(supplementaryQuestions.slice(0, neededMore));
            }
        }

        if (primaryFilteredQuestions.length > 0) {
            primaryFilteredQuestions.sort(() => Math.random() - 0.5);
            return primaryFilteredQuestions.slice(0, requestedCount);
        }
        return [];
    }
    
    async getSubcategoriesMenu(categoryId) {
        // Используем БД только для существующих там подкатегорий, остальное - из JSON
        let dbSubcategories = [];
        try {
            dbSubcategories = await getSubcategories(categoryId);
        } catch (dbError) {
            console.warn(`[getSubcategoriesMenu] Could not fetch subcategories from DB for categoryId ${categoryId}: ${dbError.message}. Relying on JSON.`);
        }

        let subcategoryButtons = [];
        if (dbSubcategories && Array.isArray(dbSubcategories)) {
             subcategoryButtons = dbSubcategories.map(sub => ({ text: sub.name, callback_data: `eng_subcat_${sub.name.replace(/\s+/g, '_')}`}));
        }
        
        const allJsonQuestions = loadLocalQuestions();
        const jsonSubcategories = new Set();
        if(allJsonQuestions && Array.isArray(allJsonQuestions)){
            allJsonQuestions.forEach(q => {
                if(!q || !q.subcategory_name || q.question_type === 'fill_in_blank') return; // Не добавляем fill_in_blank в меню
                const generalCat = getGeneralCategoryForSubcategory(q.subcategory_name);
                if ((categoryId === 1 && generalCat === "Grammar") || (categoryId === 2 && generalCat === "Vocabulary")) {
                    jsonSubcategories.add(q.subcategory_name.trim());
                }
            });
        }
        jsonSubcategories.forEach(jsonSubName => { if (!subcategoryButtons.some(btn => btn.text.toLowerCase() === jsonSubName.toLowerCase())) { subcategoryButtons.push({ text: jsonSubName, callback_data: `eng_subcat_${jsonSubName.replace(/\s+/g, '_')}`});}});
        const uniqueSubcategoryButtons = []; const seenTexts = new Set();
        for (const btn of subcategoryButtons) { if (!seenTexts.has(btn.text)) { uniqueSubcategoryButtons.push(btn); seenTexts.add(btn.text);}}
        console.log(`[getSubcategoriesMenu] Formed ${uniqueSubcategoryButtons.length} unique subcategory buttons for categoryId ${categoryId}.`);
        return uniqueSubcategoryButtons.sort((a,b) => a.text.localeCompare(b.text));
    }

    async startTest(userId, subcategoryName, levelInput, questionCount = 5) {
        try {
            const userState = this.userStates.get(userId) || {};
            const userFocus = userState.focus; 

            console.log(`[startTest LOG] User ${userId}, Subcat: "${subcategoryName}", Level IN: ${levelInput} (ignored for JSON), QCount: ${questionCount}, UserFocus: ${userFocus}`);
            
            let questions = this.getQuestionsFromJsonOnly(subcategoryName, questionCount, userFocus);
            console.log(`[startTest LOG] From JSON (level ignored, with possible category supplement): ${questions.length} questions for "${subcategoryName}".`);

            if (questions.length === 0) {
                console.log(`[startTest WARN] No questions available in my_questions.json for "${subcategoryName}".`);
                return null; 
            }
            
            if (questions.length < questionCount && questions.length > 0) {
                console.warn(`[startTest WARN] Only ${questions.length} questions available from JSON for "${subcategoryName}", though ${questionCount} were requested.`);
            }

            this.userStates.set(userId, {
                ...userState, 
                subcategoryName: subcategoryName,
                questionCount: questions.length, 
                state: 'taking_test',
                currentQuestion: 0,
                questions: questions,
                answers: [],
            });
            
            return this.getCurrentQuestionData(userId); // <--- ВЫЗОВ ВОССТАНОВЛЕННОГО МЕТОДА

        } catch (error) {
            console.error(`[startTest ERROR] General error in startTest: ${error.message}`, error.stack);
            return null;
        }
    }

    // <<<<< НАЧАЛО ВОССТАНОВЛЕННЫХ МЕТОДОВ >>>>>
    getCurrentQuestionData(userId) {
        const state = this.userStates.get(userId);
        if (!state || !state.questions || state.currentQuestion >= state.questions.length) { return null; }
        const question = state.questions[state.currentQuestion];
         // Убедимся, что options - это массив, если его нет или он null из JSON
        const options = (Array.isArray(question.options) && question.options.length > 0) ? question.options : [];
        if (question.question_type === 'multiple_choice' && options.length === 0) { // Изменено с question.type на question.question_type
            console.warn(`[getCurrentQuestionData WARN] Multiple choice question has no options: ${question.question_text}`);
        }
        return { text: question.question_text, type: question.question_type, options: options, questionNumber: state.currentQuestion + 1, totalQuestions: state.questionCount };
    }

    checkAnswer(userId, userAnswer) {
        const state = this.userStates.get(userId);
        if (!state || state.state !== 'taking_test' || !state.questions || state.currentQuestion >= state.questions.length) { console.error(`[checkAnswer] Invalid state for user ${userId}.`); return null; }
        const currentQuestionObject = state.questions[state.currentQuestion];
        if (!currentQuestionObject) { console.error(`[checkAnswer] currentQuestionObject is undefined for user ${userId}, qIndex ${state.currentQuestion}`); return null; }
        
        let isCorrect;
        const normalizedUserAnswer = userAnswer.trim().toLowerCase();
        const normalizedCorrectAnswer = String(currentQuestionObject.correct_answer).trim().toLowerCase();
        
        if (Array.isArray(currentQuestionObject.correct_answer)) { isCorrect = currentQuestionObject.correct_answer.some(ans => String(ans).trim().toLowerCase() === normalizedUserAnswer);
        } else { isCorrect = normalizedUserAnswer === normalizedCorrectAnswer; }
        
        state.answers.push({ 
            question: currentQuestionObject.question_text, 
            userAnswer: userAnswer, 
            isCorrect: isCorrect, 
            correctAnswer: currentQuestionObject.correct_answer, 
            explanation: currentQuestionObject.explanation, 
            example: currentQuestionObject.example 
        });
        state.currentQuestion++;
        const explanationOrCorrect = currentQuestionObject.explanation || currentQuestionObject.correct_answer;
        return { 
            isCorrect, 
            explanation_or_correct_answer: isCorrect ? "Correct!" : explanationOrCorrect, 
            example: currentQuestionObject.example, 
            nextQuestion: (state.currentQuestion < state.questions.length) ? this.getCurrentQuestionData(userId) : null 
        };
    }

    async finishTest(userId) {
        const state = this.userStates.get(userId);
        if (!state || !state.questions) { console.warn(`[finishTest] No valid state/questions for user ${userId}.`); return null; }
        
        const correctAnswersCount = state.answers.filter(a => a.isCorrect).length;
        const totalQuestionsInTest = state.questionCount;
        const wrongAnswersDetailed = state.answers
            .filter(a => !a.isCorrect)
            .map(a => ({ 
                question: a.question, 
                userAnswer: a.userAnswer, 
                correctAnswer: a.correctAnswer, 
                explanation: a.explanation, 
                example: a.example 
            }));
        
        try {
            let subcategoryDB = await getSubcategoryByName(state.subcategoryName).catch(err => { 
                console.warn(`[finishTest WARN] Error fetching subcat by name for saving results: ${err.message}`); 
                return null;
            });
            if (subcategoryDB && subcategoryDB.id) {
                 await saveUserResult(userId, subcategoryDB.id, correctAnswersCount, totalQuestionsInTest, JSON.stringify(wrongAnswersDetailed));
                 console.log(`[finishTest LOG] Saved results for user ${userId}, subcategory "${state.subcategoryName}" (ID: ${subcategoryDB.id})`);
            } else { 
                console.warn(`[finishTest WARN] subcategory ID for '${state.subcategoryName}' not found in DB, results not saved to DB history.`); 
            }
        } catch (dbError) { 
            console.error(`[finishTest ERROR] Error saving user result: ${dbError.message}`); 
        }
        
        const finalResults = { 
            score: correctAnswersCount, 
            totalQuestions: totalQuestionsInTest, 
            wrongAnswers: wrongAnswersDetailed 
        };
        this.userStates.delete(userId);
        return finalResults;
    }
    // <<<<< КОНЕЦ ВОССТАНОВЛЕННЫХ МЕТОДОВ >>>>>
}
module.exports = new EnglishTestService();