// src/features/motivation/motivation.controller.js
const { MotivationService } = require('./motivation.service');
const { Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const { getBackToMainMenuButton } = require('../../navigation');

const userMotivationState = new Map();
let controllerInstance = null;

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

    getRandomImagePath() { /* ... no text changes ... */ }

    async startMotivationSetup(ctx) {
        try {
            const userId = ctx.from.id;
            const isSubscribed = this.motivationService.isSubscribed(userId);

            if (isSubscribed) {
                // CHANGED: Text and buttons to English
                await ctx.editMessageText(
                    'You are already subscribed. Do you want to unsubscribe or change settings?',
                    Markup.inlineKeyboard([
                        [Markup.button.callback('❌ Unsubscribe', 'm_action_unsubscribe')],
                        // [Markup.button.callback('⚙️ Change Settings', 'm_action_change_settings')],
                        [getBackToMainMenuButton()]
                    ])
                ).catch(async () => {
                    await ctx.reply(
                        'You are already subscribed. Do you want to unsubscribe or change settings?',
                        Markup.inlineKeyboard([
                            [Markup.button.callback('❌ Unsubscribe', 'm_action_unsubscribe')],
                            [getBackToMainMenuButton()]
                        ])
                    );
                });
            } else {
                await this.showLanguageSelection(ctx, ctx.updateType === 'callback_query');
            }
        } catch (error) {
            console.error('Error starting motivation setup:', error);
            // CHANGED: Text to English
            await ctx.reply('An error occurred. Please try again later.');
        }
    }
    
    async handleUnsubscribe(ctx) {
        await ctx.answerCbQuery().catch(() => {});
        const userId = ctx.from.id;
        await this.motivationService.unsubscribe(userId);
        // CHANGED: Text to English
        await ctx.editMessageText('You have unsubscribed from daily motivation. To subscribe again, select "Motivation" from the main menu or use /motivation.', Markup.inlineKeyboard([
            [getBackToMainMenuButton()]
        ]));
    }

    async showLanguageSelection(ctx, isCallback = false) {
        if (isCallback && ctx.updateType === 'callback_query') {
            try { await ctx.deleteMessage(); } catch (e) {}
        }
        // CHANGED: Text and button to English
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
            await ctx.editMessageText(messageText, keyboard).catch(async (e) => {
                 console.warn("Failed to edit message for language selection, replying instead.", e);
                 await ctx.reply(messageText, keyboard);
            });
        } else {
            await ctx.reply(messageText, keyboard);
        }
    }

    async showFrequencySelection(ctx, language) {
        try { await ctx.deleteMessage(); } catch (e) {}
        // CHANGED: Text and button to English
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
        await ctx.answerCbQuery().catch(()=>{});
        try { await ctx.deleteMessage(); } catch (e) {}
        // CHANGED: Text to English
        await ctx.reply("Operation cancelled. Select an option from the main menu.", Markup.inlineKeyboard([
            [getBackToMainMenuButton()]
        ]));
    }

    async handleLanguageSelection(ctx) { /* ... no text changes ... */ }

    async handleFrequencySelection(ctx) {
        await ctx.answerCbQuery().catch(()=>{});
        const match = ctx.match[0].match(/^m_freq_(twice|once|2days|week)_(nl|en|uk)$/);
        if (!match) {
            // CHANGED: Text to English
            await ctx.reply('Error: Could not determine settings. Please start again with /motivation.');
            return;
        }
        const frequency = match[1];
        const language = match[2];
        const userId = ctx.from.id;
        try { await ctx.deleteMessage(); } catch (e) {}

        await this.motivationService.setUserPreferences(userId, language, frequency);
        const message = await this.motivationService.generateMotivationMessage(language); // This should already be in the target language

        // The confirmText structure itself is for multilingual confirmation from the bot's side
        // If generateMotivationMessage already returns the localized message, we mainly need the subscription confirmation part.
        const frequencyTextMap = {
            'twice': { en: 'twice a day', nl: 'twee keer per dag', uk: 'двічі на день' },
            'once': { en: 'once a day', nl: 'één keer per dag', uk: 'раз на день' },
            '2days': { en: 'once per 2 days', nl: 'één keer per 2 dagen', uk: 'раз на два дні' },
            'week': { en: 'once per week', nl: 'één keer per week', uk: 'раз на тиждень' }
        };
        
        const langNameMap = {
            'en': 'ENGLISH',
            'nl': 'DUTCH',
            'uk': 'UKRAINIAN'
        };

        // CHANGED: Confirmation text to English, but includes the selected language name and frequency
        const selectedLangName = langNameMap[language] || language.toUpperCase();
        const selectedFreqText = frequencyTextMap[frequency]?.[language] || frequency; // Get localized frequency if available, else raw key

        const confirmMessage = `You have subscribed to receive motivational messages in ${selectedLangName} (${selectedFreqText})! 🚗\n\nYour first message:\n\n${message}`;
        
        const imagePath = this.getRandomImagePath();
        const replyOptions = {
            reply_markup: Markup.inlineKeyboard([
                [getBackToMainMenuButton()]
            ]).reply_markup
        };

        if (imagePath) {
            await ctx.replyWithPhoto({ source: imagePath }, { caption: confirmMessage, ...replyOptions });
        } else {
            await ctx.reply(confirmMessage, replyOptions);
        }
    }

    async sendDailyMotivation(botInstance) { /* ... no text changes, assumes service provides localized messages ... */ }
    
    setupEventHandlers() { /* ... no text changes in handler definitions ... */ }
}

function cleanupMotivationState(userId) { /* ... no text changes ... */ }

function register(bot) { /* ... no text changes ... */ }

module.exports = { register, cleanupMotivationState };