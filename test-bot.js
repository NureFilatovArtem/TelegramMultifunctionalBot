const { Telegraf } = require('telegraf');
const bot = new Telegraf('TELEGRAM_BOT_TOKEN'); // <-- Вставь свой токен

bot.on('text', (ctx) => {
    console.log('Получено сообщение:', ctx.message.text);
    ctx.reply('Эхо: ' + ctx.message.text);
});

bot.launch();