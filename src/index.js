const { Telegraf, Markup } = require('telegraf');

console.log('Bot is starting...');

const bot = new Telegraf('8045993727:AAFqdqhRTNkk1zojrjKjVbPpvZ9ySlUWbxM');

// User states and data storage
const userStates = new Map();
const userTasks = new Map();

// Main menu keyboard
const mainMenuButtons = Markup.inlineKeyboard([
    [
        Markup.button.callback('📝 Tasks & Deadlines', 'menu_deadlines'),
        Markup.button.callback('💬 Translate', 'menu_translate')
    ],
    [
        Markup.button.callback('📌 Notes', 'menu_notes'),
        Markup.button.callback('🎯 Flashcards', 'menu_flashcards')
    ],
    [
        Markup.button.callback('🌄 GIFs', 'menu_gifs'),
        Markup.button.callback('🧘 Motivation', 'menu_motivation')
    ],
    [
        Markup.button.callback('📤 Email FWD', 'menu_email'),
        Markup.button.callback('📄 PDF Maker', 'menu_pdf')
    ]
]);

// Task management keyboards
const tasksSubmenu = Markup.inlineKeyboard([
    [Markup.button.callback('➕ Add Task', 'deadline_add')],
    [Markup.button.callback('📋 View All', 'deadline_view')],
    [Markup.button.callback('❌ Delete', 'deadline_delete')],
    [Markup.button.callback('« Back to Main Menu', 'back_main')]
]);

const notificationOptions = Markup.inlineKeyboard([
    [
        Markup.button.callback('5 days before', 'notify_5days'),
        Markup.button.callback('3 days before', 'notify_3days')
    ],
    [
        Markup.button.callback('1 day before', 'notify_1day'),
        Markup.button.callback('Same day', 'notify_same')
    ],
    [Markup.button.callback('Custom reminder', 'notify_custom')],
    [Markup.button.callback('Skip notifications', 'notify_skip')]
]);

// Submenu keyboards
const deadlinesSubmenu = Markup.inlineKeyboard([
    [Markup.button.callback('➕ Add Deadline', 'deadline_add')],
    [Markup.button.callback('📋 View All', 'deadline_view')],
    [Markup.button.callback('❌ Delete', 'deadline_delete')],
    [Markup.button.callback('« Back to Main Menu', 'back_main')]
]);

const translateSubmenu = Markup.inlineKeyboard([
    [
        Markup.button.callback('🇬🇧 EN → 🇺🇦 UK', 'translate_en_uk'),
        Markup.button.callback('🇺🇦 UK → 🇬🇧 EN', 'translate_uk_en')
    ],
    [
        Markup.button.callback('🇷🇺 RU → 🇺🇦 UK', 'translate_ru_uk'),
        Markup.button.callback('🇺🇦 UK → 🇷🇺 RU', 'translate_uk_ru')
    ],
    [Markup.button.callback('« Back to Main Menu', 'back_main')]
]);

const notesSubmenu = Markup.inlineKeyboard([
    [Markup.button.callback('📝 New Note', 'note_new')],
    [Markup.button.callback('📖 View Notes', 'note_view')],
    [Markup.button.callback('🗑️ Delete Note', 'note_delete')],
    [Markup.button.callback('« Back to Main Menu', 'back_main')]
]);

const flashcardsSubmenu = Markup.inlineKeyboard([
    [Markup.button.callback('➕ Create Card', 'flashcard_create')],
    [Markup.button.callback('📚 Study', 'flashcard_study')],
    [Markup.button.callback('🔍 View All', 'flashcard_view')],
    [Markup.button.callback('« Back to Main Menu', 'back_main')]
]);

// Verify bot connection
bot.telegram.getMe().then((botInfo) => {
    console.log('Connected successfully!');
    console.log('Bot info:', botInfo);
}).catch((err) => {
    console.error('Failed to get bot info:', err);
});

// Start command
bot.command('start', (ctx) => {
    userStates.set(ctx.from.id, { state: 'main' });
    return ctx.reply(
        '👋 Welcome to MultiFunction Bot!\n\n' +
        'Choose what you want to do:',
        mainMenuButtons
    );
});

