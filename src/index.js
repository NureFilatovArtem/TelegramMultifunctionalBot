// index.js (в корне проекта)
require('dotenv').config(); // Загрузка переменных окружения из .env в корне

const { Telegraf, Markup } = require('telegraf');
const PDFDocument = require('pdfkit'); // Убедись, что установлен: npm install pdfkit
const MarkdownIt = require('markdown-it'); // Убедись, что установлен: npm install markdown-it
const moment = require('moment'); // Убедись, что установлен: npm install moment
const fs = require('fs');
const path = require('path');

// --- Инициализация единственного экземпляра бота ---
if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error("CRITICAL: TELEGRAM_BOT_TOKEN is not defined in process.env!");
    console.log("Make sure .env file is in the project root and dotenv is loading it correctly.");
    process.exit(1);
}
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
console.log("TELEGRAM_BOT_TOKEN found, bot instance created.");

// --- Регистрация фич из папки src/features ---
// Предполагается, что каждый controller.js экспортирует функцию register(bot)
try {
    console.log("Registering feature modules...");
    require('./src/features/deadlines/deadlines.controller').register(bot);
    require('./src/features/motivation/motivation.controller').register(bot); // Убедись, что этот файл существует и имеет register(bot)
    require('./src/features/english-test/english-test.controller').register(bot);
    require('./src/features/gifs/gifs.controller').register(bot); // Убедись, что этот файл существует и имеет register(bot)
    // Если flashcards готовы: require('./src/features/flashcards/flashcards.controller').register(bot);
    console.log("Feature modules registered.");
} catch (e) {
    console.error("Error registering feature modules:", e);
    process.exit(1);
}


// --- Инициализация OpenAI (если используется) ---
let openai;
if (process.env.OPENAI_API_KEY) {
    try {
        const OpenAI = require('openai');
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        console.log('OpenAI initialized successfully');
    } catch (error) {
        console.warn('Failed to initialize OpenAI:', error.message);
    }
} else {
    console.log('OPENAI_API_KEY not found, OpenAI not initialized.');
}

// --- Хранилища состояний и данных (остаются как есть, если эта логика нужна) ---
const userStates = new Map();
const userTasks = new Map(); // Для deadlines
const userNotes = new Map(); // Для notes

// --- Утилиты ---
const md = new MarkdownIt(); // Markdown парсер
const NOTES_DIR = path.join(__dirname, 'notes_data'); // Изменил, чтобы не конфликтовать с возможной папкой /notes в src
if (!fs.existsSync(NOTES_DIR)) {
    fs.mkdirSync(NOTES_DIR, { recursive: true });
}

// --- Клавиатуры ---

// Главное Inline-меню
const mainMenuButtons = Markup.inlineKeyboard([
    [
        Markup.button.callback('📝 Tasks & Deadlines', 'menu_deadlines'),
        Markup.button.callback('💬 Translate', 'menu_translate')
    ],
    [
        Markup.button.callback('📌 Notes', 'menu_notes'),
        Markup.button.callback('🇬🇧 English Improvement', 'english_improvement') // Перенес сюда для лучшей компоновки
    ],
    [
        Markup.button.callback('🌄 GIFs', 'menu_gifs'),
        Markup.button.callback('🧘 Motivation', 'menu_motivation')
    ],
    // [Markup.button.callback('🎯 Flashcards', 'menu_flashcards')], // Раскомментируй, когда будет готово
    // [Markup.button.callback('📤 Email FWD', 'menu_email')],
    // [Markup.button.callback('📄 PDF Maker', 'menu_pdf')]
]);

// Reply Keyboard с кнопкой "Main Menu" (под полем ввода)
const replyMainMenuKeyboard = Markup.keyboard([['Main Menu']]).resize().persistent();

// --- Безопасный обработчик коллбэков ---
const safeCallback = (handler) => {
    return async (ctx) => {
        try {
            if (ctx.updateType === 'callback_query') {
                await ctx.answerCbQuery().catch(e => console.warn('Failed to answer CB query:', e.message));
            }
            await handler(ctx);
        } catch (err) {
            console.error('Error in callback handler:', err);
            await ctx.reply('An error occurred. Please try again or use /start to reset.').catch(e => console.error('Failed to send error reply:', e.message));
        }
    };
};

// --- Обработчик ошибок бота ---
bot.catch((err, ctx) => {
    console.error(`Bot error for ${ctx.updateType}`, err);
    if (ctx.updateType === 'callback_query' && err.description && err.description.includes('query is too old')) {
        ctx.reply('This menu option has expired. Please use /start to refresh.').catch(e => console.error('Failed to send expired CBQ message:', e.message));
        return;
    }
    ctx.reply('A critical error occurred. The team has been notified. Please try /start.').catch(e => console.error('Failed to send critical error message:', e.message));
});

