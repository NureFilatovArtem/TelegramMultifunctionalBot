// src/features/deadlines/deadlines.controller.js
const { Markup } = require('telegraf');
const { getBackToMainMenuButton } = require('../../navigation');

// Внутренние состояния для этого модуля
const deadlineInternalStates = {
    IDLE: 'dl_idle',
    AWAITING_TITLE: 'dl_awaiting_title',
    AWAITING_DATE: 'dl_awaiting_date',
    CHOOSING_TO_DELETE: 'dl_choosing_to_delete'
};

// Хранилище состояний пользователей для этого модуля, вынесено для доступа из cleanup функции
const userModuleState = new Map(); 

class DeadlinesController {
    constructor(bot) {
        this.bot = bot;
        this.deadlinesStorage = new Map(); // Временное хранилище (пользовательID -> массив дедлайнов)
    }

    getDeadlinesMenuKeyboard() {
        return Markup.inlineKeyboard([
            [Markup.button.callback('➕ Add New Deadline', 'dl_action_add')],
            [Markup.button.callback('📋 View All Deadlines', 'dl_action_view_all')],
            [Markup.button.callback('❌ Delete Deadline', 'dl_action_delete_select')],
            [getBackToMainMenuButton()] // Используем стандартизированную кнопку
        ]);
    }

    async showDeadlinesFeatureMenu(ctx, editText = true) {
        const userId = ctx.from.id;
        // Устанавливаем состояние IDLE для этого модуля при входе в его меню
        userModuleState.set(userId, { state: deadlineInternalStates.IDLE }); 
        const messageText = '📅 Deadlines Management:';
        const keyboard = this.getDeadlinesMenuKeyboard();

        if (editText && ctx.updateType === 'callback_query' && ctx.callbackQuery.message) {
            try {
                await ctx.editMessageText(messageText, keyboard);
                return;
            } catch (e) {
                console.warn("Deadlines: Could not edit message to show feature menu, sending new.", e.message);
                 if (ctx.callbackQuery.message.from.id === ctx.botInfo.id) {
                    await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(delErr => {});
                 }
            }
        }
        await ctx.reply(messageText, keyboard);
    }

