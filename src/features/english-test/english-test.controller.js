const { Markup } = require('telegraf');
const englishTestService = require('./english-test.service');

class EnglishTestController {
    constructor(bot) {
        this.bot = bot;
        // No need to call setupHandlers here if register function does it
    }

    setupHandlers() {
        // Кнопка English Improvement в главном меню
        this.bot.action('english_improvement', async (ctx) => {
            try {
                await ctx.answerCbQuery();
                await ctx.editMessageText('What do you want to improve?', Markup.inlineKeyboard([ // Use editMessageText if coming from another inline keyboard
                    [Markup.button.callback('Grammar', 'english_grammar')],
                    [Markup.button.callback('Vocabulary', 'english_vocabulary')]
                ])).catch(async () => { // Fallback if not editable (e.g. first message)
                     await ctx.reply('What do you want to improve?', Markup.inlineKeyboard([
                        [Markup.button.callback('Grammar', 'english_grammar')],
                        [Markup.button.callback('Vocabulary', 'english_vocabulary')]
                    ]));
                });
            } catch (err) {
                console.error('[english_improvement] Error:', err);
                await ctx.reply('Error processing your request.').catch(e => console.error("Reply error", e));
            }
        });

        // Выбор направления (Grammar/Vocabulary)
        this.bot.action(/english_(grammar|vocabulary)/, async (ctx) => {
            try {
                await ctx.answerCbQuery();
                const focus = ctx.match[1];
                let userState = englishTestService.userStates.get(ctx.from.id) || {};
                userState.focus = focus;
                englishTestService.userStates.set(ctx.from.id, userState);

                if (userState.level) {
                    console.log(`[DEBUG] User ${ctx.from.id} already has level: ${userState.level}, focus: ${focus}. Proceeding to subcategory selection.`);
                    await this.promptForSubcategory(ctx, focus, userState.level);
                } else {
                    console.log(`[DEBUG] User ${ctx.from.id} selected focus: ${focus}, waiting for level`);
                    await ctx.editMessageText( // edit original message
                        'Please select your English level:',
                        Markup.inlineKeyboard([
                            [Markup.button.callback('A2', 'level_A2'), Markup.button.callback('B1', 'level_B1'), Markup.button.callback('B2', 'level_B2')]
                        ])
                    );
                }
            } catch (err) {
                console.error('[english_(grammar|vocabulary)] Error:', err);
                await ctx.reply('Error processing your request.').catch(e => console.error("Reply error", e));
            }
        });

        // Выбор уровня
        this.bot.action(/level_(A2|B1|B2)/, async (ctx) => {
            try {
                await ctx.answerCbQuery();
                const level = ctx.match[1];
                let userState = englishTestService.userStates.get(ctx.from.id) || {};
                userState.level = level;
                englishTestService.userStates.set(ctx.from.id, userState);

                const focus = userState.focus;
                if (!focus) {
                    console.error(`[DEBUG] User ${ctx.from.id} selected level ${level}, but focus is missing.`);
                    await ctx.editMessageText('Focus (Grammar/Vocabulary) not set. Please start over.', Markup.inlineKeyboard([
                        [Markup.button.callback('Start Over', 'english_improvement')]
                    ]));
                    return;
                }
                console.log(`[DEBUG] User ${ctx.from.id} selected level: ${level}, focus: ${focus}. Proceeding to subcategory selection.`);
                await this.promptForSubcategory(ctx, focus, level);
            } catch (err) {
                console.error('[level_(A2|B1|B2)] Error:', err);
                await ctx.reply('Error processing your request.').catch(e => console.error("Reply error", e));
            }
        });

        // Выбор подкатегории
        this.bot.action(/english_subcategory_(\d+)/, async (ctx) => {
            try {
                await ctx.answerCbQuery();
                const subcategoryId = parseInt(ctx.match[1], 10);
                let userState = englishTestService.userStates.get(ctx.from.id);

                if (!userState || !userState.level || !userState.focus) {
                    await ctx.editMessageText('Session error. Please select focus and level again.', Markup.inlineKeyboard([
                        [Markup.button.callback('Start Over', 'english_improvement')]
                    ]));
                    return;
                }
                userState.subcategoryId = subcategoryId; // Store subcategory
                englishTestService.userStates.set(ctx.from.id, userState);

                console.log(`[DEBUG] User ${ctx.from.id} selected subcategory: ${subcategoryId}, level: ${userState.level}, focus: ${userState.focus}`);
                
                // Удаляем сообщение с выбором подкатегорий
                await ctx.deleteMessage().catch(e => console.warn("Could not delete subcategory message:", e));

                const question = await englishTestService.startTest(ctx.from.id, subcategoryId, userState.level);

                if (!question) {
                    await ctx.reply('Sorry, no questions available for this subcategory and level. Try another one or new questions might be generated next time.', Markup.inlineKeyboard([
                        [Markup.button.callback('Back to Subcategories', `english_${userState.focus}`)],
                        [Markup.button.callback('Main Menu', 'english_improvement')]
                    ]));
                    return;
                }
                await this.sendQuestion(ctx, question);

            } catch (err) {
                console.error('[english_subcategory_] Error:', err);
                await ctx.reply('An error occurred starting the test. Please try again.').catch(e => console.error("Reply error", e));
            }
        });

        // Обработка ответов с кнопок (multiple choice / true-false)
        this.bot.action(/ans_choice_(.+)/, async (ctx) => {
            await ctx.answerCbQuery();
            const userAnswer = ctx.match[1]; // This will be the actual option text (potentially with _ for spaces)
                                            // Or an index if you change sendQuestion callback_data
            await this.handleUserAnswer(ctx, userAnswer.replace(/_/g, ' ')); // Replace _ with space if you used that
        });
        
        this.bot.action(/ans_tf_(True|False)/, async (ctx) => {
            await ctx.answerCbQuery();
            const userAnswer = ctx.match[1]; // True or False
            await this.handleUserAnswer(ctx, userAnswer);
        });


        // Обработка текстовых ответов (fill_in_blank)
        this.bot.on('text', async (ctx) => {
            const state = englishTestService.userStates.get(ctx.from.id);
            if (!state || state.state !== 'taking_test') return; // Not in a test

            // Check if current question expects a text answer
            const currentQData = englishTestService.getCurrentQuestionData(ctx.from.id);
            if (currentQData && currentQData.type === 'fill_in_blank') {
                 await this.handleUserAnswer(ctx, ctx.message.text);
            } else {
                // Optional: Inform user if they type when buttons are expected
                // await ctx.reply("Please use the buttons to answer this question.").catch(e => {});
            }
        });
    }

