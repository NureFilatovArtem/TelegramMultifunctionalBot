// src/features/english-test/english-test.controller.js
const { Markup } = require('telegraf');
const englishTestService = require('./english-test.service');
const { getBackToMainMenuButton } = require('../../navigation');

class EnglishTestController {
    constructor(botInstance) {
        this.bot = botInstance;
    }

    setupHandlers() {
        console.log("[EnglishTestController] Setting up handlers...");

        this.bot.action('english_improvement', async (ctx) => {
            try {
                await ctx.answerCbQuery().catch(e => console.warn("CBQ answer failed:", e.message));
                // CHANGED: Text to English
                const messageText = 'What do you want to improve in English?';
                const keyboard = Markup.inlineKeyboard([
                    [Markup.button.callback('Grammar', 'english_grammar')],
                    [Markup.button.callback('Vocabulary', 'english_vocabulary')],
                    [getBackToMainMenuButton()]
                ]);

                if (ctx.updateType === 'callback_query' && ctx.callbackQuery.message) {
                    await ctx.editMessageText(messageText, keyboard);
                } else {
                    await ctx.reply(messageText, keyboard);
                }
            } catch (err) {
                console.error('[english_improvement_action] Error:', err);
                // CHANGED: Text to English
                await ctx.reply('Error processing your request for English Improvement.').catch(e => console.error("Reply error", e));
            }
        });

        this.bot.action(/english_(grammar|vocabulary)/, async (ctx) => {
            try {
                await ctx.answerCbQuery().catch(e => {});
                const focus = ctx.match[1];
                let userState = englishTestService.userStates.get(ctx.from.id) || {};
                userState.focus = focus;
                englishTestService.userStates.set(ctx.from.id, userState);

                if (userState.level) {
                    await this.promptForSubcategory(ctx, focus, userState.level);
                } else {
                    // CHANGED: Text and button to English
                    await ctx.editMessageText(
                        'Please select your English level:',
                        Markup.inlineKeyboard([
                            [Markup.button.callback('A2', 'level_A2'), Markup.button.callback('B1', 'level_B1'), Markup.button.callback('B2', 'level_B2')],
                            [Markup.button.callback('« Back to Focus', 'english_improvement')] 
                        ])
                    );
                }
            } catch (err) {
                console.error('[english_grammar_vocabulary_action] Error:', err);
                // CHANGED: Text to English
                await ctx.reply('Error processing your request.').catch(e => {});
            }
        });

        this.bot.action(/level_(A2|B1|B2)/, async (ctx) => {
            try {
                await ctx.answerCbQuery().catch(e => {});
                const level = ctx.match[1];
                let userState = englishTestService.userStates.get(ctx.from.id) || {};
                userState.level = level;
                englishTestService.userStates.set(ctx.from.id, userState);

                const focus = userState.focus;
                if (!focus) {
                    // CHANGED: Text and button to English
                    await ctx.editMessageText('Focus (Grammar/Vocabulary) not set. Please start over.', Markup.inlineKeyboard([
                        [Markup.button.callback('Start Over', 'english_improvement')]
                    ]));
                    return;
                }
                await this.promptForSubcategory(ctx, focus, level);
            } catch (err) {
                console.error('[level_action] Error:', err);
                // CHANGED: Text to English
                await ctx.reply('Error processing level selection.').catch(e => {});
            }
        });

        this.bot.action(/english_subcategory_(\d+)/, async (ctx) => {
            try {
                await ctx.answerCbQuery().catch(e => {});
                const subcategoryId = parseInt(ctx.match[1], 10);
                let userState = englishTestService.userStates.get(ctx.from.id);

                if (!userState || !userState.level || !userState.focus) {
                    // CHANGED: Text and button to English
                    await ctx.editMessageText('Session error. Please select focus and level again.', Markup.inlineKeyboard([
                        [Markup.button.callback('Start Over', 'english_improvement')]
                    ]));
                    return;
                }
                userState.subcategoryId = subcategoryId;
                englishTestService.userStates.set(ctx.from.id, userState);
                // CHANGED: Text to English
                await ctx.editMessageText('Starting test, please wait...').catch(e => {});

                const question = await englishTestService.startTest(ctx.from.id, subcategoryId, userState.level);

                if (!question) {
                    // CHANGED: Text and buttons to English
                    await ctx.editMessageText(
                        'Sorry, no questions available for this subcategory and level. Try another one.',
                        Markup.inlineKeyboard([
                            [Markup.button.callback('Try another Subcategory', `english_${userState.focus}`)],
                            [Markup.button.callback('Change Level/Focus', 'english_improvement')],
                            [getBackToMainMenuButton()]
                        ])
                    );
                    return;
                }
                await this.sendQuestion(ctx, question);

            } catch (err) {
                console.error('[english_subcategory_action] Error:', err);
                // CHANGED: Text to English
                await ctx.reply('An error occurred starting the test.').catch(e => {});
            }
        });

        this.bot.action(/ans_choice_(.+)/, async (ctx) => { /* ... no text changes ... */ });
        this.bot.action(/ans_tf_(True|False)/i, async (ctx) => { /* ... no text changes ... */ });

        this.bot.on('text', async (ctx) => {
            const userId = ctx.from.id;
            const state = englishTestService.userStates.get(userId);

            if (!state || state.state !== 'taking_test') { return; }
            
            const currentQData = englishTestService.getCurrentQuestionData(userId);
            if (currentQData && currentQData.type === 'fill_in_blank') {
                 await this.handleUserAnswer(ctx, ctx.message.text);
            } else if (currentQData) {
                // CHANGED: Text to English
                await ctx.reply("Please use the buttons to answer this question.").catch(e => {});
            }
        });
        console.log("[EnglishTestController] Handlers set up.");
    }

