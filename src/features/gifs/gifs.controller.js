const { GifsService } = require('./gifs.service');

function register(bot) {
    const gifsService = new GifsService();
    bot.on('video', (ctx) => gifsService.handleVideo(ctx));
}

module.exports = { register }; 