const { MotivationService } = require('./motivation.service');
const { Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

class MotivationController {
    constructor() {
        this.motivationService = new MotivationService();
        this.imagesDir = path.join(__dirname, '../../assets/porsche');
        this.images = fs.readdirSync(this.imagesDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
    }

    getRandomImagePath() {
        if (!this.images || this.images.length === 0) return null;
        const randomImage = this.images[Math.floor(Math.random() * this.images.length)];
        return path.join(this.imagesDir, randomImage);
    }

    async handleMotivationCommand(ctx) {
        try {
            const userId = ctx.from.id;
            const isSubscribed = this.motivationService.isSubscribed(userId);

            if (isSubscribed) {
                await this.motivationService.unsubscribe(userId);
                await ctx.reply('You have unsubscribed from daily motivation. To subscribe again, use /motivation');
            } else {
                await this.showLanguageSelection(ctx);
            }
        } catch (error) {
            console.error('Error handling motivation command:', error);
            await ctx.reply('An error occurred. Please try again later.');
        }
    }

    async showLanguageSelection(ctx) {
        await ctx.reply('On which language do you want to receive motivational messages?', 
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('🇳🇱 Dutch', 'lang_nl'),
                    Markup.button.callback('🇬🇧 English', 'lang_en'),
                    Markup.button.callback('🇺🇦 Ukrainian', 'lang_uk')
                ]
            ])
        );
    }

    async showFrequencySelection(ctx, language) {
        try { await ctx.deleteMessage(); } catch (e) {}
        await ctx.reply('How frequently do you want to receive motivational messages?',
            Markup.inlineKeyboard([
                [Markup.button.callback('Twice a day', `freq_twice_${language}`)],
                [Markup.button.callback('Once a day', `freq_once_${language}`)],
                [Markup.button.callback('Once per 2 days', `freq_2days_${language}`)],
                [Markup.button.callback('Once per week', `freq_week_${language}`)]
            ])
        );
    }

    async handleLanguageSelection(ctx) {
        const language = ctx.match[1]; // nl, en, or uk
        try { await ctx.deleteMessage(); } catch (e) {}
        await this.showFrequencySelection(ctx, language);
    }

    async handleFrequencySelection(ctx) {
        const match = ctx.match[0].match(/^freq_(twice|once|2days|week)_(nl|en|uk)$/);
        if (!match) {
            await ctx.reply('Error: Could not determine language. Please start again.');
            return;
        }
        const frequency = match[1];
        const language = match[2];
        const userId = ctx.from.id;
        try { await ctx.deleteMessage(); } catch (e) {}

        await this.motivationService.setUserPreferences(userId, language, frequency);
        const message = await this.motivationService.generateMotivationMessage(language);

        const frequencyText = {
            'twice': {
                en: 'twice a day',
                nl: 'twee keer per dag',
                uk: 'двічі на день'
            },
            'once': {
                en: 'once a day',
                nl: 'één keer per dag',
                uk: 'раз на день'
            },
            '2days': {
                en: 'once per 2 days',
                nl: 'één keer per 2 dagen',
                uk: 'раз на два дні'
            },
            'week': {
                en: 'once per week',
                nl: 'één keer per week',
                uk: 'раз на тиждень'
            }
        };

        const confirmText = {
            en: `You have subscribed to receive motivational messages in ENGLISH (${frequencyText[frequency].en})! 🚗\n\nYour first message:\n\n${message}`,
            nl: `Je bent geabonneerd op motiverende berichten in het NEDERLANDS (${frequencyText[frequency].nl})! 🚗\n\nJe eerste bericht:\n\n${message}`,
            uk: `Ви підписалися на мотиваційні повідомлення українською (${frequencyText[frequency].uk})! 🚗\n\nВаше перше повідомлення:\n\n${message}`
        };

        const imagePath = this.getRandomImagePath();
        if (imagePath) {
            await ctx.replyWithPhoto({ source: imagePath }, { caption: confirmText[language] || confirmText['en'] });
        } else {
            await ctx.reply(confirmText[language] || confirmText['en']);
        }
    }

    async sendDailyMotivation(bot) {
        try {
            const subscribers = this.motivationService.getSubscribers();

            for (const userId of subscribers) {
                try {
                    if (this.motivationService.shouldSendMessage(userId)) {
                        const preferences = this.motivationService.getUserPreferences(userId);
                        const message = await this.motivationService.generateMotivationMessage(preferences.language);
                        const imagePath = this.getRandomImagePath();
                        if (imagePath) {
                            await bot.telegram.sendPhoto(userId, { source: imagePath }, { caption: message });
                        } else {
                            await bot.telegram.sendMessage(userId, message);
                        }
                        this.motivationService.updateLastSent(userId);
                    }
                } catch (error) {
                    console.error(`Error sending motivation to user ${userId}:`, error);
                    if (error.description && (error.description.includes('blocked') || error.description.includes('chat not found'))) {
                        await this.motivationService.unsubscribe(userId);
                    }
                }
            }
        } catch (error) {
            console.error('Error sending daily motivation:', error);
        }
    }
}

function register(bot) {
    const controller = new MotivationController();
    // Пример регистрации обработчиков:
    bot.command('motivation', (ctx) => controller.handleMotivationCommand(ctx));
    bot.action(/^lang_(nl|en|uk)$/, (ctx) => controller.handleLanguageSelection(ctx));
    bot.action(/^freq_(twice|once|2days|week)_(nl|en|uk)$/, (ctx) => controller.handleFrequencySelection(ctx));
    // Можно добавить другие обработчики, если нужно
}

module.exports = { register }; 