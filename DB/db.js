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

// Функции для работы с вопросами
const getQuestions = async (subcategoryId, limit = 10) => {
    try {
        const result = await pool.query(
            'SELECT * FROM questions WHERE subcategory_id = $1 ORDER BY RANDOM() LIMIT $2',
            [subcategoryId, limit]
        );
        return result.rows;
    } catch (err) {
        console.error('Error getting questions:', err);
        throw err;
    }
};

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

module.exports = {
    pool,
    getCategories,
    getSubcategories,
    getQuestions,
    saveUserResult,
    getUserResults
}; 