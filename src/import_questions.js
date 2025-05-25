// import_questions.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') }); // Если запускаешь из папки со скриптами, а .env в корне
const fs = require('fs');
const { Pool } = require('pg'); // Используем pg напрямую для скрипта

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Функция для получения ID подкатегории по имени
async function getSubcategoryIdByName(name) {
    const res = await pool.query('SELECT id FROM subcategories WHERE name = $1', [name]);
    if (res.rows.length > 0) {
        return res.rows[0].id;
    }
    throw new Error(`Subcategory with name "${name}" not found.`);
}

async function importQuestions(filePath) {
    const client = await pool.connect();
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const questionsData = JSON.parse(fileContent);

        if (!Array.isArray(questionsData)) {
            throw new Error('JSON file should contain an array of questions.');
        }

        console.log(`Found ${questionsData.length} questions in the file.`);
        let importedCount = 0;
        let skippedCount = 0;

        await client.query('BEGIN');

        for (const q of questionsData) {
            if (!q.subcategory_name || !q.level || !q.question_text || !q.question_type || !q.correct_answer) {
                console.warn('Skipping question due to missing required fields:', q);
                skippedCount++;
                continue;
            }

            let subcategoryId;
            try {
                subcategoryId = await getSubcategoryIdByName(q.subcategory_name);
            } catch (err) {
                console.warn(`Skipping question: ${err.message}. Question: ${q.question_text.substring(0,30)}...`);
                skippedCount++;
                continue;
            }

            const insertQuery = `
                INSERT INTO questions (subcategory_id, level, question_text, question_type, options, correct_answer, explanation, example)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (subcategory_id, level, question_text) DO NOTHING
                RETURNING id;
            `;
            // ON CONFLICT (subcategory_id, level, question_text) DO NOTHING - чтобы не добавлять полные дубликаты

            const result = await client.query(insertQuery, [
                subcategoryId,
                q.level,
                q.question_text,
                q.question_type,
                q.options ? JSON.stringify(q.options) : null, // Убедимся, что options - это JSON строка или NULL
                q.correct_answer,
                q.explanation,
                q.example
            ]);

            if (result.rowCount > 0) {
                importedCount++;
            } else {
                console.log(`Question already exists (or other conflict), skipped: ${q.question_text.substring(0,30)}...`);
                skippedCount++;
            }
        }

        await client.query('COMMIT');
        console.log(`Successfully imported ${importedCount} questions.`);
        if (skippedCount > 0) {
            console.log(`Skipped ${skippedCount} questions (due to errors, missing fields, or duplicates).`);
        }

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error importing questions:', err);
    } finally {
        client.release();
    }
}

// Использование:
// 1. Создай файл, например, 'my_questions.json' в формате, описанном выше.
// 2. Укажи путь к файлу здесь:
const filePath = './my_questions.json'; // Путь к твоему JSON файлу с вопросами

if (require.main === module) { // Запускать только если скрипт вызван напрямую
    if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found at ${filePath}`);
        process.exit(1);
    }
    importQuestions(filePath)
        .then(() => {
            console.log('Import process finished.');
            pool.end(); // Закрываем пул соединений
        })
        .catch(err => {
            console.error('Unhandled error in import process:', err);
            pool.end();
        });
}

module.exports = { importQuestions, getSubcategoryIdByName }; // Экспортируем, если захочешь использовать из других мест