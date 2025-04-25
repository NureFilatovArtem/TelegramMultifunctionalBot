const { Telegraf, Markup } = require('telegraf');

console.log('Bot is starting...');

const bot = new Telegraf('8045993727:AAFqdqhRTNkk1zojrjKjVbPpvZ9ySlUWbxM');

// User states
const userStates = new Map();

// Main menu keyboard
const mainMenuButtons = Markup.inlineKeyboard([
    [
        Markup.button.callback('📅 Deadlines', 'menu_deadlines'),
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
    await ctx.reply('📅 Deadlines Menu:', deadlinesSubmenu);
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

// Handle deadline actions
bot.action('deadline_add', async (ctx) => {
    await ctx.answerCbQuery();
    userStates.set(ctx.from.id, { state: 'deadline_add' });
    await ctx.reply('Enter your deadline title:');
});

bot.action('deadline_view', async (ctx) => {
    await ctx.answerCbQuery();
    userStates.set(ctx.from.id, { state: 'deadline_view' });
    await ctx.reply('Your deadlines will be shown here...');
});

bot.action('deadline_delete', async (ctx) => {
    await ctx.answerCbQuery();
    userStates.set(ctx.from.id, { state: 'deadline_delete' });
    await ctx.reply('Select deadline to delete...');
});

// Handle translation actions
['translate_en_uk', 'translate_uk_en', 'translate_ru_uk', 'translate_uk_ru'].forEach(action => {
    bot.action(action, async (ctx) => {
        await ctx.answerCbQuery();
        userStates.set(ctx.from.id, { state: action });
        await ctx.reply('Enter text to translate:');
    });
});

// Handle text messages based on user state
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const userState = userStates.get(userId)?.state;

    if (!userState) {
        await ctx.reply('Please use the menu buttons to interact with the bot.');
        return;
    }

    switch (userState) {
        case 'deadline_add':
            await ctx.reply(`Deadline "${ctx.message.text}" added!`);
            userStates.set(userId, { state: 'deadlines' });
            await ctx.reply('📅 Deadlines Menu:', deadlinesSubmenu);
            break;
        case 'translate_en_uk':
        case 'translate_uk_en':
        case 'translate_ru_uk':
        case 'translate_uk_ru':
            await ctx.reply(`Translation for "${ctx.message.text}" will be implemented soon!`);
            userStates.set(userId, { state: 'translate' });
            await ctx.reply('💬 Translation Menu:', translateSubmenu);
            break;
        default:
            await ctx.reply('Please use the menu buttons to interact with the bot.');
    }
});

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