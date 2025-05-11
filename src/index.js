// Import dotenv at the top
require('dotenv').config();

// Debug environment variables
console.log('Environment variables:');
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'Present' : 'Missing');
if (process.env.TELEGRAM_BOT_TOKEN) {
    console.log('Token length:', process.env.TELEGRAM_BOT_TOKEN.length);
    console.log('Token format:', process.env.TELEGRAM_BOT_TOKEN.includes(':') ? 'Valid format' : 'Invalid format');
}
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Present' : 'Missing');

// Verify dotenv is working
console.log('Current working directory:', process.cwd());
console.log('Environment file path:', require('path').join(process.cwd(), '.env'));

const { Telegraf, Markup } = require('telegraf');
const PDFDocument = require('pdfkit');
const MarkdownIt = require('markdown-it');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const { GifsModule } = require('./features/gifs/gifs.module');
const { MotivationModule } = require('./features/motivation/motivation.module');

console.log('Bot is starting...');

// Initialize OpenAI only if API key is present
let openai;
if (process.env.OPENAI_API_KEY) {
    try {
        const OpenAI = require('openai');
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        console.log('OpenAI initialized successfully');
    } catch (error) {
        console.warn('Failed to initialize OpenAI:', error.message);
    }
}

// Use environment variables instead of hardcoded values
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// User states and data storage
const userStates = new Map();
const userTasks = new Map();

// Initialize markdown parser
const md = new MarkdownIt();

// Create notes directory if it doesn't exist
const NOTES_DIR = path.join(__dirname, 'notes');
if (!fs.existsSync(NOTES_DIR)) {
    fs.mkdirSync(NOTES_DIR);
}

// Main menu keyboard
const mainMenuButtons = Markup.inlineKeyboard([
    [
        Markup.button.callback('📝 Tasks & Deadlines', 'menu_deadlines'),
        Markup.button.callback('💬 Translate', 'menu_translate')
    ],
    [
        Markup.button.callback('📌 Notes', 'menu_notes'),
        Markup.button.callback('🎯 Flashcards', 'menu_flashcards')
    ],
    [
        Markup.button.callback('🌄 GIFs', 'menu_gifs'),
        Markup.button.callback('🧘 Motivation', 'menu_motivation')
    ],
    [
        Markup.button.callback('📤 Email FWD', 'menu_email'),
        Markup.button.callback('📄 PDF Maker', 'menu_pdf')
    ],
    [
        Markup.button.callback('🇬🇧 English Improvement', 'english_improvement')
    ]
]);

// Task management keyboards
const tasksSubmenu = Markup.inlineKeyboard([
    [Markup.button.callback('➕ Add Task', 'deadline_add')],
    [Markup.button.callback('📋 View All', 'deadline_view')],
    [Markup.button.callback('❌ Delete', 'deadline_delete')],
    [Markup.button.callback('« Back to Main Menu', 'back_main')]
]);

const notificationOptions = Markup.inlineKeyboard([
    [
        Markup.button.callback('5 days before', 'notify_5days'),
        Markup.button.callback('3 days before', 'notify_3days')
    ],
    [
        Markup.button.callback('1 day before', 'notify_1day'),
        Markup.button.callback('Same day', 'notify_same')
    ],
    [Markup.button.callback('Custom reminder', 'notify_custom')],
    [Markup.button.callback('Skip notifications', 'notify_skip')]
]);

// Submenu keyboards
const deadlinesSubmenu = Markup.inlineKeyboard([
    [Markup.button.callback('➕ Add Deadline', 'deadline_add')],
    [Markup.button.callback('📋 View All', 'deadline_view')],
    [Markup.button.callback('❌ Delete', 'deadline_delete')],
    [Markup.button.callback('« Back to Main Menu', 'back_main')]
]);

const translateSubmenu = Markup.inlineKeyboard([
    [
        Markup.button.callback('🇬🇧 EN → 🇺🇦 UK', 'translate_en_uk'),
        Markup.button.callback('🇺🇦 UK → 🇬🇧 EN', 'translate_uk_en')
    ],
    [
        Markup.button.callback('🇷🇺 RU → 🇺🇦 UK', 'translate_ru_uk'),
        Markup.button.callback('🇺🇦 UK → 🇷🇺 RU', 'translate_uk_ru')
    ],
    [Markup.button.callback('« Back to Main Menu', 'back_main')]
]);

