const { Markup } = require('telegraf');
const englishTestService = require('./english-test.service');

class EnglishTestController {
    constructor(bot) {
        this.bot = bot;
        this.setupHandlers();
    }

    setupHandlers() {
        // Кнопка English Improvement в главном меню
        this.bot.action('english_improvement', async (ctx) => {
            try {
                await ctx.reply('What do you want to improve?', Markup.inlineKeyboard([
                    [Markup.button.callback('Grammar', 'english_grammar')],
                    [Markup.button.callback('Vocabulary', 'english_vocabulary')]
                ]));
            } catch (err) {
                console.error('[english_improvement] Error:', err);
            }
        });

        // Выбор направления (Grammar/Vocabulary)
        this.bot.action(/english_(grammar|vocabulary)/, async (ctx) => {
            try {
                const focus = ctx.match[1];
                let userState = englishTestService.userStates.get(ctx.from.id) || {};
                userState.focus = focus;
                englishTestService.userStates.set(ctx.from.id, userState);

                // Проверяем, есть ли уровень
                if (userState.level) {
                    console.log(`[DEBUG] User ${ctx.from.id} already has level: ${userState.level}, focus: ${focus}`);
                    await this.startTestFlow(ctx, focus, userState.level);
                } else {
                    console.log(`[DEBUG] User ${ctx.from.id} selected focus: ${focus}, waiting for level`);
                    await ctx.reply(
                        'Please select your English level:',
                        Markup.inlineKeyboard([
                            [Markup.button.callback('A2', 'level_A2'), Markup.button.callback('B1', 'level_B1'), Markup.button.callback('B2', 'level_B2')]
                        ])
                    );
                }
            } catch (err) {
                console.error('[english_(grammar|vocabulary)] Error:', err);
            }
        });

        // Выбор уровня (сохраняем и сразу тест)
        this.bot.action(/level_(A2|B1|B2)/, async (ctx) => {
            try {
                const level = ctx.match[1];
                let userState = englishTestService.userStates.get(ctx.from.id) || {};
                userState.level = level;
                englishTestService.userStates.set(ctx.from.id, userState);

                const focus = userState.focus || 'grammar';
                console.log(`[DEBUG] User ${ctx.from.id} selected level: ${level}, focus: ${focus}`);
                await this.startTestFlow(ctx, focus, level);
            } catch (err) {
                console.error('[level_(A2|B1|B2)] Error:', err);
            }
        });

        // Обработка ответов пользователя
        this.bot.on('text', async (ctx) => {
            try {
                const state = englishTestService.userStates.get(ctx.from.id);
                if (!state || state.state !== 'taking_test') return;

                const result = englishTestService.checkAnswer(ctx.from.id, ctx.message.text);
                
                if (!result) {
                    await ctx.reply('Something went wrong. Please try again.');
                    return;
                }

                if (!result.isCorrect) {
                    await ctx.reply(
                        `❌ Incorrect!\n\n` +
                        `Correct answer: ${result.explanation}\n` +
                        `Example: ${result.example}`
                    );
                } else {
                    await ctx.reply('✅ Correct!');
                }

                if (!result.nextQuestion) {
                    const testResult = await englishTestService.finishTest(ctx.from.id);
                    await this.sendTestResults(ctx, testResult);
                } else {
                    await this.sendQuestion(ctx, result.nextQuestion);
                }
            } catch (err) {
                console.error('[text answer] Error:', err);
            }
        });
    }

    // Запуск теста по направлению и уровню
    async startTestFlow(ctx, focus, level) {
        try {
            const categoryId = focus === 'grammar' ? 1 : 2;
            const subcategories = await englishTestService.getSubcategoriesMenu(categoryId);
            if (!subcategories.length) {
                await ctx.reply('No subcategories found for this topic.');
                console.error(`[DEBUG] No subcategories for categoryId=${categoryId}`);
                return;
            }
            const match = subcategories[0].callback_data.match(/english_subcategory_(\d+)/);
            if (!match) {
                await ctx.reply('Internal error: cannot parse subcategory id.');
                console.error(`[DEBUG] Cannot parse subcategory id from:`, subcategories[0]);
                return;
            }
            const subcategoryId = match[1];
            console.log(`[DEBUG] User ${ctx.from.id} startTestFlow: focus=${focus}, level=${level}, categoryId=${categoryId}, subcategoryId=${subcategoryId}`);
            const question = await englishTestService.startTest(ctx.from.id, subcategoryId, level);
            if (!question) {
                await ctx.reply('Sorry, no questions available for this category.');
                return;
            }
            await this.sendQuestion(ctx, question);
        } catch (err) {
            console.error('[startTestFlow] Error:', err);
            await ctx.reply('An error occurred. Please try again or use /start to reset the bot.');
        }
    }

    // Отправка вопроса пользователю
    async sendQuestion(ctx, question) {
        let message = `Question ${question.questionNumber}/${question.totalQuestions}:\n\n${question.text}`;
        let keyboard;

        switch (question.type) {
            case 'multiple_choice':
                keyboard = Markup.inlineKeyboard(
                    question.options.map((opt, i) => [Markup.button.callback(opt, `answer_${i}`)])
                );
                break;
            case 'true_false':
                keyboard = Markup.inlineKeyboard([
                    [Markup.button.callback('True', 'answer_true'), Markup.button.callback('False', 'answer_false')]
                ]);
                break;
            case 'fill_in_blank':
                message += '\n\nType your answer:';
                break;
        }

        await ctx.reply(message, keyboard);
    }

    // Отправка результатов теста
    async sendTestResults(ctx, results) {
        let message = `Test completed!\n\n` +
            `Your score: ${results.score}/${results.totalQuestions}\n\n`;

        if (results.wrongAnswers.length > 0) {
            message += 'Incorrect answers:\n\n';
            results.wrongAnswers.forEach((answer, index) => {
                message += `${index + 1}. Question: ${answer.question}\n` +
                    `Your answer: ${answer.userAnswer}\n` +
                    `Correct answer: ${answer.correctAnswer}\n` +
                    `Explanation: ${answer.explanation}\n` +
                    `Example: ${answer.example}\n\n`;
            });
        }

        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('Take another test', 'english_improvement')]
        ]);

        await ctx.reply(message, keyboard);
    }
}

module.exports = EnglishTestController; 