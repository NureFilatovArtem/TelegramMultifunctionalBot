-- Примеры вопросов для Present Simple
INSERT INTO questions (subcategory_id, question_text, question_type, options, correct_answer, explanation, example, difficulty) VALUES
(1, 'She ___ to work every day.', 'fill_in_blank', NULL, 'goes', 'В Present Simple для 3-го лица единственного числа добавляем окончание -s/-es', 'She goes to work every day.', 1),
(1, 'What is the correct form of the verb in Present Simple for "he"?', 'multiple_choice', 
    '["go", "goes", "going", "went"]', 'goes', 
    'В Present Simple для 3-го лица единственного числа (he/she/it) добавляем окончание -s/-es', 
    'He goes to school every day.', 1),
(1, 'They ___ English every day.', 'fill_in_blank', NULL, 'study', 
    'В Present Simple для множественного числа (they) используем базовую форму глагола', 
    'They study English every day.', 1);

-- Примеры вопросов для Present Continuous
INSERT INTO questions (subcategory_id, question_text, question_type, options, correct_answer, explanation, example, difficulty) VALUES
(2, 'What is happening now?', 'multiple_choice', 
    '["I am writing", "I write", "I wrote", "I will write"]', 'I am writing', 
    'Present Continuous используется для действий, происходящих в момент речи', 
    'I am writing a letter now.', 1),
(2, 'She ___ a book right now.', 'fill_in_blank', NULL, 'is reading', 
    'В Present Continuous используем am/is/are + глагол с окончанием -ing', 
    'She is reading a book right now.', 1);

-- Примеры вопросов для Idioms
INSERT INTO questions (subcategory_id, question_text, question_type, options, correct_answer, explanation, example, difficulty) VALUES
(5, 'What does the idiom "break a leg" mean?', 'multiple_choice', 
    '["To break someone''s leg", "Good luck", "To run fast", "To dance"]', 'Good luck', 
    '"Break a leg" is a theatrical idiom meaning "good luck"', 
    'Before the performance, the director said "break a leg" to the actors.', 2),
(5, 'Complete the idiom: "It''s raining ___"', 'fill_in_blank', NULL, 'cats and dogs', 
    'The idiom "it''s raining cats and dogs" means it''s raining very heavily', 
    'We can''t go out now, it''s raining cats and dogs!', 2);

-- Примеры вопросов для Phrasal Verbs
INSERT INTO questions (subcategory_id, question_text, question_type, options, correct_answer, explanation, example, difficulty) VALUES
(6, 'What does "give up" mean?', 'multiple_choice', 
    '["To give something to someone", "To stop doing something", "To stand up", "To wake up"]', 'To stop doing something', 
    '"Give up" means to stop doing something, especially something that you do regularly', 
    'He gave up smoking last year.', 2),
(6, 'Complete the phrasal verb: "I need to ___ up early tomorrow"', 'fill_in_blank', NULL, 'wake', 
    '"Wake up" means to stop sleeping', 
    'I need to wake up early tomorrow for my meeting.', 1); 