// Simplified notes submenu
const notesSubmenu = Markup.inlineKeyboard([
    [Markup.button.callback('📝 New Note', 'note_new')],
    [Markup.button.callback('📋 View All Notes', 'note_view_all')],
    [Markup.button.callback('📂 View by Category', 'note_view_categories')],
    [Markup.button.callback('« Back to Main Menu', 'back_main')]
]);

// Note categories
const noteCategories = Markup.inlineKeyboard([
    [
        Markup.button.callback('📚 Study', 'category_study'),
        Markup.button.callback('💼 Work', 'category_work')
    ],
    [
        Markup.button.callback('🏠 Personal', 'category_personal'),
        Markup.button.callback('💡 Ideas', 'category_ideas')
    ],
    [
        Markup.button.callback('📋 Tasks', 'category_tasks'),
        Markup.button.callback('🎯 Goals', 'category_goals')
    ],
    [Markup.button.callback('❌ Cancel', 'back_main')]
]);

// AI improvement options
const aiImprovementOptions = Markup.inlineKeyboard([
    [
        Markup.button.callback('✍️ Improve Writing', 'ai_improve_writing'),
        Markup.button.callback('🔍 Find Key Points', 'ai_key_points')
    ],
    [
        Markup.button.callback('📝 Summarize', 'ai_summarize'),
        Markup.button.callback('📊 Structure', 'ai_structure')
    ],
    [Markup.button.callback('« Back', 'menu_notes')]
]);

// Notes storage
const userNotes = new Map();

// Add debug logging function
const debug = (message, data = null) => {
    console.log(`[DEBUG] ${message}`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
};

// Error handling middleware
bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    
    // Handle callback query errors
    if (err.description && err.description.includes('query is too old')) {
        // For expired callback queries, try to send a new message
        ctx.reply('Session expired. Please use the /start command to get a fresh menu.')
            .catch(e => console.error('Error sending error message:', e));
        return;
    }

    // For other errors, try to notify the user
    ctx.reply('An error occurred. Please try again or use /start to reset the bot.')
        .catch(e => console.error('Error sending error message:', e));
});

// Wrap callback handlers in try-catch
const safeCallback = (handler) => {
    return async (ctx) => {
        try {
            // Try to answer callback query first
            try {
                await ctx.answerCbQuery();
            } catch (e) {
                console.log('Callback query answer failed:', e.message);
                // Continue execution even if answering callback failed
            }
            
            // Execute the actual handler
            await handler(ctx);
        } catch (err) {
            console.error('Handler error:', err);
            try {
                await ctx.reply('An error occurred. Please try again or use /start to reset.');
            } catch (e) {
                console.error('Error sending error message:', e);
            }
        }
    };
};

// Verify bot connection
bot.telegram.getMe().then((botInfo) => {
    console.log('Connected successfully!');
    console.log('Bot info:', botInfo);
}).catch((err) => {
    console.error('Failed to get bot info:', err);
});

// Reply Keyboard с кнопкой Main Menu
const replyMainMenuKeyboard = {
    reply_markup: {
        keyboard: [
            ['Main Menu']
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    }
};

// Start command
bot.command('start', (ctx) => {
    userStates.set(ctx.from.id, { state: 'main' });
    return ctx.reply(
        '👋 Welcome to MultiFunction Bot!\n\n' +
        'Choose what you want to do:',
        {
            reply_markup: mainMenuButtons.reply_markup,
            ...replyMainMenuKeyboard
        }
    );
});

// Update menu handlers to use safeCallback
bot.action('menu_deadlines', safeCallback(async (ctx) => {
    userStates.set(ctx.from.id, { state: 'deadlines' });
    await ctx.reply('📝 Task Management:', tasksSubmenu);
}));

bot.action('menu_translate', safeCallback(async (ctx) => {
    userStates.set(ctx.from.id, { state: 'translate' });
    await ctx.reply('💬 Translation Menu:', translateSubmenu);
}));

bot.action('menu_notes', safeCallback(async (ctx) => {
    userStates.set(ctx.from.id, { state: 'notes' });
    await ctx.reply('📝 Notes Management:', notesSubmenu);
}));

bot.action('menu_flashcards', safeCallback(async (ctx) => {
    userStates.set(ctx.from.id, { state: 'flashcards' });
    await ctx.reply('🎯 Flashcards Menu:', flashcardsSubmenu);
}));

// Подключаю MotivationModule
let motivationModule;
try {
    motivationModule = new MotivationModule(bot);
} catch (error) {
    console.error('Error initializing MotivationModule:', error);
}

// Новый обработчик для menu_motivation
bot.action('menu_motivation', async (ctx) => {
    await motivationModule.controller.handleMotivationCommand(ctx);
});

// Handle back to main menu
bot.action('back_main', safeCallback(async (ctx) => {
    userStates.set(ctx.from.id, { state: 'main' });
    await ctx.reply('Main Menu:', { reply_markup: mainMenuButtons.reply_markup });
}));

// Handle task actions
bot.action('deadline_add', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    userStates.set(userId, { state: 'deadline_add_title' });
    await ctx.reply('Enter your task title:');
});

