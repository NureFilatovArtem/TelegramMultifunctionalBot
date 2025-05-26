// src/navigation.js
const { Markup } = require('telegraf');

const ACTION_SHOW_MAIN_MENU = 'nav_show_main_menu';
const ACTION_BACK_TO_MAIN_MENU = 'nav_back_to_main_menu';
const featureStateCleanupCallbacks = [];

function registerFeatureStateCleanup(cleanupFn) {
    featureStateCleanupCallbacks.push(cleanupFn);
}

function cleanupAllFeatureStatesForUser(userId) {
    console.log(`[Navigation] Cleaning up feature states for user ${userId}`);
    featureStateCleanupCallbacks.forEach(fn => {
        try { fn(userId); } catch (e) { console.error(`[Navigation] Error during cleanup:`, e); }
    });
}

async function showMainMenu(ctx, attemptEdit = false) { // attemptEdit теперь всегда будет false по умолчанию из мест вызова
    const userId = ctx.from.id;
    cleanupAllFeatureStatesForUser(userId);

    const messageText = '👋 Welcome to the Main Menu! Please choose an option:';
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📅 Deadlines', 'menu_deadlines')],
        [Markup.button.callback('🇬🇧 English Improvement', 'english_improvement')],
        [Markup.button.callback('🎯 Flashcards', 'menu_flashcards')],
        [Markup.button.callback('🚀 Motivation', 'menu_motivation_start')],
    ]);

    // ВСЕГДА ОТПРАВЛЯЕМ НОВОЕ СООБЩЕНИЕ
    // Можно опционально удалять предыдущее сообщение бота с инлайн-клавиатурой, если оно было
    if (ctx.updateType === 'callback_query' && ctx.callbackQuery.message && ctx.callbackQuery.message.from.id === ctx.botInfo.id) {
        try {
            // Пытаемся удалить старую инлайн-клавиатуру, чтобы не было "мертвых" кнопок
            // await ctx.editMessageReplyMarkup(null); // Удаляем только кнопки
            // ИЛИ удаляем все сообщение
            await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
        } catch (e) {
            console.warn("Could not delete or remove markup from previous message:", e.message);
        }
    }
    await ctx.reply(messageText, keyboard).catch(e => console.error("Error sending main menu:", e));
}

function getBackToMainMenuButton() {
    return Markup.button.callback('« Back to Main Menu', ACTION_BACK_TO_MAIN_MENU);
}

function setupGlobalNavigationHandlers(bot) {
    bot.action(ACTION_SHOW_MAIN_MENU, async (ctx) => {
        await ctx.answerCbQuery().catch(e => {});
        await showMainMenu(ctx, false); // Всегда false для нового сообщения
    });

    bot.action(ACTION_BACK_TO_MAIN_MENU, async (ctx) => {
        await ctx.answerCbQuery().catch(e => {});
        await showMainMenu(ctx, false); // Всегда false для нового сообщения
    });

    bot.command('start', async (ctx) => {
        await showMainMenu(ctx, false); // Всегда false для нового сообщения
    });

    console.log('[Navigation] Global navigation handlers set up (no edit mode).');
}

module.exports = {
    showMainMenu,
    getBackToMainMenuButton,
    setupGlobalNavigationHandlers,
    registerFeatureStateCleanup,
    ACTION_SHOW_MAIN_MENU,
    ACTION_BACK_TO_MAIN_MENU
};