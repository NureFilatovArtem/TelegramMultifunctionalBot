// src/features/deadlines/deadlines.controller.js
const { Markup } = require('telegraf');
const { getBackToMainMenuButton } = require('../../navigation');

const deadlineInternalStates = {
    IDLE: 'dl_idle',
    AWAITING_TITLE: 'dl_awaiting_title',
    AWAITING_DATE: 'dl_awaiting_date',
    CHOOSING_TO_DELETE: 'dl_choosing_to_delete'
};

const userModuleState = new Map(); 

class DeadlinesController {
    constructor(bot) {
        this.bot = bot;
        this.deadlinesStorage = new Map();
    }

    getDeadlinesMenuKeyboard() {
        return Markup.inlineKeyboard([
            // CHANGED: Button text to English
            [Markup.button.callback('➕ Add New Deadline', 'dl_action_add')],
            [Markup.button.callback('📋 View All Deadlines', 'dl_action_view_all')],
            [Markup.button.callback('❌ Delete Deadline', 'dl_action_delete_select')],
            [getBackToMainMenuButton()]
        ]);
    }

    async showDeadlinesFeatureMenu(ctx, editText = true) {
        const userId = ctx.from.id;
        userModuleState.set(userId, { state: deadlineInternalStates.IDLE }); 
        // CHANGED: Text to English
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

        this.bot.action('menu_deadlines', async (ctx) => {
            await ctx.answerCbQuery().catch(e => {});
            await this.showDeadlinesFeatureMenu(ctx, true);
        });

        this.bot.action('dl_action_add', async (ctx) => {
            await ctx.answerCbQuery().catch(e => {});
            const userId = ctx.from.id;
            userModuleState.set(userId, { state: deadlineInternalStates.AWAITING_TITLE });
            // CHANGED: Text and button to English
            await ctx.editMessageText(
                '📝 Please enter the title for your new deadline:',
                Markup.inlineKeyboard([
                    [Markup.button.callback('« Cancel', 'dl_action_cancel_input')]
                ])
            );
        });

        this.bot.action('dl_action_cancel_input', async (ctx) => {
            await ctx.answerCbQuery().catch(e => {});
            await this.showDeadlinesFeatureMenu(ctx, true);
        });

        this.bot.action('dl_action_view_all', async (ctx) => {
            await ctx.answerCbQuery().catch(e => {});
            const userId = ctx.from.id;
            const userDeadlines = this.deadlinesStorage.get(userId) || [];
            // CHANGED: Text to English
            let message = '📋 Your Deadlines:\n\n';

            if (userDeadlines.length === 0) {
                // CHANGED: Text to English
                message = 'You have no deadlines yet.';
            } else {
                userDeadlines.forEach((d, index) => {
                    // CHANGED: Text to English (Due)
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
                // CHANGED: Text to English
                await ctx.editMessageText('You have no deadlines to delete.', this.getDeadlinesMenuKeyboard());
                return;
            }
            userModuleState.set(userId, { state: deadlineInternalStates.CHOOSING_TO_DELETE });
            const deleteButtons = userDeadlines.map((deadline, index) =>
                [Markup.button.callback(`${index + 1}. ${deadline.title} (${deadline.date})`, `dl_action_delete_confirm_${index}`)]
            );
            // CHANGED: Button text to English
            deleteButtons.push([Markup.button.callback('« Cancel Deletion', 'dl_action_cancel_input')]);
            // CHANGED: Text to English
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
                // CHANGED: Text to English
                await ctx.editMessageText(`✅ Deadline "${deleted[0].title}" deleted successfully.`, this.getDeadlinesMenuKeyboard());
            } else {
                // CHANGED: Text to English
                await ctx.editMessageText('❌ Invalid selection for deletion.', this.getDeadlinesMenuKeyboard());
            }
            userModuleState.set(userId, { state: deadlineInternalStates.IDLE });
        });

        this.bot.on('text', async (ctx) => {
            const userId = ctx.from.id;
            const moduleStateData = userModuleState.get(userId);

            if (!moduleStateData || !moduleStateData.state || moduleStateData.state === deadlineInternalStates.IDLE) {
                return;
            }
            try { await ctx.deleteMessage(ctx.message.message_id); } catch (e) {}

            switch (moduleStateData.state) {
                case deadlineInternalStates.AWAITING_TITLE:
                    const title = ctx.message.text.trim();
                    if (!title) {
                        // CHANGED: Text and button to English
                        await ctx.reply("Title cannot be empty. Please try again or cancel.", Markup.inlineKeyboard([[Markup.button.callback('« Cancel', 'dl_action_cancel_input')]])).catch(e => {});
                        return;
                    }
                    userModuleState.set(userId, { state: deadlineInternalStates.AWAITING_DATE, title: title });
                    // CHANGED: Text and button to English
                    await ctx.reply(
                        `Title set: "${title}".\n🗓️ Now enter the date (YYYY-MM-DD):`,
                        Markup.inlineKeyboard([[Markup.button.callback('« Cancel', 'dl_action_cancel_input')]])
                    );
                    break;

                case deadlineInternalStates.AWAITING_DATE:
                    const dateStr = ctx.message.text.trim();
                    const currentTitle = moduleStateData.title;

                    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                        // CHANGED: Text and button to English
                        await ctx.reply(
                            `❌ Invalid date format: "${dateStr}".\nPlease use YYYY-MM-DD or cancel:`,
                            Markup.inlineKeyboard([[Markup.button.callback('« Cancel', 'dl_action_cancel_input')]])
                        );
                        return;
                    }
                    const userDeadlines = this.deadlinesStorage.get(userId) || [];
                    userDeadlines.push({ id: String(Date.now()), title: currentTitle, date: dateStr });
                    this.deadlinesStorage.set(userId, userDeadlines);
                    // CHANGED: Text to English
                    await ctx.reply(
                        `✅ Deadline "${currentTitle}" for ${dateStr} added!`
                    );
                    userModuleState.set(userId, { state: deadlineInternalStates.IDLE });
                    await this.showDeadlinesFeatureMenu(ctx, false);
                    break;
            }
        });
        console.log('[DeadlinesController] Handlers set up.');
    }
}

function cleanupDeadlinesState(userId) {
    if (userModuleState.has(userId)) {
        console.log(`[DeadlinesCleanup] Cleaning up state for user ${userId}`);
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