    async promptForSubcategory(ctx, focus, level) {
        try {
            // Determine categoryId (1 for grammar, 2 for vocabulary - make sure this is correct from your DB)
            const categoryId = focus.toLowerCase() === 'grammar' ? 1 : (focus.toLowerCase() === 'vocabulary' ? 2 : 0);
            if (categoryId === 0) {
                await ctx.editMessageText("Invalid focus. Please start over.", Markup.inlineKeyboard([
                    [Markup.button.callback('Start Over', 'english_improvement')]
                ]));
                return;
            }

            const subcategoryButtonsRaw = await englishTestService.getSubcategoriesMenu(categoryId);
            if (!subcategoryButtonsRaw || subcategoryButtonsRaw.length === 0) {
                await ctx.editMessageText(`No subcategories found for ${focus}. More might be added soon!`, Markup.inlineKeyboard([
                    [Markup.button.callback('Back', `english_improvement`)]
                ]));
                return;
            }

            const subcategoryButtons = subcategoryButtonsRaw.map(sub => Markup.button.callback(sub.text, sub.callback_data));
            const keyboardRows = [];
            for (let i = 0; i < subcategoryButtons.length; i += 2) { // 2 buttons per row
                keyboardRows.push(subcategoryButtons.slice(i, i + 2));
            }
            keyboardRows.push([Markup.button.callback('⬅️ Back to Level Select', `english_${focus}`)]);


            await ctx.editMessageText(
                `Please select a ${focus} subcategory for level ${level}:`,
                Markup.inlineKeyboard(keyboardRows)
            );
        } catch (err) {
            console.error('[promptForSubcategory] Error:', err);
            await ctx.reply('Error fetching subcategories.').catch(e => console.error("Reply error", e));
        }
    }
    