// Handle notification settings
bot.action(/notify_(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const match = ctx.match[1];
    const userData = userStates.get(userId);
    
    if (!userData || !userData.currentTask) {
        await ctx.reply('Something went wrong. Please try adding the task again.');
        return;
    }

    let notificationDays;
    let notificationText;

    switch (match) {
        case '5days':
            notificationDays = 5;
            notificationText = '5 days before';
            break;
        case '3days':
            notificationDays = 3;
            notificationText = '3 days before';
            break;
        case '1day':
            notificationDays = 1;
            notificationText = '1 day before';
            break;
        case 'same':
            notificationDays = 0;
            notificationText = 'on the same day';
            break;
        case 'custom':
            userStates.set(userId, { 
                ...userData, 
                state: 'deadline_custom_notification',
            });
            await ctx.reply('Enter how many days before the deadline you want to be notified:');
            return;
        case 'skip':
            notificationDays = null;
            notificationText = 'no notifications';
            break;
    }

    // Save the task with notifications
    const userTaskList = userTasks.get(userId) || [];
    userTaskList.push({
        ...userData.currentTask,
        notificationDays,
        created: new Date()
    });
    userTasks.set(userId, userTaskList);

    await ctx.reply(
        `✅ Task added successfully!\n\n` +
        `Title: ${userData.currentTask.title}\n` +
        `Due date: ${userData.currentTask.dueDate}\n` +
        `Notification: ${notificationText}`,
        tasksSubmenu
    );

    userStates.set(userId, { state: 'deadlines' });
});

// Handle notes menu
bot.action('menu_notes', safeCallback(async (ctx) => {
    userStates.set(ctx.from.id, { state: 'notes' });
    await ctx.reply('📝 Notes Management:', notesSubmenu);
}));

// Handle new note
bot.action('note_new', safeCallback(async (ctx) => {
    userStates.set(ctx.from.id, { state: 'note_select_category' });
    await ctx.reply('Select note category:', noteCategories);
}));

// Handle category selection
bot.action(/category_(.+)/, safeCallback(async (ctx) => {
    const userId = ctx.from.id;
    const category = ctx.match[1];
    
    userStates.set(userId, { 
        state: 'note_create_content',
        currentNote: {
            category,
            id: Date.now().toString(),
            created: new Date()
        }
    });

    await ctx.reply('Enter your note text:');
}));

// Handle text input for notes
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const userData = userStates.get(userId);
    const userState = userData?.state;

    if (!userState || !userState.startsWith('note_')) {
        return;
    }

    if (userState === 'note_create_content') {
        const userNotesList = userNotes.get(userId) || [];
        const newNote = {
            ...userData.currentNote,
            content: ctx.message.text,
            lastModified: new Date()
        };
        userNotesList.push(newNote);
        userNotes.set(userId, userNotesList);

        await ctx.reply('✅ Note saved successfully!', notesSubmenu);
        userStates.set(userId, { state: 'notes' });
    }
});

// View all notes
bot.action('note_view_all', safeCallback(async (ctx) => {
    const userId = ctx.from.id;
    const userNotesList = userNotes.get(userId) || [];

    if (userNotesList.length === 0) {
        await ctx.reply('You have no notes yet!', notesSubmenu);
        return;
    }

    // Group notes by category
    const notesByCategory = {};
    userNotesList.forEach(note => {
        if (!notesByCategory[note.category]) {
            notesByCategory[note.category] = [];
        }
        notesByCategory[note.category].push(note);
    });

    // Create formatted message
    let message = '📝 Your Notes:\n\n';
    for (const [category, notes] of Object.entries(notesByCategory)) {
        message += `📂 ${category.toUpperCase()}:\n`;
        notes.forEach((note, index) => {
            const date = moment(note.lastModified).format('DD.MM.YY HH:mm');
            message += `${index + 1}. [${date}] ${note.content.substring(0, 40)}...\n`;
        });
        message += '\n';
    }

    // Create buttons for each note
    const buttons = userNotesList.map(note => {
        const preview = note.content.substring(0, 20) + '...';
        return [Markup.button.callback(
            `${note.category}: ${preview}`,
            `view_note_${note.id}`
        )];
    });

    buttons.push([Markup.button.callback('« Back', 'menu_notes')]);

    // Send overview first
    await ctx.reply(message);
    
    // Then send buttons for detailed view
    await ctx.reply(
        'Select a note to view full content:',
        Markup.inlineKeyboard(buttons)
    );
}));