// Handle menu callbacks
bot.action('menu_deadlines', async (ctx) => {
    await ctx.answerCbQuery();
    userStates.set(ctx.from.id, { state: 'deadlines' });
    await ctx.reply('📝 Task Management:', tasksSubmenu);
});

bot.action('menu_translate', async (ctx) => {
    await ctx.answerCbQuery();
    userStates.set(ctx.from.id, { state: 'translate' });
    await ctx.reply('💬 Translation Menu:', translateSubmenu);
});

bot.action('menu_notes', async (ctx) => {
    await ctx.answerCbQuery();
    userStates.set(ctx.from.id, { state: 'notes' });
    await ctx.reply('📌 Notes Menu:', notesSubmenu);
});

bot.action('menu_flashcards', async (ctx) => {
    await ctx.answerCbQuery();
    userStates.set(ctx.from.id, { state: 'flashcards' });
    await ctx.reply('🎯 Flashcards Menu:', flashcardsSubmenu);
});

// Handle other menu options
['menu_gifs', 'menu_motivation', 'menu_email', 'menu_pdf'].forEach(menu => {
    bot.action(menu, async (ctx) => {
        await ctx.answerCbQuery();
        const featureName = menu.replace('menu_', '').toUpperCase();
        await ctx.reply(
            `${featureName} feature coming soon...`,
            Markup.inlineKeyboard([[Markup.button.callback('« Back to Main Menu', 'back_main')]])
        );
    });
});

// Handle back to main menu
bot.action('back_main', async (ctx) => {
    await ctx.answerCbQuery();
    userStates.set(ctx.from.id, { state: 'main' });
    await ctx.reply('Main Menu:', mainMenuButtons);
});

// Handle task actions
bot.action('deadline_add', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    userStates.set(userId, { state: 'deadline_add_title' });
    await ctx.reply('Enter your task title:');
});

// Handle notification settings
bot.action(/notify_(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const match = ctx.match[1];
    const userData = userStates.get(userId);
    
    if (!userData || !userData.currentTask) {
        await ctx.reply('Something went wrong. Please try adding the task again.');
        return;
    }

    let notificationDays;
    let notificationText;

    switch (match) {
        case '5days':
            notificationDays = 5;
            notificationText = '5 days before';
            break;
        case '3days':
            notificationDays = 3;
            notificationText = '3 days before';
            break;
        case '1day':
            notificationDays = 1;
            notificationText = '1 day before';
            break;
        case 'same':
            notificationDays = 0;
            notificationText = 'on the same day';
            break;
        case 'custom':
            userStates.set(userId, { 
                ...userData, 
                state: 'deadline_custom_notification',
            });
            await ctx.reply('Enter how many days before the deadline you want to be notified:');
            return;
        case 'skip':
            notificationDays = null;
            notificationText = 'no notifications';
            break;
    }

    // Save the task with notifications
    const userTaskList = userTasks.get(userId) || [];
    userTaskList.push({
        ...userData.currentTask,
        notificationDays,
        created: new Date()
    });
    userTasks.set(userId, userTaskList);

    await ctx.reply(
        `✅ Task added successfully!\n\n` +
        `Title: ${userData.currentTask.title}\n` +
        `Due date: ${userData.currentTask.dueDate}\n` +
        `Notification: ${notificationText}`,
        tasksSubmenu
    );

    userStates.set(userId, { state: 'deadlines' });
});

