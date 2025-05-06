const { OpenAI } = require('openai');
const { promisify } = require('util');
const { exec } = require('child_process');

const execAsync = promisify(exec);

class MotivationService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        // Store user preferences: { userId: { language: string, frequency: string, lastSent: Date } }
        this.userPreferences = new Map();
    }

    async generateMotivationMessage(language) {
        const languagePrompts = {
            'en': "Generate a motivational message in English about working hard today to achieve the dream of owning a Porsche 911 GT3 RS.",
            'nl': "Genereer een motiverende boodschap in het Nederlands over hard werken vandaag om de droom van het bezitten van een Porsche 911 GT3 RS te bereiken.",
            'uk': "Згенеруйте мотиваційне повідомлення українською мовою про важливість наполегливої роботи сьогодні для досягнення мрії про володіння Porsche 911 GT3 RS."
        };

        const systemPrompts = {
            'en': "You are a motivational speaker focused on Porsche cars. Generate short, powerful motivational messages in English that connect daily work and success to owning a Porsche 911 GT3 RS. Keep messages under 200 characters and make them personal and impactful.",
            'nl': "Je bent een motiverende spreker gericht op Porsche-auto's. Genereer korte, krachtige motiverende berichten in het Nederlands die dagelijks werk en succes verbinden met het bezitten van een Porsche 911 GT3 RS. Houd berichten onder 200 tekens en maak ze persoonlijk en impactvol.",
            'uk': "Ви мотиваційний спікер, зосереджений на автомобілях Porsche. Створюйте короткі, потужні мотиваційні повідомлення українською мовою, які пов'язують щоденну роботу та успіх з володінням Porsche 911 GT3 RS. Зберігайте повідомлення до 200 символів і робіть їх особистими та ефектними."
        };

        try {
            const completion = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: systemPrompts[language]
                    },
                    {
                        role: "user",
                        content: languagePrompts[language]
                    }
                ],
                max_tokens: 150,
                temperature: 0.8
            });

            return completion.choices[0].message.content;
        } catch (error) {
            console.error('Error generating motivation message:', error);
            const fallbackMessages = {
                'en': "Remember: Every hour of smart work brings you closer to your Porsche 911 GT3 RS. Stay focused! 🚗",
                'nl': "Onthoud: elk uur slim werk brengt je dichter bij je Porsche 911 GT3 RS. Blijf gefocust! 🚗",
                'uk': "Пам'ятайте: кожна година розумної роботи наближає вас до вашої Porsche 911 GT3 RS. Залишайтеся зосередженими! 🚗"
            };
            return fallbackMessages[language];
        }
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