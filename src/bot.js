// src/bot.js
const path = require('path'); // ОБЯЗАТЕЛЬНО
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Указываем путь к .env в родительской папке

const { Telegraf } = require('telegraf');

if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error("CRITICAL: TELEGRAM_BOT_TOKEN is not defined in process.env!");
    console.log("Node is running from (process.cwd()):", process.cwd());
    console.log("Dotenv attempted to load .env from:", path.resolve(__dirname, '../.env'));
    process.exit(1);
} else {
    console.log("TELEGRAM_BOT_TOKEN found via dotenv:", process.env.TELEGRAM_BOT_TOKEN.substring(0, 15) + "...");
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN); // Эту строку нужно было добавить, если ее не было

// Регистрация фич
require('./features/deadlines/deadlines.controller').register(bot);
require('./features/motivation/motivation.controller').register(bot);
require('./features/english-test/english-test.controller').register(bot);
require('./features/gifs/gifs.controller').register(bot);

bot.launch().then(() => {
    console.log('✅ Bot is running!');
}).catch(err => {
    console.error("Error launching bot:", err);
});