const { MotivationController } = require('./motivation.controller');

class MotivationModule {
    constructor(bot) {
        this.controller = new MotivationController();
        this.bot = bot;
        this.initializeCommands();
        this.initializeCallbacks();
        this.initializeDailySchedule();
    }

    initializeCommands() {
        this.bot.command('motivation', (ctx) => this.controller.handleMotivationCommand(ctx));
    }

    initializeCallbacks() {
        // Language selection callbacks
        this.bot.action(/^lang_(nl|en|uk)$/, async (ctx) => {
            await ctx.answerCbQuery(); // Acknowledge the button press
            await this.controller.handleLanguageSelection(ctx);
        });
        
        // Frequency selection callbacks
        this.bot.action(/^freq_(twice|once|2days|week)_(nl|en|uk)$/, async (ctx) => {
            await ctx.answerCbQuery();
            await this.controller.handleFrequencySelection(ctx);
        });
    }

    initializeDailySchedule() {
        // Check every minute for messages that need to be sent
        setInterval(() => {
            this.controller.sendDailyMotivation(this.bot);
        }, 60000);
    }
}

module.exports = { MotivationModule }; 