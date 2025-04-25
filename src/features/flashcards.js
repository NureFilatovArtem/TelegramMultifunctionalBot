const { Markup } = require('telegraf');

// Flashcard states
const states = {
    IDLE: 'idle',
    CREATING: 'creating',
    STUDYING: 'studying'
};

// Flashcard feature
class Flashcards {
    constructor(bot) {
        this.bot = bot;
        this.userStates = new Map();
        this.setupHandlers();
    }

    setupHandlers() {
        // Main flashcards menu
        this.bot.hears('🎯 Flashcards', (ctx) => {
            this.showFlashcardsMenu(ctx);
        });

        // Create new flashcard
        this.bot.hears('Create New Card', (ctx) => {
            this.userStates.set(ctx.from.id, states.CREATING);
            ctx.reply('Please send your question:');
        });

        // Study flashcards
        this.bot.hears('Study Cards', (ctx) => {
            this.userStates.set(ctx.from.id, states.STUDYING);
            this.showNextCard(ctx);
        });

        // My flashcards
        this.bot.hears('My Cards', (ctx) => {
            this.showUserCards(ctx);
        });

        // Handle text messages based on state
        this.bot.on('text', (ctx) => {
            const userId = ctx.from.id;
            const state = this.userStates.get(userId);

            if (state === states.CREATING) {
                this.handleCardCreation(ctx);
            } else if (state === states.STUDYING) {
                this.handleCardStudy(ctx);
            }
        });
    }

    showFlashcardsMenu(ctx) {
        ctx.reply(
            'Flashcards Menu:',
            Markup.keyboard([
                ['Create New Card', 'Study Cards'],
                ['My Cards', 'Back to Main Menu']
            ]).resize()
        );
    }

    handleCardCreation(ctx) {
        const userId = ctx.from.id;
        const state = this.userStates.get(userId);

        if (state === states.CREATING) {
            // Here you would implement the logic to save the flashcard
            ctx.reply('Card created successfully!');
            this.userStates.set(userId, states.IDLE);
            this.showFlashcardsMenu(ctx);
        }
    }

    handleCardStudy(ctx) {
        const userId = ctx.from.id;
        // Here you would implement the logic to check the answer and show the next card
        ctx.reply('Checking your answer...');
        this.showNextCard(ctx);
    }

    showNextCard(ctx) {
        // Here you would implement the logic to show the next flashcard
        ctx.reply('Here is your next card:');
    }

    showUserCards(ctx) {
        // Here you would implement the logic to show user's flashcards
        ctx.reply('Your flashcards:');
    }
}

module.exports = Flashcards; 