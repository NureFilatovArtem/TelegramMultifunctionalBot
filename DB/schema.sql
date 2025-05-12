-- Создание таблицы для категорий тестов
CREATE TABLE IF NOT EXISTS test_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы для подкатегорий тестов
CREATE TABLE IF NOT EXISTS test_subcategories (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES test_categories(id),
    name VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы для вопросов
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    subcategory_id INTEGER REFERENCES test_subcategories(id),
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('multiple_choice', 'text_input', 'fill_in_blank', 'true_false')),
    options JSONB, -- Для хранения вариантов ответов в формате JSON
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    example TEXT,
    difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы для результатов пользователей
CREATE TABLE IF NOT EXISTS user_results (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    test_id INTEGER REFERENCES test_subcategories(id),
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    wrong_answers JSONB, -- Хранение неправильных ответов в формате JSON
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание индексов для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_questions_subcategory ON questions(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_user_results_user ON user_results(user_id);
CREATE INDEX IF NOT EXISTS idx_user_results_test ON user_results(test_id);

-- Вставка базовых категорий
INSERT INTO test_categories (name, description) VALUES
('Grammar', 'English grammar tests'),
('Vocabulary', 'Vocabulary and word usage tests'),
('Tenses', 'Tests on different verb tenses'),
('Language Skills', 'Tests on various language skills')
ON CONFLICT DO NOTHING;

-- Вставка базовых подкатегорий
INSERT INTO test_subcategories (category_id, name, description) VALUES
(1, 'Present Simple', 'Tests on Present Simple tense'),
(1, 'Present Continuous', 'Tests on Present Continuous tense'),
(1, 'Past Simple', 'Tests on Past Simple tense'),
(1, 'Past Continuous', 'Tests on Past Continuous tense'),
(2, 'Idioms', 'Tests on English idioms'),
(2, 'Phrasal Verbs', 'Tests on phrasal verbs'),
(3, 'Present Perfect', 'Tests on Present Perfect tense'),
(3, 'Past Perfect', 'Tests on Past Perfect tense'),
(4, 'Reading Comprehension', 'Tests on reading and understanding texts')
ON CONFLICT DO NOTHING; 