    async promptForSubcategory(ctx, focus, level) {
        try {
            const categoryId = focus.toLowerCase() === 'grammar' ? 1 : (focus.toLowerCase() === 'vocabulary' ? 2 : 0);
            if (categoryId === 0) {
                // CHANGED: Text and button to English
                await ctx.editMessageText("Invalid focus. Please start over.", Markup.inlineKeyboard([
                    [Markup.button.callback('Start Over', 'english_improvement')]
                ]));
                return;
            }

            const subcategoryButtonsRaw = await englishTestService.getSubcategoriesMenu(categoryId);
            if (!subcategoryButtonsRaw || subcategoryButtonsRaw.length === 0) {
                // CHANGED: Text and buttons to English
                await ctx.editMessageText(
                    `No subcategories found for ${focus} (Level ${level}).`,
                    Markup.inlineKeyboard([
                        [Markup.button.callback('« Change Level', `english_${focus}`)],
                        [Markup.button.callback('« Change Focus', 'english_improvement')],
                        [getBackToMainMenuButton()]
                    ])
                );
                return;
            }

            const subcategoryButtons = subcategoryButtonsRaw.map(sub => Markup.button.callback(sub.text, sub.callback_data));
            const keyboardRows = [];
            for (let i = 0; i < subcategoryButtons.length; i += 2) {
                keyboardRows.push(subcategoryButtons.slice(i, i + 2));
            }
            // CHANGED: Button text to English
            keyboardRows.push([Markup.button.callback('« Back to Level Select', `english_${focus}`)]);

            // CHANGED: Text to English
            await ctx.editMessageText(
                `Please select a ${focus} subcategory for level ${level}:`,
                Markup.inlineKeyboard(keyboardRows)
            );
        } catch (err) {
            console.error('[promptForSubcategory] Error:', err);
            // CHANGED: Text to English
            await ctx.reply('Error fetching subcategories.').catch(e => {});
        }
    }
    
    async handleUserAnswer(ctx, userAnswer) {
        try {
            const userId = ctx.from.id;
            const state = englishTestService.userStates.get(userId);

            if (!state || state.state !== 'taking_test') {
                // CHANGED: Text and buttons to English
                const messageText = 'Your test session might have expired. Please start a new test.';
                const keyboard = Markup.inlineKeyboard([
                    [Markup.button.callback('New Test', 'english_improvement')],
                    [getBackToMainMenuButton()]
                ]);
                if (ctx.updateType === 'callback_query') {
                    await ctx.editMessageText(messageText, keyboard).catch(e => {
                        ctx.reply(messageText, keyboard).catch(eReply => {});
                    });
                } else {
                    await ctx.reply(messageText, keyboard).catch(e => {});
                }
                return;
            }

            if (ctx.updateType === 'callback_query' && ctx.callbackQuery.message) {
                 await ctx.editMessageReplyMarkup(null).catch(e => {});
            }
            if (ctx.message && ctx.message.text && ctx.message.message_id) {
                try { await ctx.deleteMessage(ctx.message.message_id); } catch(e) {}
            }

            const result = englishTestService.checkAnswer(userId, userAnswer);

            if (!result) {
                // CHANGED: Text to English
                await ctx.reply('Error checking answer. Start a new test.').catch(e => {});
                englishTestService.userStates.delete(userId);
                return;
            }
            // CHANGED: Text to English
            let replyMessage = result.isCorrect ? '✅ Correct!' : 
                `❌ Incorrect!\n\nCorrect answer: <b>${result.explanation_or_correct_answer}</b>\n` +
                (result.example ? `Example: <i>${result.example}</i>` : '');
            
            await ctx.replyWithHTML(replyMessage).catch(e => {});

            if (!result.nextQuestion) {
                const testResult = await englishTestService.finishTest(userId);
                if (testResult) {
                   await this.sendTestResults(ctx, testResult);
                } else {
                   // CHANGED: Text to English
                   await ctx.reply('Could not finalize test results.').catch(e => {});
                }
            } else {
                await this.sendQuestion(ctx, result.nextQuestion);
            }
        } catch (err) {
            console.error('[handleUserAnswer] Critical Error:', err);
            // CHANGED: Text to English
            await ctx.reply('Critical error processing answer.').catch(e => {});
            if (ctx.from && ctx.from.id) {
                 englishTestService.userStates.delete(ctx.from.id);
            }
        }
    }

