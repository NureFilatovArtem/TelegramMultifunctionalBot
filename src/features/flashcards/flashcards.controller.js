// src/features/flashcards/flashcards.controller.js
const { Markup } = require('telegraf');
const { getBackToMainMenuButton } = require('../../navigation'); // Импорт кнопки "В Главное Меню"

// Состояния пользователя для модуля флеш-карт
const flashcardStates = {
    IDLE: 'fc_idle',
    AWAITING_QUESTION: 'fc_awaiting_question',
    AWAITING_ANSWER: 'fc_awaiting_answer',
    STUDYING_SHOW_QUESTION: 'fc_studying_show_q',
    STUDYING_SHOW_ANSWER: 'fc_studying_show_a',
    // Можно добавить состояния для просмотра и удаления карт
};

// Хранилище состояний и данных карт (временно, лучше использовать БД)
const userFlashcardModuleState = new Map(); // userId -> { state: string, tempCard?: { q: string, a: string }, currentCardIndex?: number }
const userFlashcards = new Map(); // userId -> [{q: string, a: string, id: string}]

class FlashcardsController {
    constructor(bot) {
        this.bot = bot;
    }

    getFlashcardsMenuKeyboard(userId) {
        const cards = userFlashcards.get(userId) || [];
        const buttons = [
            [Markup.button.callback('➕ Create New Card', 'fc_action_create_start')],
        ];
        if (cards.length > 0) {
            buttons.push([Markup.button.callback(`📚 Study Cards (${cards.length})`, 'fc_action_study_start')]);
            buttons.push([Markup.button.callback(`👀 View My Cards (${cards.length})`, 'fc_action_view_all')]);
        }
        buttons.push([getBackToMainMenuButton()]);
        return Markup.inlineKeyboard(buttons);
    }

    async showFlashcardsFeatureMenu(ctx, editText = true) {
        const userId = ctx.from.id;
        userFlashcardModuleState.set(userId, { state: flashcardStates.IDLE });
        const messageText = '🎯 Flashcards Management:';
        const keyboard = this.getFlashcardsMenuKeyboard(userId);

        if (editText && ctx.updateType === 'callback_query' && ctx.callbackQuery.message) {
            try {
                await ctx.editMessageText(messageText, keyboard);
                return;
            } catch (e) {
                console.warn("Flashcards: Could not edit message, sending new.", e.message);
                if (ctx.callbackQuery.message.from.id === ctx.botInfo.id) {
                   await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(() => {});
                }
            }
        }
        await ctx.reply(messageText, keyboard);
    }

