// DB/db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    // Рекомендуется добавить параметры для обработки ошибок и таймаутов
    // connectionTimeoutMillis: 5000, // время ожидания подключения
    // idleTimeoutMillis: 30000, // время простоя соединения перед закрытием
});

console.log("<<<<< LOADING DB/db.js FILE ... >>>>>");
async function saveGeneratedQuestions(subcategoryId, level, questionsArray) {
    if (!subcategoryId) {
        console.warn("[saveGeneratedQuestions] Attempted to save questions without subcategoryId. Skipping DB save.");
        return;
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const insertQuery = `
            INSERT INTO questions (subcategory_id, level, question_text, question_type, options, correct_answer, explanation, example)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (question_text, subcategory_id, level) DO NOTHING; 
        `; 
        // Убедитесь, что поле level в таблице questions МОЖЕТ БЫТЬ NULL, если для "Articles" level будет null
        // Или используйте специальное значение типа 'ALL_LEVELS' вместо null, если NULL не разрешен.

        for (const q of questionsArray) {
            const optionsToSave = Array.isArray(q.options) ? q.options : (q.options ? [q.options] : []);
            // Если для Articles уровень null, то передаем null, иначе level
            const levelToSave = (level === 'ALL' || !level) ? null : level; 

            await client.query(insertQuery, [
                subcategoryId,
                levelToSave, // Используем levelToSave
                q.question_text,
                q.question_type,
                JSON.stringify(optionsToSave),
                q.correct_answer,
                q.explanation,
                q.example
            ]);
        }
        await client.query('COMMIT');
        console.log(`[DB] Committed ${questionsArray.length} questions for subcategory ${subcategoryId}, level ${level || 'ALL'}.`);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('[DB] Error saving generated questions, rolled back:', e.message);
        throw e;
    } finally {
        client.release();
    }
}

// Проверка подключения
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
    } else {
        console.log('Successfully connected to database');
        release();
    }
});

// Функции для работы с категориями
const getCategories = async () => {
    try {
        const result = await pool.query('SELECT * FROM test_categories ORDER BY name');
        return result.rows;
    } catch (err) {
        console.error('Error getting categories:', err);
        throw err; // Важно пробрасывать ошибку, чтобы ее можно было обработать выше
    }
};

// Функции для работы с подкатегориями
const getSubcategories = async (categoryId) => {
    try {
        const result = await pool.query(
            'SELECT * FROM test_subcategories WHERE category_id = $1 ORDER BY name',
            [categoryId]
        );
        return result.rows;
    } catch (err) {
        console.error('Error getting subcategories:', err);
        throw err;
    }
};

const getSubcategoryById = async (subcategoryId) => {
    try {
        const result = await pool.query(
            'SELECT * FROM test_subcategories WHERE id = $1',
            [subcategoryId]
        );
        return result.rows[0]; // Возвращаем первую строку или undefined, если не найдено
    } catch (err) {
        console.error('Error getting subcategory by id:', err);
        throw err;
    }
};

// НОВАЯ ФУНКЦИЯ: Получение подкатегории по имени
const getSubcategoryByName = async (name) => {
    try {
        const result = await pool.query(
            'SELECT * FROM test_subcategories WHERE name ILIKE $1', // ILIKE для регистронезависимого поиска
            [name]
        );
        return result.rows[0]; // Возвращаем первую строку или undefined
    } catch (err) {
        console.error('Error getting subcategory by name:', err);
        throw err;
    }
};

// Получение вопросов
async function getQuestions(subcategoryId, level, limit = 20) {
    try {
        let queryText;
        let queryParams;

        if (level && level !== 'ALL') { // Если уровень указан и это не специальный маркер "ALL"
            queryText = 'SELECT * FROM questions WHERE subcategory_id = $1 AND level = $2 ORDER BY RANDOM() LIMIT $3';
            queryParams = [subcategoryId, level, limit];
        } else { // Если уровень не указан или "ALL", берем все уровни для данной подкатегории
            queryText = 'SELECT * FROM questions WHERE subcategory_id = $1 ORDER BY RANDOM() LIMIT $2';
            queryParams = [subcategoryId, limit];
            console.log(`[DB getQuestions] Fetching questions for subcategory ${subcategoryId} across all levels (limit ${limit}).`);
        }
        
        const { rows } = await pool.query(queryText, queryParams);
        return rows;
    } catch (err) {
        console.error('Error getting questions:', err);
        throw err;
    }
}

// Функции для работы с результатами
const saveUserResult = async (userId, subcategoryId, score, totalQuestions, wrongAnswersJson) => {
    // Примечание: test_id в вашей таблице user_results может быть subcategory_id
    // Убедитесь, что это соответствует вашей структуре. Переименовал testId на subcategoryId для ясности.
    try {
        const result = await pool.query(
            'INSERT INTO user_results (user_id, test_id, score, total_questions, wrong_answers) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [userId, subcategoryId, score, totalQuestions, wrongAnswersJson]
        );
        return result.rows[0];
    } catch (err) {
        console.error('Error saving user result:', err);
        throw err;
    }
};

