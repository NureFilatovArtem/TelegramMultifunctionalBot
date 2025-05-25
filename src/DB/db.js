const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

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
        throw err;
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

// Примерно так:
async function getQuestions(subcategoryId, level) {
    const query = 'SELECT * FROM questions WHERE subcategory_id = $1 AND level = $2 ORDER BY RANDOM() LIMIT 20'; // Добавлен level и LIMIT
    const { rows } = await pool.query(query, [subcategoryId, level]);
    return rows;
}

// Функции для работы с результатами
const saveUserResult = async (userId, testId, score, totalQuestions, wrongAnswers) => {
    try {
        const result = await pool.query(
            'INSERT INTO user_results (user_id, test_id, score, total_questions, wrong_answers) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [userId, testId, score, totalQuestions, wrongAnswers]
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
            'SELECT * FROM user_results WHERE user_id = $1 ORDER BY completed_at DESC',
            [userId]
        );
        return result.rows;
    } catch (err) {
        console.error('Error getting user results:', err);
        throw err;
    }
};

const getSubcategoryById = async (subcategoryId) => {
    try {
        const result = await pool.query(
            'SELECT * FROM test_subcategories WHERE id = $1',
            [subcategoryId]
        );
        return result.rows[0];
    } catch (err) {
        console.error('Error getting subcategory by id:', err);
        throw err;
    }
};

// Сохранить/обновить прогресс пользователя
const saveUserTestProgress = async (userId, subcategoryId, currentQuestion, answers, isActive = true) => {
    try {
        // Проверяем, есть ли уже активный прогресс
        const existing = await pool.query(
            'SELECT id FROM user_test_progress WHERE user_id = $1 AND subcategory_id = $2 AND is_active = TRUE',
            [userId, subcategoryId]
        );
        if (existing.rows.length > 0) {
            // Обновляем
            await pool.query(
                'UPDATE user_test_progress SET current_question = $1, answers = $2, updated_at = NOW() WHERE id = $3',
                [currentQuestion, JSON.stringify(answers), existing.rows[0].id]
            );
        } else {
            // Вставляем
            await pool.query(
                'INSERT INTO user_test_progress (user_id, subcategory_id, current_question, answers, is_active) VALUES ($1, $2, $3, $4, $5)',
                [userId, subcategoryId, currentQuestion, JSON.stringify(answers), isActive]
            );
        }
    } catch (err) {
        console.error('Error saving user test progress:', err);
        throw err;
    }
};

// Получить прогресс пользователя
const getUserTestProgress = async (userId, subcategoryId) => {
    try {
        const result = await pool.query(
            'SELECT * FROM user_test_progress WHERE user_id = $1 AND subcategory_id = $2 AND is_active = TRUE',
            [userId, subcategoryId]
        );
        return result.rows[0];
    } catch (err) {
        console.error('Error getting user test progress:', err);
        throw err;
    }
};

// Деактивировать прогресс (при завершении теста или смене фокуса)
const deactivateUserTestProgress = async (userId, subcategoryId) => {
    try {
        await pool.query(
            'UPDATE user_test_progress SET is_active = FALSE, updated_at = NOW() WHERE user_id = $1 AND subcategory_id = $2 AND is_active = TRUE',
            [userId, subcategoryId]
        );
    } catch (err) {
        console.error('Error deactivating user test progress:', err);
        throw err;
    }
};


async function saveGeneratedQuestions(subcategoryId, level, questionsArray) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const insertQuery = `
            INSERT INTO questions (subcategory_id, level, question_text, question_type, options, correct_answer, explanation, example)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (question_text, subcategory_id, level) DO NOTHING; 
        `; // ON CONFLICT чтобы избежать дубликатов, если текст вопроса + подкатегория + уровень уникальны

        for (const q of questionsArray) {
            await client.query(insertQuery, [
                subcategoryId,
                level,
                q.question_text,
                q.question_type,
                JSON.stringify(q.options || []), // Сохраняем как JSON строку
                q.correct_answer,
                q.explanation,
                q.example
            ]);
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

module.exports = {
    pool,
    getCategories,
    getSubcategories,
    getQuestions,
    saveUserResult,
    getUserResults,
    getSubcategoryById,
    saveUserTestProgress,
    getUserTestProgress,
    deactivateUserTestProgress,
    saveGeneratedQuestions 
}; 