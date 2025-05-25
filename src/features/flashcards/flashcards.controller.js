// src/features/flashcards/flashcards.controller.js
const { Markup } = require('telegraf');
const { getBackToMainMenuButton } = require('../../navigation');

const flashcardStates = {
    IDLE: 'fc_idle',
    AWAITING_QUESTION: 'fc_awaiting_question',
    AWAITING_ANSWER: 'fc_awaiting_answer',
    STUDYING_SHOW_QUESTION: 'fc_studying_show_q',
    STUDYING_SHOW_ANSWER: 'fc_studying_show_a',
};

const userFlashcardModuleState = new Map();
const userFlashcards = new Map();

class FlashcardsController {
    constructor(bot) {
        this.bot = bot;
    }

    getFlashcardsMenuKeyboard(userId) {
        const cards = userFlashcards.get(userId) || [];
        const buttons = [
            // CHANGED: Button text to English
            [Markup.button.callback('➕ Create New Card', 'fc_action_create_start')],
        ];
        if (cards.length > 0) {
            // CHANGED: Button text to English
            buttons.push([Markup.button.callback(`📚 Study Cards (${cards.length})`, 'fc_action_study_start')]);
            buttons.push([Markup.button.callback(`👀 View My Cards (${cards.length})`, 'fc_action_view_all')]);
        }
        buttons.push([getBackToMainMenuButton()]);
        return Markup.inlineKeyboard(buttons);
    }