// View notes by category
bot.action('note_view_categories', safeCallback(async (ctx) => {
    const userId = ctx.from.id;
    const userNotesList = userNotes.get(userId) || [];

    if (userNotesList.length === 0) {
        await ctx.reply('You have no notes yet!', notesSubmenu);
        return;
    }

    const categories = [...new Set(userNotesList.map(note => note.category))];
    const buttons = categories.map(category => {
        const count = userNotesList.filter(note => note.category === category).length;
        return [Markup.button.callback(
            `${category.toUpperCase()} (${count})`,
            `view_category_${category}`
        )];
    });

    buttons.push([Markup.button.callback('« Back', 'menu_notes')]);

    await ctx.reply(
        'Select category to view notes:',
        Markup.inlineKeyboard(buttons)
    );
}));

// View notes in category
bot.action(/view_category_(.+)/, safeCallback(async (ctx) => {
    const userId = ctx.from.id;
    const category = ctx.match[1];
    const userNotesList = userNotes.get(userId) || [];
    const categoryNotes = userNotesList.filter(note => note.category === category);

    let message = `📂 Category: ${category.toUpperCase()}\n\n`;
    const buttons = categoryNotes.map(note => {
        const date = moment(note.lastModified).format('DD.MM.YY HH:mm');
        message += `[${date}] ${note.content.substring(0, 40)}...\n\n`;
        return [Markup.button.callback(
            `${note.content.substring(0, 20)}...`,
            `view_note_${note.id}`
        )];
    });

    buttons.push([Markup.button.callback('« Back to Categories', 'note_view_categories')]);

    await ctx.reply(message);
    await ctx.reply(
        'Select a note to view full content:',
        Markup.inlineKeyboard(buttons)
    );
}));

// View single note
bot.action(/view_note_(.+)/, safeCallback(async (ctx) => {
    const userId = ctx.from.id;
    const noteId = ctx.match[1];
    const userNotesList = userNotes.get(userId) || [];
    const note = userNotesList.find(n => n.id === noteId);

    if (!note) {
        await ctx.reply('Note not found.', notesSubmenu);
        return;
    }

    const formattedDate = moment(note.lastModified).format('DD.MM.YYYY HH:mm');
    const message = 
        `📂 Category: ${note.category}\n` +
        `🕒 Date: ${formattedDate}\n\n` +
        note.content;

    await ctx.reply(message, Markup.inlineKeyboard([
        [Markup.button.callback('🗑️ Delete', `delete_note_${noteId}`)],
        [Markup.button.callback('« Back to Notes', 'note_view_all')]
    ]));
}));

// Delete note
bot.action(/delete_note_(.+)/, safeCallback(async (ctx) => {
    const userId = ctx.from.id;
    const noteId = ctx.match[1];
    const userNotesList = userNotes.get(userId) || [];
    const noteIndex = userNotesList.findIndex(n => n.id === noteId);

    if (noteIndex === -1) {
        await ctx.reply('Note not found.', notesSubmenu);
        return;
    }

    const deletedNote = userNotesList.splice(noteIndex, 1)[0];
    userNotes.set(userId, userNotesList);

    await ctx.reply('✅ Note deleted successfully!', notesSubmenu);
}));

// View all tasks
bot.action('deadline_view', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const userTaskList = userTasks.get(userId) || [];

    if (userTaskList.length === 0) {
        await ctx.reply('You have no tasks yet!', tasksSubmenu);
        return;
    }

    const taskMessages = userTaskList
        .sort((a, b) => {
            const dateA = parseDate(a.dueDate);
            const dateB = parseDate(b.dueDate);
            return dateA - dateB;
        })
        .map((task, index) => {
            const notificationText = task.notificationDays === null 
                ? 'No notifications'
                : `Notification: ${task.notificationDays} days before`;
            
            return `${index + 1}. "${task.title}"\n` +
                   `📅 Due: ${task.dueDate}\n` +
                   `🔔 ${notificationText}\n`;
        })
        .join('\n');

    await ctx.reply(
        '📋 Your Tasks:\n\n' + taskMessages,
        tasksSubmenu
    );
});

