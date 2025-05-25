// src/navigation.js
const { Markup } = require('telegraf');

// Standard action identifiers for navigation
const ACTION_SHOW_MAIN_MENU = 'nav_show_main_menu';
const ACTION_BACK_TO_MAIN_MENU = 'nav_back_to_main_menu';

const featureStateCleanupCallbacks = [];

function registerFeatureStateCleanup(cleanupFn) {
    featureStateCleanupCallbacks.push(cleanupFn);
}

function cleanupAllFeatureStatesForUser(userId) {
    console.log(`[Navigation] Cleaning up feature states for user ${userId}`);
    featureStateCleanupCallbacks.forEach(fn => {
        try {
            fn(userId);
        } catch (e) {
            console.error(`[Navigation] Error during feature state cleanup for user ${userId}:`, e);
        }
    });
}

async function showMainMenu(ctx, attemptEdit = false) {
    const userId = ctx.from.id;
    cleanupAllFeatureStatesForUser(userId);

    // CHANGED: Text to English
    const messageText = '👋 Welcome to the Main Menu! Please choose an option:';
    const keyboard = Markup.inlineKeyboard([
        // CHANGED: Button text to English
        [Markup.button.callback('📅 Deadlines', 'menu_deadlines')],
        [Markup.button.callback('🇬🇧 English Improvement', 'english_improvement')],
        [Markup.button.callback('🎯 Flashcards', 'menu_flashcards')],
        [Markup.button.callback('🚀 Motivation', 'menu_motivation_start')], // Action 'menu_motivation_start' is handled in motivation.controller
        // [Markup.button.callback('😂 GIFs', 'menu_gifs')],
    ]);

    try {
        if (attemptEdit && ctx.updateType === 'callback_query' && ctx.callbackQuery.message) {
            await ctx.editMessageText(messageText, keyboard);
        } else {
            if (ctx.updateType === 'callback_query' && ctx.callbackQuery.message && ctx.callbackQuery.message.from.id === ctx.botInfo.id) {
                await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(e => console.warn("Could not delete previous message:", e.message));
            }
            await ctx.reply(messageText, keyboard);
        }
    } catch (error) {
        console.error('[Navigation] Error showing main menu:', error);
        if (ctx.updateType === 'callback_query' && ctx.callbackQuery.message && ctx.callbackQuery.message.from.id === ctx.botInfo.id) {
            await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(e => {});
        }
        await ctx.reply(messageText, keyboard).catch(eReply => console.error("Error sending fallback main menu:", eReply));
    }
}

function getBackToMainMenuButton() {
    // CHANGED: Button text to English
    return Markup.button.callback('« Back to Main Menu', ACTION_BACK_TO_MAIN_MENU);
}

function setupGlobalNavigationHandlers(bot) {
    bot.action(ACTION_SHOW_MAIN_MENU, async (ctx) => {
        await ctx.answerCbQuery().catch(e => {});
        await showMainMenu(ctx, true);
    });

    bot.action(ACTION_BACK_TO_MAIN_MENU, async (ctx) => {
        await ctx.answerCbQuery().catch(e => {});
        await showMainMenu(ctx, true);
    });

    bot.command('start', async (ctx) => {
        await showMainMenu(ctx, false);
    });

    // The handler for 'menu_motivation_start' is now in motivation.controller.js
    // So, we don't need a specific handler for it here anymore.

    console.log('[Navigation] Global navigation handlers set up.');
}

module.exports = {
    showMainMenu,
    getBackToMainMenuButton,
    setupGlobalNavigationHandlers,
    registerFeatureStateCleanup,
    ACTION_SHOW_MAIN_MENU,
    ACTION_BACK_TO_MAIN_MENU
};