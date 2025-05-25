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

-- Таблица для хранения прогресса пользователя по тесту
CREATE TABLE IF NOT EXISTS user_test_progress (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    subcategory_id INTEGER REFERENCES test_subcategories(id),
    current_question INTEGER NOT NULL,
    answers JSONB NOT NULL, -- [{question_id, user_answer, is_correct}]
    is_active BOOLEAN DEFAULT TRUE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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


-- Если таблица questions уже существует и нужно ее изменить:
ALTER TABLE questions
    ADD COLUMN IF NOT EXISTS level VARCHAR(10) NOT NULL DEFAULT 'B1', -- Ставим DEFAULT на время миграции, потом можно убрать
    ADD COLUMN IF NOT EXISTS question_type VARCHAR(50) NOT NULL DEFAULT 'multiple_choice', -- Аналогично
    ADD COLUMN IF NOT EXISTS example TEXT NULL;

-- Если options сейчас TEXT, и хотим перевести в JSONB (сначала убедись, что данные валидный JSON или сделай бэкап)
-- ALTER TABLE questions
--     ALTER COLUMN options TYPE JSONB USING options::jsonb;
-- Если options еще нет, или создаем заново:
-- options JSONB NULL,

-- Если создаем таблицу questions с нуля (или пересоздаем):
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    subcategory_id INTEGER NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE, -- ON DELETE CASCADE если хочешь, чтобы при удалении подкатегории удалялись и ее вопросы
    level VARCHAR(10) NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL, -- 'multiple_choice', 'fill_in_blank', 'true_false'
    options JSONB NULL, -- Для multiple_choice, true/false. Для fill_in_blank может быть NULL
    correct_answer TEXT NOT NULL,
    explanation TEXT NULL,
    example TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Полезно для отслеживания
    CONSTRAINT uq_question_per_subcategory_level UNIQUE (subcategory_id, level, question_text) -- Предотвращает полные дубликаты
);

CREATE INDEX IF NOT EXISTS idx_questions_subcategory_level ON questions (subcategory_id, level); -- Индекс для быстрого поиска по теме и уровню