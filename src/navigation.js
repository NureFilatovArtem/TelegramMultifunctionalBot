// src/navigation.js
const { Markup } = require('telegraf');

// Стандартные идентификаторы действий для навигации
const ACTION_SHOW_MAIN_MENU = 'nav_show_main_menu';
const ACTION_BACK_TO_MAIN_MENU = 'nav_back_to_main_menu';

// Сюда будем регистрировать функции очистки состояния от каждой фичи
const featureStateCleanupCallbacks = [];

/**
 * Регистрирует функцию для очистки состояния конкретной фичи.
 * Эта функция будет вызвана при возврате пользователя в главное меню.
 * @param {function(userId: number): void} cleanupFn Функция, принимающая userId.
 */
function registerFeatureStateCleanup(cleanupFn) {
    featureStateCleanupCallbacks.push(cleanupFn);
}

/**
 * Вызывает все зарегистрированные функции очистки состояния для пользователя.
 * @param {number} userId ID пользователя.
 */
function cleanupAllFeatureStatesForUser(userId) {
    console.log(`[Navigation] Очистка состояний фич для пользователя ${userId}`);
    featureStateCleanupCallbacks.forEach(fn => {
        try {
            fn(userId);
        } catch (e) {
            console.error(`[Navigation] Ошибка при очистке состояния фичи для пользователя ${userId}:`, e);
        }
    });
}

/**
 * Отображает главное меню.
 * @param {object} ctx Контекст Telegraf.
 * @param {boolean} attemptEdit Пытаться ли редактировать предыдущее сообщение.
 */
async function showMainMenu(ctx, attemptEdit = false) {
    const userId = ctx.from.id;
    // Важно: Очищаем состояния всех фич перед показом главного меню!
    cleanupAllFeatureStatesForUser(userId);

    const messageText = '👋 Добро пожаловать в Главное Меню! Выберите опцию:';
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📅 Дедлайны', 'menu_deadlines')],
        [Markup.button.callback('🇬🇧 Улучшение Английского', 'english_improvement')],
        [Markup.button.callback('🎯 Флеш-карты', 'menu_flashcards')],
        [Markup.button.callback('🚀 Мотивация', 'menu_motivation')], // Добавил кнопку для мотивации
        // [Markup.button.callback('😂 GIF-ки', 'menu_gifs')], // Если для GIF будет меню
    ]);

    try {
        if (attemptEdit && ctx.updateType === 'callback_query' && ctx.callbackQuery.message) {
            await ctx.editMessageText(messageText, keyboard);
        } else {
            if (ctx.updateType === 'callback_query' && ctx.callbackQuery.message && ctx.callbackQuery.message.from.id === ctx.botInfo.id) {
                await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(e => console.warn("Не удалось удалить предыдущее сообщение:", e.message));
            }
            await ctx.reply(messageText, keyboard);
        }
    } catch (error) {
        console.error('[Navigation] Ошибка при показе главного меню:', error);
        if (ctx.updateType === 'callback_query' && ctx.callbackQuery.message && ctx.callbackQuery.message.from.id === ctx.botInfo.id) {
            await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(e => {});
        }
        await ctx.reply(messageText, keyboard).catch(eReply => console.error("Ошибка при отправке запасного главного меню:", eReply));
    }
}

/**
 * Возвращает стандартизированную кнопку "Назад в Главное Меню".
 */
function getBackToMainMenuButton() {
    return Markup.button.callback('« В Главное Меню', ACTION_BACK_TO_MAIN_MENU);
}

/**
 * Настраивает глобальные обработчики навигации.
 * @param {object} bot Экземпляр Telegraf.
 */
function setupGlobalNavigationHandlers(bot) {
    // Действие для прямого отображения главного меню (например, из команды /start)
    bot.action(ACTION_SHOW_MAIN_MENU, async (ctx) => {
        await ctx.answerCbQuery().catch(e => {});
        await showMainMenu(ctx, true);
    });

    // Глобальное действие для возврата в главное меню из любой фичи
    bot.action(ACTION_BACK_TO_MAIN_MENU, async (ctx) => {
        await ctx.answerCbQuery().catch(e => {});
        await showMainMenu(ctx, true);
    });

    bot.command('start', async (ctx) => {
        await showMainMenu(ctx, false);
    });

    // Обработчик для кнопки "menu_motivation" из главного меню
    // Это действие будет перенаправлять на соответствующий контроллер
    bot.action('menu_motivation', (ctx) => {
        // Предполагается, что контроллер мотивации сам обработает команду /motivation
        // или мы можем вызвать его метод здесь, если он так спроектирован.
        // Для простоты, пока что просто вызываем /motivation
        // Лучше, чтобы 'menu_motivation' напрямую вызывало метод из MotivationController,
        // аналогично 'menu_deadlines'
        // В данном случае, пусть пока будет так, но в идеале MotivationController должен иметь action-хендлер
        ctx.answerCbQuery().catch(e => {});
        ctx.reply("Для управления подпиской на мотивацию, используйте команду /motivation");
        // Если MotivationController будет иметь метод типа showMotivationMenu(ctx), то:
        // const motivationController = require('./src/features/motivation/motivation.controller').getControllerInstance(bot); // (нужно будет рефакторить motivation.controller)
        // motivationController.showMotivationMenu(ctx);
    });


    console.log('[Navigation] Глобальные обработчики навигации настроены.');
}

module.exports = {
    showMainMenu,
    getBackToMainMenuButton,
    setupGlobalNavigationHandlers,
    registerFeatureStateCleanup,
    ACTION_SHOW_MAIN_MENU,
    ACTION_BACK_TO_MAIN_MENU
};