const getUserResults = async (userId) => {
    try {
        const result = await pool.query(
            'SELECT ur.*, ts.name as subcategory_name FROM user_results ur JOIN test_subcategories ts ON ur.test_id = ts.id WHERE ur.user_id = $1 ORDER BY ur.completed_at DESC',
            [userId]
        ); // Добавил JOIN для имени подкатегории, если нужно
        return result.rows;
    } catch (err) {
        console.error('Error getting user results:', err);
        throw err;
    }
};


// Функции для сохранения прогресса (если будете использовать)
const saveUserTestProgress = async (userId, subcategoryId, currentQuestionIndex, answersArray, isActive = true) => {
    try {
        const existing = await pool.query(
            'SELECT id FROM user_test_progress WHERE user_id = $1 AND subcategory_id = $2 AND is_active = TRUE',
            [userId, subcategoryId]
        );
        if (existing.rows.length > 0) {
            await pool.query(
                'UPDATE user_test_progress SET current_question_index = $1, answers = $2, updated_at = NOW() WHERE id = $3',
                [currentQuestionIndex, JSON.stringify(answersArray), existing.rows[0].id]
            );
        } else {
            await pool.query(
                'INSERT INTO user_test_progress (user_id, subcategory_id, current_question_index, answers, is_active) VALUES ($1, $2, $3, $4, $5)',
                [userId, subcategoryId, currentQuestionIndex, JSON.stringify(answersArray), isActive]
            );
        }
    } catch (err) {
        console.error('Error saving user test progress:', err);
        // Не пробрасываем ошибку, чтобы не прерывать основной флоу, но логируем
    }
};

const getUserTestProgress = async (userId, subcategoryId) => {
    try {
        const result = await pool.query(
            'SELECT * FROM user_test_progress WHERE user_id = $1 AND subcategory_id = $2 AND is_active = TRUE',
            [userId, subcategoryId]
        );
        if (result.rows[0] && result.rows[0].answers) {
            result.rows[0].answers = JSON.parse(result.rows[0].answers); // Парсим JSON обратно в массив
        }
        return result.rows[0];
    } catch (err) {
        console.error('Error getting user test progress:', err);
        return null; // Возвращаем null при ошибке, чтобы не прерывать
    }
};

const deactivateUserTestProgress = async (userId, subcategoryId) => {
    try {
        await pool.query(
            'UPDATE user_test_progress SET is_active = FALSE, updated_at = NOW() WHERE user_id = $1 AND subcategory_id = $2 AND is_active = TRUE',
            [userId, subcategoryId]
        );
    } catch (err) {
        console.error('Error deactivating user test progress:', err);
    }
};

// Сохранение сгенерированных вопросов
async function saveGeneratedQuestions(subcategoryId, level, questionsArray) {
    if (!subcategoryId) {
        console.warn("[saveGeneratedQuestions] Attempted to save questions without subcategoryId. Skipping DB save.");
        return;
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Важно: ON CONFLICT требует уникального индекса.
        // Если у вас нет уникального индекса на (question_text, subcategory_id, level),
        // то ON CONFLICT (question_text, subcategory_id, level) DO NOTHING не сработает как ожидается
        // или вызовет ошибку, если такого constraint нет.
        // Создайте уникальный индекс:
        // CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_question ON questions (md5(question_text), subcategory_id, level);
        // (md5(question_text) если question_text слишком длинный для прямого индексирования)
        // Или просто вставляйте, а дубликаты будут ошибкой (если есть constraint) или просто добавятся.
        // Для безопасности пока уберу ON CONFLICT, если нет уверенности в индексе.
        // Лучше добавить обработку дубликатов на уровне приложения перед вставкой или положиться на constraint БД.
        const insertQuery = `
            INSERT INTO questions (subcategory_id, level, question_text, question_type, options, correct_answer, explanation, example)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (question_text, subcategory_id, level) DO NOTHING; 
        `;
        // Убедитесь, что у вас есть уникальный constraint:
        // ALTER TABLE questions ADD CONSTRAINT unique_question_text_subcategory_level UNIQUE (question_text, subcategory_id, level);

        for (const q of questionsArray) {
            // Убедимся, что options это массив, даже если Gemini вернет null или не вернет
            const optionsToSave = Array.isArray(q.options) ? q.options : (q.options ? [q.options] : []);

            await client.query(insertQuery, [
                subcategoryId,
                level,
                q.question_text,
                q.question_type,
                JSON.stringify(optionsToSave), // Убедимся, что это массив
                q.correct_answer,
                q.explanation,
                q.example
            ]);
        }
        await client.query('COMMIT');
        console.log(`[DB] Committed ${questionsArray.length} questions for subcategory ${subcategoryId}, level ${level}.`);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('[DB] Error saving generated questions, rolled back:', e.message);
        throw e; // Пробрасываем ошибку для обработки в сервисе
    } finally {
        client.release();
    }
}


module.exports = {
    pool,
    getCategories,
    getSubcategories,     // <--- Раскомментируй/добавь
    getQuestions,
    saveUserResult,
    getUserResults,
    getSubcategoryById,
    getSubcategoryByName, // <--- Убедись, что есть и правильно названа
    saveUserTestProgress,
    getUserTestProgress,
    deactivateUserTestProgress,
    saveGeneratedQuestions
};