// --- Основные команды и обработчики ---

// Команда /start
bot.start(async (ctx) => {
    userStates.set(ctx.from.id, { state: 'main_menu' }); // Обновляем состояние
    await ctx.reply(
        `👋 Welcome, ${ctx.from.first_name || 'User'}!\n\nChoose what you want to do:`,
        mainMenuButtons // Отправляем Inline-меню
    );
    // Отправляем Reply-клавиатуру "Main Menu", если она нужна постоянно
    await ctx.reply("You can always return here by typing 'Main Menu' or /start.", replyMainMenuKeyboard);
});

// Обработка текстовой кнопки "Main Menu" (от Reply Keyboard)
bot.hears('Main Menu', safeCallback(async (ctx) => {
    console.log(`User ${ctx.from.id} pressed ReplyKeyboard 'Main Menu'`);
    userStates.set(ctx.from.id, { state: 'main_menu' });
    // Показываем Inline-меню
    await ctx.reply('Main Menu:', mainMenuButtons);
}));

// Обработка Inline-кнопки "Back to Main Menu"
bot.action('back_main', safeCallback(async (ctx) => {
    userStates.set(ctx.from.id, { state: 'main_menu' });
    // Редактируем текущее сообщение, чтобы показать главное меню
    try {
        await ctx.editMessageText('Main Menu:', mainMenuButtons);
    } catch (e) {
        console.warn("Could not edit message for 'back_main', sending new one:", e.message);
        // Если редактирование не удалось (например, сообщение старое или без текста), отправляем новое
        await ctx.reply('Main Menu:', mainMenuButtons);
        // Можно удалить предыдущее сообщение с кнопками, если оно было от бота
        if (ctx.callbackQuery.message.from.id === ctx.botInfo.id) {
            await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(delErr => console.warn("Could not delete previous message:", delErr.message));
        }
    }
}));


// --- Заглушки для других пунктов меню (добавь свою логику) ---

const comingSoonMenu = Markup.inlineKeyboard([
    [Markup.button.callback('« Back to Main Menu', 'back_main')]
]);

bot.action('menu_deadlines', safeCallback(async (ctx) => {
    // Здесь должна быть логика для deadlines, которая сейчас в deadlines.controller.js
    // Для примера, если контроллер уже обрабатывает это:
    // await deadlinesController.handleMenuDeadlines(ctx); // Пример вызова, если бы он был так структурирован
    // А пока заглушка:
    await ctx.editMessageText('📝 Tasks & Deadlines (Coming Soon!)', comingSoonMenu);
}));

bot.action('menu_translate', safeCallback(async (ctx) => {
    await ctx.editMessageText('💬 Translate (Coming Soon!)', comingSoonMenu);
}));

bot.action('menu_notes', safeCallback(async (ctx) => {
    // Логика Notes (частично была в твоем index.js, ее нужно будет интегрировать или вынести в controller)
    await ctx.editMessageText('📌 Notes (Coming Soon!)', comingSoonMenu);
}));

// bot.action('menu_flashcards', safeCallback(async (ctx) => {
//     await ctx.editMessageText('🎯 Flashcards (Coming Soon!)', comingSoonMenu);
// }));

// bot.action('menu_email', safeCallback(async (ctx) => {
//     await ctx.editMessageText('📤 Email FWD (Coming Soon!)', comingSoonMenu);
// }));

// bot.action('menu_pdf', safeCallback(async (ctx) => {
//     await ctx.editMessageText('📄 PDF Maker (Coming Soon!)', comingSoonMenu);
// }));

// Обработчик для 'english_improvement' уже должен быть в english-test.controller.js
// Обработчик для 'menu_gifs' уже должен быть в gifs.controller.js
// Обработчик для 'menu_motivation' уже должен быть в motivation.controller.js


// --- Запуск бота ---
bot.launch()
    .then(() => {
        console.log(`✅ Bot @${bot.botInfo.username} is running!`);
    })
    .catch((err) => {
        console.error('Error starting bot:', err);
        process.exit(1);
    });

// --- Обработка сигналов для корректного завершения ---
process.once('SIGINT', () => {
    console.log('Bot is stopping (SIGINT)...');
    bot.stop('SIGINT');
    process.exit(0);
});
process.once('SIGTERM', () => {
    console.log('Bot is stopping (SIGTERM)...');
    bot.stop('SIGTERM');
    process.exit(0);
});

console.log('index.js fully loaded. Attempting to launch bot...');