// Delete task
bot.action('deadline_delete', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const userTaskList = userTasks.get(userId) || [];

    if (userTaskList.length === 0) {
        await ctx.reply('You have no tasks to delete!', tasksSubmenu);
        return;
    }

    const deleteButtons = userTaskList.map((task, index) => {
        return [Markup.button.callback(
            `${index + 1}. ${task.title} (${task.dueDate})`,
            `delete_task_${index}`
        )];
    });

    deleteButtons.push([Markup.button.callback('« Back', 'menu_deadlines')]);

    await ctx.reply(
        'Select task to delete:',
        Markup.inlineKeyboard(deleteButtons)
    );
});

// Handle delete task selection
bot.action(/delete_task_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const taskIndex = parseInt(ctx.match[1]);
    const userTaskList = userTasks.get(userId) || [];

    if (taskIndex >= 0 && taskIndex < userTaskList.length) {
        const deletedTask = userTaskList.splice(taskIndex, 1)[0];
        userTasks.set(userId, userTaskList);
        await ctx.reply(
            `✅ Task "${deletedTask.title}" deleted successfully!`,
            tasksSubmenu
        );
    } else {
        await ctx.reply('Error deleting task. Please try again.', tasksSubmenu);
    }
});

// Handle PDF export
bot.action(/export_note_(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const noteId = ctx.match[1];
    const userNotesList = userNotes.get(userId) || [];
    const note = userNotesList.find(n => n.id === noteId);

    if (!note) {
        await ctx.reply('Note not found.', notesSubmenu);
        return;
    }

    try {
        await ctx.reply('📄 Creating PDF...');
        
        const doc = new PDFDocument();
        const filename = `note_${noteId}.pdf`;
        const filePath = path.join(NOTES_DIR, filename);

        doc.pipe(fs.createWriteStream(filePath));

        // Add content to PDF
        doc.fontSize(20).text(note.title, { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Category: ${note.category}`);
        doc.fontSize(12).text(`Last modified: ${moment(note.lastModified).format('DD.MM.YYYY HH:mm')}`);
        doc.moveDown();
        doc.fontSize(12).text(note.content);

        doc.end();

        // Wait for the file to be written
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Send the PDF file
        await ctx.replyWithDocument({ source: filePath });
        
        // Clean up
        fs.unlinkSync(filePath);
    } catch (error) {
        console.error('PDF creation error:', error);
        await ctx.reply('Sorry, there was an error creating the PDF.');
    }
});

// Helper function to parse date
function parseDate(dateStr) {
    const [day, month, year] = dateStr.split('.');
    return new Date(year, month - 1, day);
}

// Initialize features
const gifsModule = new GifsModule();
gifsModule.register(bot);

// Add the real GIFs handler
bot.action('menu_gifs', safeCallback(async (ctx) => {
    userStates.set(ctx.from.id, { state: 'gifs' });
    await ctx.reply(
        '🎬 Send me a video (max 15 seconds) and I\'ll convert it to a GIF!',
        Markup.inlineKeyboard([[Markup.button.callback('« Back to Main Menu', 'back_main')]])
    );
}));

// Универсальная функция показа главного меню
function showMainMenu(ctx) {
    return ctx.reply('Main Menu:', { reply_markup: mainMenuButtons.reply_markup });
}

// Обработка текстовой кнопки Main Menu (Reply Keyboard)
bot.hears('Main Menu', async (ctx) => {
    await showMainMenu(ctx);
});

// Обработка inline-кнопки возврата
bot.action('back_main', safeCallback(async (ctx) => {
    userStates.set(ctx.from.id, { state: 'main' });
    await showMainMenu(ctx);
}));

// Инициализация контроллера тестирования английского
const EnglishTestController = require('./features/english-test/english-test.controller');
new EnglishTestController(bot);

// Launch bot with error handling
console.log('Connecting to Telegram...');

bot.launch()
    .then(() => {
        console.log('✅ Bot is running!');
        console.log('Bot username:', bot.botInfo?.username);
    })
    .catch((err) => {
        console.error('Error starting bot:', err);
        process.exit(1);
    });

// Enable graceful stop
process.once('SIGINT', () => {
    console.log('Bot is stopping...');
    bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
    console.log('Bot is stopping...');
    bot.stop('SIGTERM');
}); 