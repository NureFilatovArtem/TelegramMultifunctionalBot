const { GifsController } = require('./gifs.controller');

class GifsModule {
    constructor() {
        this.controller = new GifsController();
    }

    register(bot) {
        bot.on('video', (ctx) => this.controller.handleVideo(ctx));
    }
}

module.exports = { GifsModule }; 