    setupHandlers() {
        console.log('[FlashcardsController] Setting up handlers...');

        // Точка входа из главного меню
        this.bot.action('menu_flashcards', async (ctx) => {
            await ctx.answerCbQuery().catch(() => {});
            await this.showFlashcardsFeatureMenu(ctx, true);
        });

        // Начало создания новой карточки
        this.bot.action('fc_action_create_start', async (ctx) => {
            await ctx.answerCbQuery().catch(() => {});
            const userId = ctx.from.id;
            userFlashcardModuleState.set(userId, { state: flashcardStates.AWAITING_QUESTION });
            await ctx.editMessageText(
                '📝 Please enter the **question** (front side) for your new flashcard:',
                { parse_mode: 'Markdown', reply_markup: Markup.inlineKeyboard([
                    [Markup.button.callback('« Cancel Creation', 'fc_action_cancel_creation')]
                ]).reply_markup}
            );
        });
        
        // Отмена создания
        this.bot.action('fc_action_cancel_creation', async (ctx) => {
            await ctx.answerCbQuery().catch(() => {});
            await this.showFlashcardsFeatureMenu(ctx, true);
        });
        
        // Начало изучения
        this.bot.action('fc_action_study_start', async (ctx) => {
            await ctx.answerCbQuery().catch(() => {});
            const userId = ctx.from.id;
            const cards = userFlashcards.get(userId) || [];
            if (cards.length === 0) {
                await ctx.editMessageText("You have no cards to study. Create some first!", this.getFlashcardsMenuKeyboard(userId));
                return;
            }
            userFlashcardModuleState.set(userId, { state: flashcardStates.STUDYING_SHOW_QUESTION, currentCardIndex: 0 });
            await this.sendStudyCardQuestion(ctx, userId, 0);
        });

        // Показать ответ при изучении
        this.bot.action('fc_action_study_show_answer', async (ctx) => {
            await ctx.answerCbQuery().catch(() => {});
            const userId = ctx.from.id;
            const state = userFlashcardModuleState.get(userId);
            if (!state || state.state !== flashcardStates.STUDYING_SHOW_QUESTION || typeof state.currentCardIndex === 'undefined') {
                await ctx.editMessageText("Error in study session. Please restart.", this.getFlashcardsMenuKeyboard(userId));
                return;
            }
            userFlashcardModuleState.set(userId, { ...state, state: flashcardStates.STUDYING_SHOW_ANSWER });
            await this.sendStudyCardAnswer(ctx, userId, state.currentCardIndex);
        });
        
        // Следующая карточка при изучении
        this.bot.action('fc_action_study_next_card', async (ctx) => {
            await ctx.answerCbQuery().catch(() => {});
            const userId = ctx.from.id;
            const state = userFlashcardModuleState.get(userId);
            const cards = userFlashcards.get(userId) || [];
            if (!state || state.state !== flashcardStates.STUDYING_SHOW_ANSWER || typeof state.currentCardIndex === 'undefined' || cards.length === 0) {
                await ctx.editMessageText("Error in study session. Please restart.", this.getFlashcardsMenuKeyboard(userId));
                return;
            }
            const nextIndex = (state.currentCardIndex + 1) % cards.length;
            userFlashcardModuleState.set(userId, { state: flashcardStates.STUDYING_SHOW_QUESTION, currentCardIndex: nextIndex });
            await this.sendStudyCardQuestion(ctx, userId, nextIndex);
        });

        // Завершить изучение
        this.bot.action('fc_action_study_finish', async (ctx) => {
            await ctx.answerCbQuery().catch(() => {});
            await this.showFlashcardsFeatureMenu(ctx, true);
        });
        
        // Просмотр всех карточек (просто и для примера, можно улучшить пагинацией)
        this.bot.action('fc_action_view_all', async (ctx) => {
            await ctx.answerCbQuery().catch(() => {});
            const userId = ctx.from.id;
            const cards = userFlashcards.get(userId) || [];
            let message = "📚 Your Flashcards:\n\n";
            if (cards.length === 0) {
                message = "You have no flashcards yet.";
            } else {
                cards.forEach((card, i) => {
                    message += `${i + 1}. **Q:** ${card.q}\n   **A:** ${card.a}\n\n`;
                });
            }
            await ctx.editMessageText(message, { parse_mode: 'Markdown', ...this.getFlashcardsMenuKeyboard(userId) });
        });


        // Обработка текстового ввода для создания карточек
        this.bot.on('text', async (ctx) => {
            const userId = ctx.from.id;
            const stateData = userFlashcardModuleState.get(userId);

            if (!stateData || (stateData.state !== flashcardStates.AWAITING_QUESTION && stateData.state !== flashcardStates.AWAITING_ANSWER)) {
                return; // Текст не для этого модуля или состояния
            }

            const text = ctx.message.text.trim();
            try { await ctx.deleteMessage(ctx.message.message_id); } catch (e) {} // Удаляем сообщение пользователя

            if (stateData.state === flashcardStates.AWAITING_QUESTION) {
                if (!text) {
                    await ctx.reply("Question cannot be empty. Try again or cancel.").catch(()=>{}); // Отправляем новое
                    return;
                }
                userFlashcardModuleState.set(userId, { state: flashcardStates.AWAITING_ANSWER, tempCard: { q: text } });
                // Редактируем предыдущее сообщение бота (которое просило вопрос)
                // Для этого нужно знать message_id того сообщения. Если мы его не сохранили, отправляем новое.
                // В данном случае, если мы пришли из fc_action_create_start, то ctx.callbackQuery.message есть.
                // Но здесь мы в on('text'), так что его нет. Для простоты отправляем новое.
                // В более сложных сценариях, можно хранить message_id редактируемого сообщения в userFlashcardModuleState.
                await ctx.reply( // Отправляем новое сообщение
                    `Question set: "${text}"\n\n📝 Now enter the **answer** (back side):`,
                    { parse_mode: 'Markdown', reply_markup: Markup.inlineKeyboard([
                        [Markup.button.callback('« Cancel Creation', 'fc_action_cancel_creation')]
                    ]).reply_markup}
                ).catch(()=>{});

            } else if (stateData.state === flashcardStates.AWAITING_ANSWER) {
                if (!text) {
                    await ctx.reply("Answer cannot be empty. Try again or cancel.").catch(()=>{});
                    return;
                }
                const newCard = { ...stateData.tempCard, a: text, id: String(Date.now()) };
                const currentUserCards = userFlashcards.get(userId) || [];
                currentUserCards.push(newCard);
                userFlashcards.set(userId, currentUserCards);
                userFlashcardModuleState.set(userId, { state: flashcardStates.IDLE });
                
                await ctx.reply(`✅ Flashcard created!\nQ: ${newCard.q}\nA: ${newCard.a}`).catch(()=>{});
                await this.showFlashcardsFeatureMenu(ctx, false); // Показываем меню новым сообщением
            }
        });

        console.log('[FlashcardsController] Handlers set up.');
    }
    
