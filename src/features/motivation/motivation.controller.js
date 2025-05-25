// src/features/motivation/motivation.controller.js
const { MotivationService } = require('./motivation.service');
const { Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const { getBackToMainMenuButton } = require('../../navigation');

const userMotivationState = new Map();
let controllerInstance = null; // Будем хранить здесь созданный инстанс

class MotivationController {
    constructor(bot) {
        this.bot = bot;
        this.motivationService = new MotivationService();
        try {
            this.imagesDir = path.join(__dirname, '../../assets/porsche');
            this.images = fs.readdirSync(this.imagesDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
        } catch (error) {
            console.warn("[MotivationController] Could not read Porsche images directory:", error.message);
            this.images = [];
        }
    }

    getRandomImagePath() {
        // ... (без изменений)
        if (!this.images || this.images.length === 0) return null;
        const randomImage = this.images[Math.floor(Math.random() * this.images.length)];
        return path.join(this.imagesDir, randomImage);
    }

    // Этот метод будет вызываться и по команде /motivation, и по кнопке из главного меню
    async startMotivationSetup(ctx) { // Переименовали из handleMotivationCommand для ясности
        try {
            const userId = ctx.from.id;
            const isSubscribed = this.motivationService.isSubscribed(userId);

            if (isSubscribed) {
                // Если уже подписан, предлагаем отписаться или изменить настройки (пока просто отписка)
                await ctx.editMessageText( // Предполагаем, что мы пришли из action, поэтому edit
                    'You are already subscribed. Do you want to unsubscribe or change settings?',
                    Markup.inlineKeyboard([
                        [Markup.button.callback('❌ Unsubscribe', 'm_action_unsubscribe')],
                        // [Markup.button.callback('⚙️ Change Settings', 'm_action_change_settings')], // TODO: Implement
                        [getBackToMainMenuButton()]
                    ])
                ).catch(async () => { // Fallback, если это не callback_query
                    await ctx.reply(
                        'You are already subscribed. Do you want to unsubscribe or change settings?',
                        Markup.inlineKeyboard([
                            [Markup.button.callback('❌ Unsubscribe', 'm_action_unsubscribe')],
                            [getBackToMainMenuButton()]
                        ])
                    );
                });
            } else {
                await this.showLanguageSelection(ctx, ctx.updateType === 'callback_query'); // Передаем, был ли это коллбэк
            }
        } catch (error) {
            console.error('Error starting motivation setup:', error);
            await ctx.reply('An error occurred. Please try again later.');
        }
    }
    
    async handleUnsubscribe(ctx) {
        await ctx.answerCbQuery().catch(() => {});
        const userId = ctx.from.id;
        await this.motivationService.unsubscribe(userId);
        await ctx.editMessageText('You have unsubscribed from daily motivation. To subscribe again, select "Motivation" from the main menu or use /motivation.', Markup.inlineKeyboard([
            [getBackToMainMenuButton()]
        ]));
    }


    async showLanguageSelection(ctx, isCallback = false) {
        if (isCallback && ctx.updateType === 'callback_query') { // Удаляем только если это коллбэк и действительно коллбэк
            try { await ctx.deleteMessage(); } catch (e) {}
        } else if (isCallback && !ctx.updateType === 'callback_query') {
            // Если isCallback=true, но это не callback_query (например, прямой вызов из /motivation),
            // то удалять нечего или не нужно.
        }

        const messageText = 'On which language do you want to receive motivational messages?';
        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback('🇳🇱 Dutch', 'm_lang_nl'),
                Markup.button.callback('🇬🇧 English', 'm_lang_en'),
                Markup.button.callback('🇺🇦 Ukrainian', 'm_lang_uk')
            ],
            [Markup.button.callback('« Cancel', 'm_action_cancel')]
        ]);

        if (isCallback && ctx.updateType === 'callback_query' && ctx.callbackQuery.message) {
             // Если мы здесь после кнопки "Мотивация" из главного меню, то ctx.callbackQuery.message существует
            await ctx.editMessageText(messageText, keyboard).catch(async (e) => {
                 console.warn("Failed to edit message for language selection, replying instead.", e);
                 await ctx.reply(messageText, keyboard); // Fallback
            });
        } else {
            await ctx.reply(messageText, keyboard);
        }
    }

    async showFrequencySelection(ctx, language) {
        // ... (без изменений, но убедись, что try { await ctx.deleteMessage(); } catch (e) {} есть)
        try { await ctx.deleteMessage(); } catch (e) {}
        await ctx.reply('How frequently do you want to receive motivational messages?',
            Markup.inlineKeyboard([
                [Markup.button.callback('Twice a day', `m_freq_twice_${language}`)],
                [Markup.button.callback('Once a day', `m_freq_once_${language}`)],
                [Markup.button.callback('Once per 2 days', `m_freq_2days_${language}`)],
                [Markup.button.callback('Once per week', `m_freq_week_${language}`)],
                [Markup.button.callback('« Back to Language', 'm_action_back_to_lang')]
            ])
        );
    }
    
    async handleCancelAction(ctx) {
        // ... (без изменений)
        await ctx.answerCbQuery().catch(()=>{});
        try { await ctx.deleteMessage(); } catch (e) {}
        await ctx.reply("Operation cancelled. Select an option from the main menu.", Markup.inlineKeyboard([
            [getBackToMainMenuButton()]
        ]));
    }


    async handleLanguageSelection(ctx) {
        // ... (без изменений)
        await ctx.answerCbQuery().catch(()=>{});
        const language = ctx.match[1]; 
        await this.showFrequencySelection(ctx, language);
    }

    async handleFrequencySelection(ctx) {
        // ... (без изменений)
        await ctx.answerCbQuery().catch(()=>{});
        const match = ctx.match[0].match(/^m_freq_(twice|once|2days|week)_(nl|en|uk)$/);
        if (!match) {
            await ctx.reply('Error: Could not determine settings. Please start again with /motivation.');
            return;
        }
        const frequency = match[1];
        const language = match[2];
        const userId = ctx.from.id;
        try { await ctx.deleteMessage(); } catch (e) {}

        await this.motivationService.setUserPreferences(userId, language, frequency);
        const message = await this.motivationService.generateMotivationMessage(language);

        const frequencyText = {
            'twice': { en: 'twice a day', nl: 'twee keer per dag', uk: 'двічі на день' },
            'once': { en: 'once a day', nl: 'één keer per dag', uk: 'раз на день' },
            '2days': { en: 'once per 2 days', nl: 'één keer per 2 dagen', uk: 'раз на два дні' },
            'week': { en: 'once per week', nl: 'één keer per week', uk: 'раз на тиждень' }
        };

        const confirmText = {
            en: `You have subscribed to receive motivational messages in ENGLISH (${frequencyText[frequency].en})! 🚗\n\nYour first message:\n\n${message}`,
            nl: `Je bent geabonneerd op motiverende berichten in het NEDERLANDS (${frequencyText[frequency].nl})! 🚗\n\nJe eerste bericht:\n\n${message}`,
            uk: `Ви підписалися на мотиваційні повідомлення українською (${frequencyText[frequency].uk})! 🚗\n\nВаше перше повідомлення:\n\n${message}`
        };
        
        const selectedConfirmText = confirmText[language] || `Subscribed for ${frequencyText[frequency][language] || frequency} in ${language}! First message:\n\n${message}`;


        const imagePath = this.getRandomImagePath();
        const replyOptions = {
            reply_markup: Markup.inlineKeyboard([
                [getBackToMainMenuButton()]
            ]).reply_markup
        };

        if (imagePath) {
            await ctx.replyWithPhoto({ source: imagePath }, { caption: selectedConfirmText, ...replyOptions });
        } else {
            await ctx.reply(selectedConfirmText, replyOptions);
        }
    }

    async sendDailyMotivation(botInstance) {
        // ... (без изменений)
        try {
            const subscribers = this.motivationService.getSubscribers();
            for (const userId of subscribers) {
                try {
                    if (this.motivationService.shouldSendMessage(userId)) {
                        const preferences = this.motivationService.getUserPreferences(userId);
                        if (!preferences) continue; 

                        const message = await this.motivationService.generateMotivationMessage(preferences.language);
                        const imagePath = this.getRandomImagePath();
                        if (imagePath) {
                            await botInstance.telegram.sendPhoto(userId, { source: imagePath }, { caption: message });
                        } else {
                            await botInstance.telegram.sendMessage(userId, message);
                        }
                        this.motivationService.updateLastSent(userId);
                    }
                } catch (error) {
                    console.error(`Error sending motivation to user ${userId}:`, error);
                    if (error.response && error.response.description && (error.response.description.includes('blocked') || error.response.description.includes('chat not found'))) {
                        console.log(`User ${userId} blocked the bot or chat not found. Unsubscribing.`);
                        await this.motivationService.unsubscribe(userId);
                    }
                }
            }
        } catch (error) {
            console.error('Error sending daily motivation:', error);
        }
    }
    
    setupEventHandlers() {
        this.bot.command('motivation', (ctx) => this.startMotivationSetup(ctx)); // Используем новый метод
        
        // Этот action будет вызываться из главного меню в navigation.js
        this.bot.action('menu_motivation_start', (ctx) => { // Новое действие для кнопки
            ctx.answerCbQuery().catch(()=>{});
            this.startMotivationSetup(ctx); // Вызываем тот же метод, что и для /motivation
        });
        
        this.bot.action('m_action_unsubscribe', (ctx) => this.handleUnsubscribe(ctx));
        this.bot.action(/^m_lang_(nl|en|uk)$/, (ctx) => this.handleLanguageSelection(ctx));
        this.bot.action(/^m_freq_(twice|once|2days|week)_(nl|en|uk)$/, (ctx) => this.handleFrequencySelection(ctx));
        this.bot.action('m_action_cancel', (ctx) => this.handleCancelAction(ctx));
        this.bot.action('m_action_back_to_lang', (ctx) => {
            ctx.answerCbQuery().catch(()=>{});
            this.showLanguageSelection(ctx, true); // true, т.к. это коллбэк
        });
    }
}

function cleanupMotivationState(userId) {
    if (userMotivationState.has(userId)) {
        console.log(`[MotivationCleanup] Очистка состояния для пользователя ${userId}`);
        userMotivationState.delete(userId);
    }
}

function register(bot) {
    if (!controllerInstance) { // Создаем инстанс только один раз
        controllerInstance = new MotivationController(bot);
    }
    controllerInstance.setupEventHandlers();
    console.log('Motivation feature registered successfully.');
    return controllerInstance; // Возвращаем инстанс для использования в планировщике
}

// Эта функция теперь не нужна, так как register возвращает инстанс
// function getControllerInstanceForScheduler() {
//     return controllerInstance;
// }

module.exports = { register, cleanupMotivationState }; // Убрали getControllerInstanceForScheduler, так как register его возвращает