    setupHandlers() {
        console.log('[DeadlinesController] Setting up handlers...');

        // Точка входа из главного меню (из navigation.js -> showMainMenu -> кнопка 'menu_deadlines')
        this.bot.action('menu_deadlines', async (ctx) => {
            await ctx.answerCbQuery().catch(e => {});
            await this.showDeadlinesFeatureMenu(ctx, true);
        });

        // --- Обработчики для кнопок меню дедлайнов ---

        this.bot.action('dl_action_add', async (ctx) => {
            await ctx.answerCbQuery().catch(e => {});
            const userId = ctx.from.id;
            // ИСПРАВЛЕНО: this.userModuleState -> userModuleState
            userModuleState.set(userId, { state: deadlineInternalStates.AWAITING_TITLE });
            await ctx.editMessageText(
                '📝 Please enter the title for your new deadline:',
                Markup.inlineKeyboard([
                    [Markup.button.callback('« Cancel', 'dl_action_cancel_input')]
                ])
            );
        });

        this.bot.action('dl_action_cancel_input', async (ctx) => {
            await ctx.answerCbQuery().catch(e => {});
            await this.showDeadlinesFeatureMenu(ctx, true); // Это сбросит состояние на IDLE
        });

        this.bot.action('dl_action_view_all', async (ctx) => {
            await ctx.answerCbQuery().catch(e => {});
            const userId = ctx.from.id;
            const userDeadlines = this.deadlinesStorage.get(userId) || [];
            let message = '📋 Your Deadlines:\n\n';

            if (userDeadlines.length === 0) {
                message = 'You have no deadlines yet.';
            } else {
                userDeadlines.forEach((d, index) => {
                    message += `${index + 1}. ${d.title} (Due: ${d.date})\n`;
                });
            }
            await ctx.editMessageText(message, this.getDeadlinesMenuKeyboard());
        });

        this.bot.action('dl_action_delete_select', async (ctx) => {
            await ctx.answerCbQuery().catch(e => {});
            const userId = ctx.from.id;
            const userDeadlines = this.deadlinesStorage.get(userId) || [];

            if (userDeadlines.length === 0) {
                await ctx.editMessageText('You have no deadlines to delete.', this.getDeadlinesMenuKeyboard());
                return;
            }
            // ИСПРАВЛЕНО: this.userModuleState -> userModuleState
            userModuleState.set(userId, { state: deadlineInternalStates.CHOOSING_TO_DELETE });
            const deleteButtons = userDeadlines.map((deadline, index) =>
                [Markup.button.callback(`${index + 1}. ${deadline.title} (${deadline.date})`, `dl_action_delete_confirm_${index}`)]
            );
            deleteButtons.push([Markup.button.callback('« Cancel Deletion', 'dl_action_cancel_input')]);

            await ctx.editMessageText('Select a deadline to delete:', Markup.inlineKeyboard(deleteButtons));
        });

        this.bot.action(/dl_action_delete_confirm_(\d+)/, async (ctx) => {
            await ctx.answerCbQuery().catch(e => {});
            const userId = ctx.from.id;
            const indexToDelete = parseInt(ctx.match[1], 10);
            const userDeadlines = this.deadlinesStorage.get(userId) || [];

            if (indexToDelete >= 0 && indexToDelete < userDeadlines.length) {
                const deleted = userDeadlines.splice(indexToDelete, 1);
                this.deadlinesStorage.set(userId, userDeadlines);
                await ctx.editMessageText(`✅ Deadline "${deleted[0].title}" deleted successfully.`, this.getDeadlinesMenuKeyboard());
            } else {
                await ctx.editMessageText('❌ Invalid selection for deletion.', this.getDeadlinesMenuKeyboard());
            }
            // ИСПРАВЛЕНО: this.userModuleState -> userModuleState
            userModuleState.set(userId, { state: deadlineInternalStates.IDLE });
        });

        // --- Обработка текстового ввода ---
        this.bot.on('text', async (ctx) => {
            const userId = ctx.from.id;
            // ИСПРАВЛЕНО: this.userModuleState -> userModuleState
            const moduleStateData = userModuleState.get(userId);

            if (!moduleStateData || !moduleStateData.state || moduleStateData.state === deadlineInternalStates.IDLE) {
                 // Если состояние IDLE или не определено для этого модуля, ничего не делаем.
                 // Это важно, чтобы текстовый ввод для других модулей не обрабатывался здесь.
                return;
            }

            // Удаляем сообщение пользователя с текстом, чтобы не засорять чат с инлайн кнопками
            try { await ctx.deleteMessage(ctx.message.message_id); } catch (e) { /* бывает, если быстро */ }

            switch (moduleStateData.state) {
                case deadlineInternalStates.AWAITING_TITLE:
                    const title = ctx.message.text.trim();
                    if (!title) {
                        // Нужно найти предыдущее сообщение бота и отредактировать его или отправить новое
                        // Для простоты, пока отправим новое с напоминанием.
                        await ctx.reply("Title cannot be empty. Please try again or cancel.", Markup.inlineKeyboard([[Markup.button.callback('« Cancel', 'dl_action_cancel_input')]])).catch(e => {});
                        return;
                    }
                    // ИСПРАВЛЕНО: this.userModuleState -> userModuleState
                    userModuleState.set(userId, { state: deadlineInternalStates.AWAITING_DATE, title: title });
                    
                    // Пытаемся найти исходное сообщение (которое было "Please enter title...") и отредактировать его
                    // Это сложно, если нет ctx.callbackQuery.message.
                    // Проще отправить новое или отредактировать сообщение, если оно было отправлено ботом и содержит кнопки.
                    // В данном случае, предыдущее сообщение (с просьбой ввести заголовок) было от бота.
                    // Если мы храним message_id этого сообщения, можно его отредактировать.
                    // Пока что упростим:
                    // Попытка отредактировать последнее сообщение бота, если оно было инлайн-меню.
                    // Но это не всегда будет то сообщение, которое нужно редактировать.
                    // Лучше, если AWAITING_TITLE было установлено через action, и мы можем использовать ctx.editMessageText
                    // на ctx.callbackQuery.message.message_id.
                    // Так как мы сюда попадаем из on('text'), ctx.callbackQuery не будет.
                    // Поэтому, отправляем новое сообщение.
                    await ctx.reply(
                        `Title set: "${title}".\n🗓️ Now enter the date (YYYY-MM-DD):`,
                        Markup.inlineKeyboard([[Markup.button.callback('« Cancel', 'dl_action_cancel_input')]])
                    );
                    break;

                case deadlineInternalStates.AWAITING_DATE:
                    const dateStr = ctx.message.text.trim();
                    const currentTitle = moduleStateData.title;

                    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                        await ctx.reply(
                            `❌ Invalid date format: "${dateStr}".\nPlease use YYYY-MM-DD or cancel:`,
                            Markup.inlineKeyboard([[Markup.button.callback('« Cancel', 'dl_action_cancel_input')]])
                        );
                        return;
                    }

                    const userDeadlines = this.deadlinesStorage.get(userId) || [];
                    userDeadlines.push({ id: String(Date.now()), title: currentTitle, date: dateStr });
                    this.deadlinesStorage.set(userId, userDeadlines);
                    
                    // Отправляем новое сообщение с подтверждением и главным меню дедлайнов
                    await ctx.reply(
                        `✅ Deadline "${currentTitle}" for ${dateStr} added!`
                    );
                    // ИСПРАВЛЕНО: this.userModuleState -> userModuleState
                    userModuleState.set(userId, { state: deadlineInternalStates.IDLE });
                    await this.showDeadlinesFeatureMenu(ctx, false); // Показываем меню фичи новым сообщением
                    break;
            }
        });
        console.log('[DeadlinesController] Handlers set up.');
    }
}

/**
 * Функция для очистки состояния пользователя в модуле Deadlines.
 * @param {number} userId 
 */
function cleanupDeadlinesState(userId) {
    if (userModuleState.has(userId)) {
        console.log(`[DeadlinesCleanup] Очистка состояния для пользователя ${userId}`);
        userModuleState.delete(userId);
    }
}

function register(bot) {
    const controller = new DeadlinesController(bot);
    if (controller.setupHandlers) {
        controller.setupHandlers();
    } else {
        console.error("DeadlinesController.setupHandlers is not defined!");
    }
    console.log('Deadlines feature registered successfully.');
}

module.exports = { register, cleanupDeadlinesState };