const { Markup } = require('telegraf');
const { v4: uuidv4 } = require('uuid');

// Deadline states
const states = {
    IDLE: 'idle',
    ADDING_TITLE: 'adding_title',
    ADDING_DATE: 'adding_date',
    ADDING_REMINDER: 'adding_reminder',
    DELETING: 'deleting'
};

class Deadlines {
    constructor(bot) {
        this.bot = bot;
        this.userStates = new Map();
        this.deadlines = new Map(); // In-memory storage (replace with database later)
        this.setupHandlers();
    }

    setupHandlers() {
        // Main deadlines menu
        this.bot.hears('📅 Deadlines', (ctx) => {
            this.showDeadlinesMenu(ctx);
        });

        // Add new deadline
        this.bot.hears('Add New Deadline', (ctx) => {
            this.userStates.set(ctx.from.id, states.ADDING_TITLE);
            ctx.reply('Please enter the title of your deadline:');
        });

        // View all deadlines
        this.bot.hears('View All Deadlines', (ctx) => {
            this.showAllDeadlines(ctx);
        });

        // Delete deadline
        this.bot.hears('Delete Deadline', (ctx) => {
            this.userStates.set(ctx.from.id, states.DELETING);
            this.showDeleteOptions(ctx);
        });

        // Handle text messages based on state
        this.bot.on('text', (ctx) => {
            const userId = ctx.from.id;
            const state = this.userStates.get(userId);

            switch (state) {
                case states.ADDING_TITLE:
                    this.handleTitleInput(ctx);
                    break;
                case states.ADDING_DATE:
                    this.handleDateInput(ctx);
                    break;
                case states.ADDING_REMINDER:
                    this.handleReminderInput(ctx);
                    break;
                case states.DELETING:
                    this.handleDeleteInput(ctx);
                    break;
            }
        });
    }

    showDeadlinesMenu(ctx) {
        ctx.reply(
            'Deadlines Menu:',
            Markup.keyboard([
                ['Add New Deadline', 'View All Deadlines'],
                ['Delete Deadline', 'Back to Main Menu']
            ]).resize()
        );
    }

    handleTitleInput(ctx) {
        const userId = ctx.from.id;
        const title = ctx.message.text;
        
        if (!this.deadlines.has(userId)) {
            this.deadlines.set(userId, []);
        }

        this.deadlines.get(userId).push({
            id: uuidv4(),
            title: title,
            date: null,
            reminder: null
        });

        this.userStates.set(userId, states.ADDING_DATE);
        ctx.reply('Please enter the deadline date (YYYY-MM-DD):');
    }

    handleDateInput(ctx) {
        const userId = ctx.from.id;
        const dateStr = ctx.message.text;
        
        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            ctx.reply('Invalid date format. Please use YYYY-MM-DD:');
            return;
        }

        const userDeadlines = this.deadlines.get(userId);
        userDeadlines[userDeadlines.length - 1].date = dateStr;

        this.userStates.set(userId, states.ADDING_REMINDER);
        ctx.reply(
            'When would you like to be reminded?\n' +
            '1. 1 day before\n' +
            '2. 1 hour before\n' +
            '3. 30 minutes before\n' +
            '4. Custom time (in minutes)'
        );
    }

    handleReminderInput(ctx) {
        const userId = ctx.from.id;
        const reminder = ctx.message.text;
        const userDeadlines = this.deadlines.get(userId);
        const currentDeadline = userDeadlines[userDeadlines.length - 1];

        // Set reminder based on user input
        switch (reminder) {
            case '1':
                currentDeadline.reminder = '1d';
                break;
            case '2':
                currentDeadline.reminder = '1h';
                break;
            case '3':
                currentDeadline.reminder = '30m';
                break;
            default:
                if (/^\d+$/.test(reminder)) {
                    currentDeadline.reminder = `${reminder}m`;
                } else {
                    ctx.reply('Invalid reminder time. Please enter a number of minutes:');
                    return;
                }
        }

        this.userStates.set(userId, states.IDLE);
        ctx.reply('Deadline added successfully!');
        this.showDeadlinesMenu(ctx);
    }

    showAllDeadlines(ctx) {
        const userId = ctx.from.id;
        const userDeadlines = this.deadlines.get(userId) || [];

        if (userDeadlines.length === 0) {
            ctx.reply('You have no deadlines yet.');
            return;
        }

        let message = 'Your deadlines:\n\n';
        userDeadlines.forEach((deadline, index) => {
            message += `${index + 1}. ${deadline.title}\n`;
            message += `   Date: ${deadline.date}\n`;
            message += `   Reminder: ${deadline.reminder}\n\n`;
        });

        ctx.reply(message);
    }

    showDeleteOptions(ctx) {
        const userId = ctx.from.id;
        const userDeadlines = this.deadlines.get(userId) || [];

        if (userDeadlines.length === 0) {
            ctx.reply('You have no deadlines to delete.');
            this.userStates.set(userId, states.IDLE);
            return;
        }

        let message = 'Which deadline would you like to delete?\n\n';
        userDeadlines.forEach((deadline, index) => {
            message += `${index + 1}. ${deadline.title} (${deadline.date})\n`;
        });

        ctx.reply(message);
    }

    handleDeleteInput(ctx) {
        const userId = ctx.from.id;
        const index = parseInt(ctx.message.text) - 1;
        const userDeadlines = this.deadlines.get(userId);

        if (isNaN(index) || index < 0 || index >= userDeadlines.length) {
            ctx.reply('Invalid selection. Please try again:');
            return;
        }

        userDeadlines.splice(index, 1);
        this.userStates.set(userId, states.IDLE);
        ctx.reply('Deadline deleted successfully!');
        this.showDeadlinesMenu(ctx);
    }
}

module.exports = Deadlines; 