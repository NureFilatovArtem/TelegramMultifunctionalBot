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
                const messageText = 'What do you want to improve in English?';
                const keyboard = Markup.inlineKeyboard([
                    [Markup.button.callback('Grammar', 'english_grammar')],
                    [Markup.button.callback('Vocabulary', 'english_vocabulary')],
                    [getBackToMainMenuButton()]
                ]);
                if (ctx.updateType === 'callback_query' && ctx.callbackQuery.message) { await ctx.editMessageText(messageText, keyboard);
                } else { await ctx.reply(messageText, keyboard); }
            } catch (err) { console.error('[english_improvement_action] Error:', err); await ctx.reply('Error processing your request for English Improvement.').catch(e => console.error("Reply error", e));}
        });

        this.bot.action(/english_(grammar|vocabulary)/, async (ctx) => {
            try {
                await ctx.answerCbQuery().catch(e => {});
                const focus = ctx.match[1];
                let userState = englishTestService.userStates.get(ctx.from.id) || {};
                userState.focus = focus;
                englishTestService.userStates.set(ctx.from.id, userState);
                if (userState.level) { await this.promptForSubcategory(ctx, focus, userState.level);
                } else {
                    await ctx.editMessageText('Please select your English level:', Markup.inlineKeyboard([
                        [Markup.button.callback('A2', 'level_A2'), Markup.button.callback('B1', 'level_B1'), Markup.button.callback('B2', 'level_B2')],
                        [Markup.button.callback('« Back to Focus', 'english_improvement')] 
                    ]));
                }
            } catch (err) { console.error('[english_grammar_vocabulary_action] Error:', err); await ctx.reply('Error processing your request.').catch(e => {});}
        });

        this.bot.action(/level_(A2|B1|B2)/, async (ctx) => {
            try {
                await ctx.answerCbQuery().catch(e => {});
                const level = ctx.match[1];
                let userState = englishTestService.userStates.get(ctx.from.id) || {};
                userState.level = level;
                englishTestService.userStates.set(ctx.from.id, userState);
                const focus = userState.focus;
                if (!focus) { await ctx.editMessageText('Focus (Grammar/Vocabulary) not set. Please start over.', Markup.inlineKeyboard([[Markup.button.callback('Start Over', 'english_improvement')]])); return; }
                await this.promptForSubcategory(ctx, focus, level);
            } catch (err) { console.error('[level_action] Error:', err); await ctx.reply('Error processing level selection.').catch(e => {});}
        });

        this.bot.action(/eng_subcat_([a-zA-Z_]+)/, async (ctx) => {
            try {
                await ctx.answerCbQuery().catch(e => {});
                const subcategoryNameRaw = ctx.match[1];
                const subcategoryName = subcategoryNameRaw.replace(/_/g, ' ');
                let userState = englishTestService.userStates.get(ctx.from.id);
                if (!userState || !userState.level || !userState.focus) { await ctx.editMessageText('Session error. Please select focus and level again.', Markup.inlineKeyboard([[Markup.button.callback('Start Over', 'english_improvement')]])); return; }
                userState.subcategoryName = subcategoryName;
                englishTestService.userStates.set(ctx.from.id, userState);
                await this.promptForQuestionCount(ctx);
            } catch (err) { console.error('[english_subcategory_action] Error:', err); await ctx.reply('An error occurred selecting the subcategory.').catch(e => {});}
        });
        
        this.bot.action(/eng_q_count_(5|20)/, async (ctx) => {
            try {
                await ctx.answerCbQuery().catch(e => {});
                const questionCount = parseInt(ctx.match[1], 10);
                let userState = englishTestService.userStates.get(ctx.from.id);
                if (!userState || !userState.level || !userState.focus || !userState.subcategoryName) { // Опечатки user_state.focus здесь уже нет
                    await ctx.editMessageText('Session error. Please start the selection over.', Markup.inlineKeyboard([[Markup.button.callback('Start Over', 'english_improvement')]]));
                    return;
                }
                const desiredQuestionCount = questionCount; 
                userState.questionCount = desiredQuestionCount;
                englishTestService.userStates.set(ctx.from.id, userState);
                await ctx.editMessageText('Fetching questions, please wait...').catch(e => {});
                const question = await englishTestService.startTest(ctx.from.id, userState.subcategoryName, userState.level, desiredQuestionCount, false);
                if (!question) {
                    await ctx.editMessageText( `Sorry, no questions currently available for "${userState.subcategoryName}" (Level ${userState.level}). Please try another subcategory or check back later.`,
                        Markup.inlineKeyboard([
                            [Markup.button.callback('Try another Subcategory', `english_${userState.focus}`)],
                            [Markup.button.callback('Change Level/Focus', 'english_improvement')],
                            [getBackToMainMenuButton()]
                        ]));
                    return;
                }
                await this.sendQuestion(ctx, question);
            } catch (err) { console.error('[english_question_count_action] Error:', err); await ctx.reply('An error occurred starting the test.').catch(e => {});}
        });

        this.bot.action(/ans_choice_(.+)/, async (ctx) => { 
            await ctx.answerCbQuery().catch(e => {});
            const userAnswer = ctx.match[1].replace(/_/g, ' ');
            await this.handleUserAnswer(ctx, userAnswer);
        });
        this.bot.action(/ans_tf_(True|False)/i, async (ctx) => { 
            await ctx.answerCbQuery().catch(e => {});
            const userAnswer = ctx.match[1];
            await this.handleUserAnswer(ctx, userAnswer);
        });
        this.bot.on('text', async (ctx) => { 
            const userId = ctx.from.id;
            const state = englishTestService.userStates.get(userId);
            if (!state || state.state !== 'taking_test') { return; }
            const currentQData = englishTestService.getCurrentQuestionData(userId);
            if (currentQData && currentQData.type === 'fill_in_blank') {
                 await this.handleUserAnswer(ctx, ctx.message.text);
            } else if (currentQData) {
                await ctx.reply("Please use the buttons to answer this question.").catch(e => {});
            }
        });
        console.log("[EnglishTestController] Handlers set up.");
    }

    async promptForSubcategory(ctx, focus, level) {
        try {
            const categoryId = focus.toLowerCase() === 'grammar' ? 1 : (focus.toLowerCase() === 'vocabulary' ? 2 : 0);
            if (categoryId === 0) { await ctx.editMessageText("Invalid focus. Please start over.", Markup.inlineKeyboard([[Markup.button.callback('Start Over', 'english_improvement')]])); return; }
            const subcategoryButtonsRaw = await englishTestService.getSubcategoriesMenu(categoryId);
            if (!subcategoryButtonsRaw || subcategoryButtonsRaw.length === 0) { await ctx.editMessageText( `No subcategories found for ${focus} (Level ${level}).`, Markup.inlineKeyboard([ [Markup.button.callback('« Change Level', `english_${focus}`)], [Markup.button.callback('« Change Focus', 'english_improvement')], [getBackToMainMenuButton()] ])); return; }
            const subcategoryButtons = subcategoryButtonsRaw.map(sub => Markup.button.callback(sub.text, sub.callback_data));
            const keyboardRows = [];
            for (let i = 0; i < subcategoryButtons.length; i += 2) { keyboardRows.push(subcategoryButtons.slice(i, i + 2));}
            keyboardRows.push([Markup.button.callback('« Back to Level Select', `english_${focus}`)]);
            await ctx.editMessageText( `Please select a ${focus} subcategory for level ${level}:`, Markup.inlineKeyboard(keyboardRows));
        } catch (err) { console.error('[promptForSubcategory] Error:', err); await ctx.reply('Error fetching subcategories.').catch(e => {}); }
    }
    
    async promptForQuestionCount(ctx) {
         try {
            let userState = englishTestService.userStates.get(ctx.from.id);
            if (!userState || !userState.subcategoryName) { await ctx.editMessageText('Error: Subcategory not selected. Please start over.', Markup.inlineKeyboard([[Markup.button.callback('Start Over', 'english_improvement')]])); return; }
            const messageText = `You selected "${userState.subcategoryName}". How many questions would you like?`;
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('5 Questions', 'eng_q_count_5'), Markup.button.callback('20 Questions', 'eng_q_count_20')],
                [Markup.button.callback('« Back to Subcategories', `english_${userState.focus}`)]
            ]);
            await ctx.editMessageText(messageText, keyboard);
        } catch (err) { console.error('[promptForQuestionCount] Error:', err); await ctx.reply('Error setting up question count.').catch(e => {});}
    }
    
    async handleUserAnswer(ctx, userAnswer) {
        try {
            const userId = ctx.from.id;
            const state = englishTestService.userStates.get(userId);
            if (!state || state.state !== 'taking_test') {
                const messageText = 'Your test session might have expired. Please start a new test.';
                const keyboard = Markup.inlineKeyboard([[Markup.button.callback('New Test', 'english_improvement')], [getBackToMainMenuButton()]]);
                if (ctx.updateType === 'callback_query') { await ctx.editMessageText(messageText, keyboard).catch(e => { ctx.reply(messageText, keyboard).catch(eReply => {});});
                } else { await ctx.reply(messageText, keyboard).catch(e => {});}
                return;
            }
            if (ctx.updateType === 'callback_query' && ctx.callbackQuery.message) { await ctx.editMessageReplyMarkup(null).catch(e => {});}
            if (ctx.message && ctx.message.text && ctx.message.message_id) { try { await ctx.deleteMessage(ctx.message.message_id); } catch(e) {}}
            const result = englishTestService.checkAnswer(userId, userAnswer);
            if (!result) { await ctx.reply('Error checking answer. Start a new test.').catch(e => {}); englishTestService.userStates.delete(userId); return; }
            let replyMessage = result.isCorrect ? '✅ Correct!' :  `❌ Incorrect!\n\nCorrect answer: <b>${result.explanation_or_correct_answer}</b>\n` + (result.example ? `Example: <i>${result.example}</i>` : '');
            await ctx.replyWithHTML(replyMessage).catch(e => {});
            if (!result.nextQuestion) {
                const testResult = await englishTestService.finishTest(userId);
                if (testResult) { await this.sendTestResults(ctx, testResult);
                } else { await ctx.reply('Could not finalize test results.').catch(e => {});}
            } else { await this.sendQuestion(ctx, result.nextQuestion);}
        } catch (err) { console.error('[handleUserAnswer] Critical Error:', err); await ctx.reply('Critical error processing answer.').catch(e => {}); if (ctx.from && ctx.from.id) { englishTestService.userStates.delete(ctx.from.id);}}
    }
    
    async sendQuestion(ctx, question) {
        console.log("[sendQuestion DEBUG] Received question object:", JSON.stringify(question, null, 2));
        try {
            let messageText = `Question ${question.questionNumber}/${question.totalQuestions}:\n\n<b>${question.text}</b>`;
            let keyboardMarkup = null;
            switch (question.type)  {
                case 'multiple_choice':
                    if (question.options && Array.isArray(question.options) && question.options.length > 0) {
                        keyboardMarkup = Markup.inlineKeyboard(
                            question.options.map(opt => {
                                const buttonText = (typeof opt === 'string') ? opt : (opt && typeof opt.text === 'string' ? opt.text : 'Invalid Option');
                                // Убедимся, что callbackData тоже строка
                                let cbDataPart = (typeof opt === 'string') ? opt : (opt && typeof opt.text === 'string' ? opt.text : 'invalid_option');
                                cbDataPart = cbDataPart.replace(/\s/g, '_').substring(0,30);
                                return [Markup.button.callback(buttonText, `ans_choice_${cbDataPart}`)];
                            })
                        );
                    } else {
                         console.error("[sendQuestion ERROR] Multiple choice question has no valid options:", question);
                         messageText += "\n\nError: This question is missing valid options.";
                    }
                    break;
                case 'true_false':
                    keyboardMarkup = Markup.inlineKeyboard([
                        [Markup.button.callback('True', 'ans_tf_True'), Markup.button.callback('False', 'ans_tf_False')]
                    ]);
                    break;
                case 'fill_in_blank':
                    messageText += '\n\nType your answer:';
                    break;
                default:
                    console.error("[sendQuestion ERROR] Unknown question type:", question.type, "for question:", question.text);
                    await ctx.reply("Error: Encountered an unknown question type. Please report this.").catch(e => {});
                    return;
            }
            console.log("[sendQuestion DEBUG] Keyboard markup object before sending:", keyboardMarkup ? "Exists" : "null");
            const extraOptions = { parse_mode: 'HTML' };
            if (keyboardMarkup) { extraOptions.reply_markup = keyboardMarkup.reply_markup; }

            if (ctx.updateType === 'callback_query' && ctx.callbackQuery.message && 
                (ctx.callbackQuery.message.text === 'Fetching questions, please wait...' || ctx.callbackQuery.message.text === 'Starting test, please wait...')) {
                 await ctx.editMessageText(messageText, extraOptions).catch(async (e) => {
                     console.warn("Failed to edit 'Fetching/Starting' message for question, sending new:", e.message);
                     if(ctx.callbackQuery.message.from.id === ctx.botInfo.id){ try { await ctx.deleteMessage(ctx.callbackQuery.message.message_id); } catch(delErr){}}
                     await ctx.replyWithHTML(messageText, keyboardMarkup);
                 });
            } else {
                if (ctx.updateType === 'callback_query' && ctx.callbackQuery.message && ctx.callbackQuery.message.from.id === ctx.botInfo.id) {
                    try { await ctx.deleteMessage(ctx.callbackQuery.message.message_id); } catch(e) { console.warn("sendQuestion (reply path): Could not delete previous message", e.message); }}
                 await ctx.replyWithHTML(messageText, keyboardMarkup);
            }
        } catch (err) { console.error('[sendQuestion ERROR] Critical error in sendQuestion:', err.message, err.stack); await ctx.reply('Error sending the next question. Please try to restart the test.').catch(eReply => {});}
    }
    async sendTestResults(ctx, results) {
        try {
            let message = `<b>Test completed!</b> 🎉\n\nYour score: ${results.score}/${results.totalQuestions}\n\n`;
            if (results.wrongAnswers && results.wrongAnswers.length > 0) {
                message += '<b>Review your mistakes:</b>\n\n';
                results.wrongAnswers.forEach((answer, index) => { message += `${index + 1}. <b>Q:</b> ${answer.question}\nYour: ${answer.userAnswer}\nCorrect: <b>${answer.correctAnswer}</b>\n` + (answer.explanation ? `Expl: ${answer.explanation}\n` : '') + (answer.example ? `Ex: <i>${answer.example}</i>\n` : '') + `\n`;});
            } else if (results.score === results.totalQuestions && results.totalQuestions > 0) { message += "Excellent! All correct! 🥳\n\n"; }
            const keyboard = Markup.inlineKeyboard([[Markup.button.callback('Take another test', 'english_improvement')], [getBackToMainMenuButton()]]);
            await ctx.replyWithHTML(message, keyboard).catch(e => {});
        } catch (err) { console.error('[sendTestResults] Error:', err); await ctx.reply('Error sending test results.').catch(e => {});}
    }
}

function register(botInstance) {
    const controller = new EnglishTestController(botInstance);
    controller.setupHandlers();
    console.log('[EnglishTestController] Feature registered successfully.');
}
module.exports = { register };