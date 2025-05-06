const { Telegraf, session } = require('telegraf');
const { GifsModule } = require('./features/gifs/gifs.module');
const { MotivationModule } = require('./features/motivation/motivation.module');
require('dotenv').config();

// Validate environment variables
if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not set in .env file');
    process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set in .env file');
    process.exit(1);
}

// Initialize bot with error handling
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Enable session middleware
bot.use(session());

// Initialize features
let gifsModule;
let motivationModule;

try {
    gifsModule = new GifsModule(bot);
    motivationModule = new MotivationModule(bot);
    console.log('Features initialized successfully');
} catch (error) {
    console.error('Error initializing features:', error);
    process.exit(1);
}

// Main menu keyboard
const mainMenuKeyboard = {
    reply_markup: {
        keyboard: [
            ['🎥 Convert Video to GIF'],
            ['🚗 Daily Motivation'],
            ['ℹ️ Help']
        ],
        resize_keyboard: true
    }
};

// Start command
bot.command('start', (ctx) => {
    ctx.reply('Welcome! Choose an option:', mainMenuKeyboard);
});

// Handle text messages
bot.on('text', (ctx) => {
    const text = ctx.message.text;

    switch (text) {
        case '🎥 Convert Video to GIF':
            ctx.reply('Send me a video to convert it to GIF!');
            break;
        case '🚗 Daily Motivation':
            ctx.reply('Choose your motivation settings:', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🇳🇱 Dutch', callback_data: 'lang_nl' },
                            { text: '🇬🇧 English', callback_data: 'lang_en' },
                            { text: '🇺🇦 Ukrainian', callback_data: 'lang_uk' }
                        ]
                    ]
                }
            });
            break;
        case 'ℹ️ Help':
            ctx.reply(
                'Available commands:\n\n' +
                '/start - Show main menu\n' +
                '/motivation - Configure motivation settings\n' +
                '🎥 Convert Video to GIF - Convert videos to GIFs\n' +
                '🚗 Daily Motivation - Set up daily motivation messages'
            );
            break;
    }
});

// Error handling
bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    ctx.reply('An error occurred. Please try again later.');
});

// Start the bot with proper error handling
console.log('Connecting to Telegram...');
bot.launch()
    .then(() => {
        console.log('Bot started successfully!');
    })
    .catch((err) => {
        console.error('Failed to start bot:', err);
        if (err.response && err.response.description === 'Unauthorized') {
            console.error('Invalid bot token. Please check your TELEGRAM_BOT_TOKEN in .env file');
        }
        process.exit(1);
    });

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM')); 