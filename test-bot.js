const { Telegraf } = require('telegraf');
const bot = new Telegraf('8045993727:AAENHDs6N8YJG5fE5auXGJL-hIAOZa6ZGIY'); // <-- Вставь свой токен

bot.on('text', (ctx) => {
    console.log('Получено сообщение:', ctx.message.text);
    ctx.reply('Эхо: ' + ctx.message.text);
});

bot.launch();