    async sendQuestion(ctx, question) {
        try {
            // CHANGED: Text to English (Question X/Y)
            let message = `Question ${question.questionNumber}/${question.totalQuestions}:\n\n<b>${question.text}</b>`;
            let keyboard = null;

            switch (question.type) {
                case 'multiple_choice':
                    keyboard = Markup.inlineKeyboard(
                        question.options.map(opt => [Markup.button.callback(opt, `ans_choice_${opt.replace(/\s/g, '_').substring(0,30)}`)])
                    );
                    break;
                case 'true_false':
                    keyboard = Markup.inlineKeyboard([
                        [Markup.button.callback('True', 'ans_tf_True'), Markup.button.callback('False', 'ans_tf_False')]
                    ]);
                    break;
                case 'fill_in_blank':
                    // CHANGED: Text to English
                    message += '\n\nType your answer:';
                    break;
                default:
                    // CHANGED: Text to English
                    await ctx.reply("Error: Unknown question type.").catch(e => {});
                    return;
            }
            
            if (ctx.updateType === 'callback_query' && ctx.callbackQuery.message.text && ctx.callbackQuery.message.text.startsWith("Starting test")) {
                 await ctx.editMessageText(message, { parse_mode: 'HTML', ...keyboard?.extra() }).catch(e => {
                     ctx.replyWithHTML(message, keyboard).catch(eReply => {});
                 });
            } else {
                 await ctx.replyWithHTML(message, keyboard).catch(e => {});
            }
        } catch (err) {
            console.error('[sendQuestion] Error:', err);
            // CHANGED: Text to English
            await ctx.reply('Error sending next question.').catch(e => {});
        }
    }

    async sendTestResults(ctx, results) {
        try {
            // CHANGED: Text to English
            let message = `<b>Test completed!</b> 🎉\n\n` +
                `Your score: ${results.score}/${results.totalQuestions}\n\n`;

            if (results.wrongAnswers && results.wrongAnswers.length > 0) {
                // CHANGED: Text to English
                message += '<b>Review your mistakes:</b>\n\n';
                results.wrongAnswers.forEach((answer, index) => {
                    // CHANGED: Labels to English (Q, Your, Correct, Expl, Ex)
                    message += `${index + 1}. <b>Q:</b> ${answer.question}\n` +
                        `Your: ${answer.userAnswer}\n` +
                        `Correct: <b>${answer.correctAnswer}</b>\n` +
                        (answer.explanation ? `Expl: ${answer.explanation}\n` : '') +
                        (answer.example ? `Ex: <i>${answer.example}</i>\n` : '') + `\n`;
                });
            } else if (results.score === results.totalQuestions && results.totalQuestions > 0) {
                // CHANGED: Text to English
                message += "Excellent! All correct! 🥳\n\n";
            }

            const keyboard = Markup.inlineKeyboard([
                // CHANGED: Button text to English
                [Markup.button.callback('Take another test', 'english_improvement')],
                [getBackToMainMenuButton()]
            ]);

            await ctx.replyWithHTML(message, keyboard).catch(e => {});
        } catch (err) {
            console.error('[sendTestResults] Error:', err);
            // CHANGED: Text to English
            await ctx.reply('Error sending test results.').catch(e => {});
        }
    }
}

function register(botInstance) {
    const controller = new EnglishTestController(botInstance);
    controller.setupHandlers();
    console.log('[EnglishTestController] Feature registered successfully.');
}

module.exports = { register };