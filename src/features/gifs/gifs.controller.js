const { GifsService } = require('./gifs.service');

class GifsController {
    constructor() {
        this.gifsService = new GifsService();
    }

    async handleVideo(ctx) {
        await this.gifsService.handleVideo(ctx);
    }
}

module.exports = { GifsController }; 