    async showFlashcardsFeatureMenu(ctx, editText = true) {
        const userId = ctx.from.id;
        userFlashcardModuleState.set(userId, { state: flashcardStates.IDLE });
        // CHANGED: Text to English
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

        this.bot.action('menu_flashcards', async (ctx) => {
            await ctx.answerCbQuery().catch(() => {});
            await this.showFlashcardsFeatureMenu(ctx, true);
        });

        this.bot.action('fc_action_create_start', async (ctx) => {
            await ctx.answerCbQuery().catch(() => {});
            const userId = ctx.from.id;
            userFlashcardModuleState.set(userId, { state: flashcardStates.AWAITING_QUESTION });
            // CHANGED: Text and button to English
            await ctx.editMessageText(
                '📝 Please enter the **question** (front side) for your new flashcard:',
                { parse_mode: 'Markdown', reply_markup: Markup.inlineKeyboard([
                    [Markup.button.callback('« Cancel Creation', 'fc_action_cancel_creation')]
                ]).reply_markup}
            );
        });
        
        this.bot.action('fc_action_cancel_creation', async (ctx) => {
            await ctx.answerCbQuery().catch(() => {});
            await this.showFlashcardsFeatureMenu(ctx, true);
        });
        
        this.bot.action('fc_action_study_start', async (ctx) => {
            await ctx.answerCbQuery().catch(() => {});
            const userId = ctx.from.id;
            const cards = userFlashcards.get(userId) || [];
            if (cards.length === 0) {
                // CHANGED: Text to English
                await ctx.editMessageText("You have no cards to study. Create some first!", this.getFlashcardsMenuKeyboard(userId));
                return;
            }
            userFlashcardModuleState.set(userId, { state: flashcardStates.STUDYING_SHOW_QUESTION, currentCardIndex: 0 });
            await this.sendStudyCardQuestion(ctx, userId, 0);
        });

        this.bot.action('fc_action_study_show_answer', async (ctx) => {
            await ctx.answerCbQuery().catch(() => {});
            const userId = ctx.from.id;
            const state = userFlashcardModuleState.get(userId);
            if (!state || state.state !== flashcardStates.STUDYING_SHOW_QUESTION || typeof state.currentCardIndex === 'undefined') {
                // CHANGED: Text to English
                await ctx.editMessageText("Error in study session. Please restart.", this.getFlashcardsMenuKeyboard(userId));
                return;
            }
            userFlashcardModuleState.set(userId, { ...state, state: flashcardStates.STUDYING_SHOW_ANSWER });
            await this.sendStudyCardAnswer(ctx, userId, state.currentCardIndex);
        });
        
        this.bot.action('fc_action_study_next_card', async (ctx) => {
            await ctx.answerCbQuery().catch(() => {});
            const userId = ctx.from.id;
            const state = userFlashcardModuleState.get(userId);
            const cards = userFlashcards.get(userId) || [];
            if (!state || state.state !== flashcardStates.STUDYING_SHOW_ANSWER || typeof state.currentCardIndex === 'undefined' || cards.length === 0) {
                // CHANGED: Text to English
                await ctx.editMessageText("Error in study session. Please restart.", this.getFlashcardsMenuKeyboard(userId));
                return;
            }
            const nextIndex = (state.currentCardIndex + 1) % cards.length;
            userFlashcardModuleState.set(userId, { state: flashcardStates.STUDYING_SHOW_QUESTION, currentCardIndex: nextIndex });
            await this.sendStudyCardQuestion(ctx, userId, nextIndex);
        });

        this.bot.action('fc_action_study_finish', async (ctx) => {
            await ctx.answerCbQuery().catch(() => {});
            await this.showFlashcardsFeatureMenu(ctx, true);
        });
        
        this.bot.action('fc_action_view_all', async (ctx) => {
            await ctx.answerCbQuery().catch(() => {});
            const userId = ctx.from.id;
            const cards = userFlashcards.get(userId) || [];
            // CHANGED: Text to English
            let message = "📚 Your Flashcards:\n\n";
            if (cards.length === 0) {
                // CHANGED: Text to English
                message = "You have no flashcards yet.";
            } else {
                cards.forEach((card, i) => {
                    message += `${i + 1}. **Q:** ${card.q}\n   **A:** ${card.a}\n\n`;
                });
            }
            await ctx.editMessageText(message, { parse_mode: 'Markdown', ...this.getFlashcardsMenuKeyboard(userId) });
        });

        this.bot.on('text', async (ctx) => {
            const userId = ctx.from.id;
            const stateData = userFlashcardModuleState.get(userId);

            if (!stateData || (stateData.state !== flashcardStates.AWAITING_QUESTION && stateData.state !== flashcardStates.AWAITING_ANSWER)) {
                return;
            }

            const text = ctx.message.text.trim();
            try { await ctx.deleteMessage(ctx.message.message_id); } catch (e) {}

            if (stateData.state === flashcardStates.AWAITING_QUESTION) {
                if (!text) {
                    // CHANGED: Text to English
                    await ctx.reply("Question cannot be empty. Try again or cancel.").catch(()=>{});
                    return;
                }
                userFlashcardModuleState.set(userId, { state: flashcardStates.AWAITING_ANSWER, tempCard: { q: text } });
                // CHANGED: Text and button to English
                await ctx.reply(
                    `Question set: "${text}"\n\n📝 Now enter the **answer** (back side):`,
                    { parse_mode: 'Markdown', reply_markup: Markup.inlineKeyboard([
                        [Markup.button.callback('« Cancel Creation', 'fc_action_cancel_creation')]
                    ]).reply_markup}
                ).catch(()=>{});

            } else if (stateData.state === flashcardStates.AWAITING_ANSWER) {
                if (!text) {
                    // CHANGED: Text to English
                    await ctx.reply("Answer cannot be empty. Try again or cancel.").catch(()=>{});
                    return;
                }
                const newCard = { ...stateData.tempCard, a: text, id: String(Date.now()) };
                const currentUserCards = userFlashcards.get(userId) || [];
                currentUserCards.push(newCard);
                userFlashcards.set(userId, currentUserCards);
                userFlashcardModuleState.set(userId, { state: flashcardStates.IDLE });
                // CHANGED: Text to English
                await ctx.reply(`✅ Flashcard created!\nQ: ${newCard.q}\nA: ${newCard.a}`).catch(()=>{});
                await this.showFlashcardsFeatureMenu(ctx, false);
            }
        });

        console.log('[FlashcardsController] Handlers set up.');
    }
    
    async sendStudyCardQuestion(ctx, userId, cardIndex) {
        const cards = userFlashcards.get(userId) || [];
        if (cardIndex >= cards.length) {
            // CHANGED: Text to English
            await ctx.editMessageText("No more cards or error. Returning to menu.", this.getFlashcardsMenuKeyboard(userId));
            return;
        }
        const card = cards[cardIndex];
        // CHANGED: Text and buttons to English
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
            // CHANGED: Text to English
            await ctx.editMessageText("Error showing answer. Returning to menu.", this.getFlashcardsMenuKeyboard(userId));
            return;
        }
        const card = cards[cardIndex];
        // CHANGED: Text and buttons to English
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
        console.log(`[FlashcardsCleanup] Cleaning up state for user ${userId}`);
        userFlashcardModuleState.delete(userId);
    }
}

function register(bot) {
    const controller = new FlashcardsController(bot);
    controller.setupHandlers();
    console.log('[FlashcardsController] Feature registered successfully.');
}

module.exports = { register, cleanupFlashcardsState };