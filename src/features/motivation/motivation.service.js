const { generateQuestionsGemini } = require('../english-test/gemini.service');

class MotivationService {
    constructor() {
        this.subscribers = new Map();
        this.userPreferences = new Map();
        this.lastSent = new Map();
    }

    async generateMotivationMessage(language) {
        // Формируем prompt для Gemini
        const prompt = `Generate a short motivational message for a person in ${language === 'nl' ? 'Dutch' : language === 'uk' ? 'Ukrainian' : 'English'}. The message should be positive, inspiring, and suitable for daily encouragement. Return only the message text.`;
        const model = require('@google/generative-ai').GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    }

    async setUserPreferences(userId, language, frequency) {
        this.userPreferences.set(userId, {
            language,
            frequency,
            lastSent: null
        });
        return true;
    }

    async unsubscribe(userId) {
        this.userPreferences.delete(userId);
        return true;
    }

    isSubscribed(userId) {
        return this.userPreferences.has(userId);
    }

    getUserPreferences(userId) {
        return this.userPreferences.get(userId);
    }

    getSubscribers() {
        return Array.from(this.userPreferences.keys());
    }

    shouldSendMessage(userId) {
        const preferences = this.userPreferences.get(userId);
        if (!preferences || !preferences.lastSent) return true;

        const now = new Date();
        const lastSent = new Date(preferences.lastSent);
        const hoursSinceLastSent = (now - lastSent) / (1000 * 60 * 60);

        switch (preferences.frequency) {
            case 'twice_a_day':
                return hoursSinceLastSent >= 12;
            case 'once_a_day':
                return hoursSinceLastSent >= 24;
            case 'once_per_2_days':
                return hoursSinceLastSent >= 48;
            case 'once_per_week':
                return hoursSinceLastSent >= 168;
            default:
                return false;
        }
    }

    updateLastSent(userId) {
        const preferences = this.userPreferences.get(userId);
        if (preferences) {
            preferences.lastSent = new Date();
            this.userPreferences.set(userId, preferences);
        }
    }
}

module.exports = { MotivationService }; 