    async sendStudyCardQuestion(ctx, userId, cardIndex) {
        const cards = userFlashcards.get(userId) || [];
        if (cardIndex >= cards.length) {
            await ctx.editMessageText("No more cards or error. Returning to menu.", this.getFlashcardsMenuKeyboard(userId));
            return;
        }
        const card = cards[cardIndex];
        const messageText = `📚 Card ${cardIndex + 1}/${cards.length}\n\n**Question:**\n${card.q}`;
        await ctx.editMessageText(messageText, {
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('Show Answer', 'fc_action_study_show_answer')],
                [Markup.button.callback('⏹️ Finish Studying', 'fc_action_study_finish')]
            ]).reply_markup
        });
    }

    async sendStudyCardAnswer(ctx, userId, cardIndex) {
        const cards = userFlashcards.get(userId) || [];
         if (cardIndex >= cards.length) {
            await ctx.editMessageText("Error showing answer. Returning to menu.", this.getFlashcardsMenuKeyboard(userId));
            return;
        }
        const card = cards[cardIndex];
        const messageText = `📚 Card ${cardIndex + 1}/${cards.length}\n\n**Question:**\n${card.q}\n\n---\n\n**Answer:**\n${card.a}`;
         await ctx.editMessageText(messageText, {
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('Next Card ➡️', 'fc_action_study_next_card')],
                [Markup.button.callback('⏹️ Finish Studying', 'fc_action_study_finish')]
            ]).reply_markup
        });
    }
}

function cleanupFlashcardsState(userId) {
    if (userFlashcardModuleState.has(userId)) {
        console.log(`[FlashcardsCleanup] Очистка состояния для пользователя ${userId}`);
        userFlashcardModuleState.delete(userId);
        // userFlashcards (сами карточки) обычно не удаляются при выходе в меню
    }
}

function register(bot) {
    const controller = new FlashcardsController(bot);
    controller.setupHandlers(); // Вызываем настройку обработчиков здесь
    console.log('[FlashcardsController] Feature registered successfully.');
}

module.exports = { register, cleanupFlashcardsState };