    async handleUserAnswer(ctx, userAnswer) {
        try {
            const userId = ctx.from.id;
            const state = englishTestService.userStates.get(userId);
            if (!state || state.state !== 'taking_test') {
                // If message is editable (i.e., from a button press), try to edit it.
                if (ctx.updateType === 'callback_query') {
                    await ctx.editMessageText('Your test session might have expired or is invalid. Please start a new test.', Markup.inlineKeyboard([
                        [Markup.button.callback('New Test', 'english_improvement')]
                    ])).catch(e => console.warn("Failed to edit expired session message"));
                } else {
                    await ctx.reply('Your test session might have expired or is invalid. Please start a new test.', Markup.inlineKeyboard([
                        [Markup.button.callback('New Test', 'english_improvement')]
                    ])).catch(e => console.error("Reply error", e));
                }
                return;
            }

            // For button presses, remove the keyboard from the question message
            if (ctx.updateType === 'callback_query' && ctx.message) {
                 await ctx.editMessageReplyMarkup(null).catch(e => console.warn("Could not remove kbd:", e));
            }


            const result = englishTestService.checkAnswer(userId, userAnswer);

            if (!result) {
                await ctx.reply('An error occurred while checking your answer. Please try starting a new test.').catch(e => console.error("Reply error", e));
                englishTestService.userStates.delete(userId); // Clear potentially corrupted state
                return;
            }

            let replyMessage = '';
            if (!result.isCorrect) {
                replyMessage = `❌ Incorrect!\n\n` +
                               `Correct answer: <b>${result.explanation_or_correct_answer}</b>\n` +
                               (result.example ? `Example: <i>${result.example}</i>` : '');
            } else {
                replyMessage = '✅ Correct!';
            }
            await ctx.replyWithHTML(replyMessage).catch(e => console.error("Reply error", e));

            if (!result.nextQuestion) { // Last question was answered
                const testResult = await englishTestService.finishTest(userId);
                if (testResult) {
                   await this.sendTestResults(ctx, testResult);
                } else {
                   await ctx.reply('Could not finalize test results. Your session might have ended.').catch(e => console.error("Reply error", e));
                }
            } else {
                await this.sendQuestion(ctx, result.nextQuestion);
            }
        } catch (err) {
            console.error('[handleUserAnswer] Error:', err);
            await ctx.reply('A critical error occurred. Please try again later.').catch(e => console.error("Reply error", e));
        }
    }


    // Отправка вопроса пользователю
    async sendQuestion(ctx, question) {
        try {
            let message = `Question ${question.questionNumber}/${question.totalQuestions}:\n\n<b>${question.text}</b>`; // Bold question text
            let keyboard = null; // Initialize to null

            switch (question.type) {
                case 'multiple_choice':
                    keyboard = Markup.inlineKeyboard(
                        question.options.map(opt => [Markup.button.callback(opt, `ans_choice_${opt.replace(/\s/g, '_')}`)]) // Ensure options are good for callbacks
                    );
                    break;
                case 'true_false':
                    keyboard = Markup.inlineKeyboard([
                        [Markup.button.callback('True', 'ans_tf_True'), Markup.button.callback('False', 'ans_tf_False')]
                    ]);
                    break;
                case 'fill_in_blank':
                    message += '\n\nType your answer:';
                    // No keyboard for fill_in_blank, user types the answer
                    break;
                default:
                    console.error("Unknown question type:", question.type);
                    await ctx.reply("Error: Unknown question type received.").catch(e => console.error("Reply error", e));
                    return;
            }
            
            if (keyboard) {
                await ctx.replyWithHTML(message, keyboard).catch(e => console.error("Reply error", e));
            } else {
                await ctx.replyWithHTML(message).catch(e => console.error("Reply error", e));
            }
        } catch (err) {
            console.error('[sendQuestion] Error:', err);
            await ctx.reply('Error sending question.').catch(e => console.error("Reply error", e));
        }
    }

    // Отправка результатов теста
    async sendTestResults(ctx, results) {
        try {
            let message = `<b>Test completed!</b> 🎉\n\n` +
                `Your score: ${results.score}/${results.totalQuestions}\n\n`;

            if (results.wrongAnswers.length > 0) {
                message += '<b>Review your mistakes:</b>\n\n';
                results.wrongAnswers.forEach((answer, index) => {
                    message += `${index + 1}. <b>Question:</b> ${answer.question}\n` +
                        `Your answer: ${answer.userAnswer}\n` +
                        `Correct answer: <b>${answer.correctAnswer}</b>\n` +
                        (answer.explanation ? `Explanation: ${answer.explanation}\n` : '') +
                        (answer.example ? `Example: <i>${answer.example}</i>\n` : '') +
                        `\n`;
                });
            } else if (results.score === results.totalQuestions && results.totalQuestions > 0) {
                message += "Excellent! You got all answers correct! 🥳\n\n";
            }


            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('Take another test', 'english_improvement')],
                // [Markup.button.callback('View My Stats (TODO)', 'user_stats')]
            ]);

            await ctx.replyWithHTML(message, keyboard).catch(e => console.error("Reply error", e));
        } catch (err) {
            console.error('[sendTestResults] Error:', err);
            await ctx.reply('Error sending test results.').catch(e => console.error("Reply error", e));
        }
    }
}

// Modified register function
function register(bot) {
    const controller = new EnglishTestController(bot);
    controller.setupHandlers(); // Call setupHandlers here
    console.log('EnglishTestController registered and handlers set up.');
}

module.exports = { register };