// Handle text messages based on user state
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const userData = userStates.get(userId);
    const userState = userData?.state;

    if (!userState) {
        await ctx.reply('Please use the menu buttons to interact with the bot.');
        return;
    }

    switch (userState) {
        case 'deadline_add_title':
            // Save task title and ask for due date
            userStates.set(userId, { 
                state: 'deadline_add_date',
                currentTask: { title: ctx.message.text }
            });
            await ctx.reply(
                'Enter the due date for your task:\n' +
                'Use format DD.MM.YYYY (example: 25.12.2024)'
            );
            break;

        case 'deadline_add_date':
            const dateText = ctx.message.text;
            const dateRegex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
            const match = dateText.match(dateRegex);

            if (!match) {
                await ctx.reply(
                    '❌ Invalid date format!\n' +
                    'Please use DD.MM.YYYY (example: 25.12.2024)'
                );
                return;
            }

            const [_, day, month, year] = match;
            const dueDate = new Date(year, month - 1, day);
            
            if (isNaN(dueDate.getTime()) || dueDate < new Date()) {
                await ctx.reply('❌ Please enter a valid future date!');
                return;
            }

            // Save the date and show notification options
            userStates.set(userId, {
                ...userData,
                state: 'deadline_add_notification',
                currentTask: {
                    ...userData.currentTask,
                    dueDate: dateText
                }
            });

            await ctx.reply(
                'When would you like to be notified about this task?',
                notificationOptions
            );
            break;

        case 'deadline_custom_notification':
            const days = parseInt(ctx.message.text);
            if (isNaN(days) || days < 0) {
                await ctx.reply('Please enter a valid number of days (0 or more)');
                return;
            }

            const userTaskList = userTasks.get(userId) || [];
            userTaskList.push({
                ...userData.currentTask,
                notificationDays: days,
                created: new Date()
            });
            userTasks.set(userId, userTaskList);

            await ctx.reply(
                `✅ Task added successfully!\n\n` +
                `Title: ${userData.currentTask.title}\n` +
                `Due date: ${userData.currentTask.dueDate}\n` +
                `Notification: ${days} days before`,
                tasksSubmenu
            );

            userStates.set(userId, { state: 'deadlines' });
            break;

        default:
            await ctx.reply('Please use the menu buttons to interact with the bot.');
    }
});

// View all tasks
bot.action('deadline_view', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const userTaskList = userTasks.get(userId) || [];

    if (userTaskList.length === 0) {
        await ctx.reply('You have no tasks yet!', tasksSubmenu);
        return;
    }

    const taskMessages = userTaskList
        .sort((a, b) => {
            const dateA = parseDate(a.dueDate);
            const dateB = parseDate(b.dueDate);
            return dateA - dateB;
        })
        .map((task, index) => {
            const notificationText = task.notificationDays === null 
                ? 'No notifications'
                : `Notification: ${task.notificationDays} days before`;
            
            return `${index + 1}. "${task.title}"\n` +
                   `📅 Due: ${task.dueDate}\n` +
                   `🔔 ${notificationText}\n`;
        })
        .join('\n');

    await ctx.reply(
        '📋 Your Tasks:\n\n' + taskMessages,
        tasksSubmenu
    );
});

// Delete task
bot.action('deadline_delete', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const userTaskList = userTasks.get(userId) || [];

    if (userTaskList.length === 0) {
        await ctx.reply('You have no tasks to delete!', tasksSubmenu);
        return;
    }

    const deleteButtons = userTaskList.map((task, index) => {
        return [Markup.button.callback(
            `${index + 1}. ${task.title} (${task.dueDate})`,
            `delete_task_${index}`
        )];
    });

    deleteButtons.push([Markup.button.callback('« Back', 'menu_deadlines')]);

    await ctx.reply(
        'Select task to delete:',
        Markup.inlineKeyboard(deleteButtons)
    );
});

// Handle delete task selection
bot.action(/delete_task_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const taskIndex = parseInt(ctx.match[1]);
    const userTaskList = userTasks.get(userId) || [];

    if (taskIndex >= 0 && taskIndex < userTaskList.length) {
        const deletedTask = userTaskList.splice(taskIndex, 1)[0];
        userTasks.set(userId, userTaskList);
        await ctx.reply(
            `✅ Task "${deletedTask.title}" deleted successfully!`,
            tasksSubmenu
        );
    } else {
        await ctx.reply('Error deleting task. Please try again.', tasksSubmenu);
    }
});

// Helper function to parse date
function parseDate(dateStr) {
    const [day, month, year] = dateStr.split('.');
    return new Date(year, month - 1, day);
}

// Launch bot
console.log('Connecting to Telegram...');

bot.launch()
    .then(() => {
        console.log('✅ Bot is running!');
        console.log('Bot username:', bot.botInfo?.username);
    })
    .catch((err) => {
        console.error('Error starting bot:', err);
        process.exit(1);
    });

// Enable graceful stop
process.once('SIGINT', () => {
    console.log('Bot is stopping...');
    bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
    console.log('Bot is stopping...');
    bot.stop('SIGTERM');
}); 