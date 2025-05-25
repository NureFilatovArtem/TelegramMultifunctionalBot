// index.js (или ваш главный файл)
const { Telegraf } = require('telegraf');
require('dotenv').config();

// Импорт функций регистрации фич
const { register: registerDeadlinesFeature, cleanupDeadlinesState } = require('./src/features/deadlines/deadlines.controller');
const { register: registerEnglishTestFeature } = require('./src/features/english-test/english-test.controller');
const englishTestService = require('./src/features/english-test/english-test.service'); // Для очистки состояния English Test
const { register: registerFlashcardsFeature, cleanupFlashcardsState } = require('./src/features/flashcards/flashcards.controller');
const { register: registerMotivationFeature, cleanupMotivationState } = require('./src/features/motivation/motivation.controller'); // Предполагаем, что он тоже будет иметь cleanup
const { register: registerGifsFeature } = require('./src/features/gifs/gifs.controller'); // GIF-контроллер

// Импорт из нашего нового модуля навигации
const { setupGlobalNavigationHandlers, registerFeatureStateCleanup, showMainMenu } = require('./src/navigation');

if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error("Ошибка: TELEGRAM_BOT_TOKEN не найден в .env файле!");
    process.exit(1);
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// 1. Настройка глобальных обработчиков навигации
setupGlobalNavigationHandlers(bot);

// 2. Регистрация функций очистки состояния для каждой фичи
registerFeatureStateCleanup((userId) => { // Для English Test
    if (englishTestService.userStates.has(userId)) {
        console.log(`[Cleanup] Очистка состояния English Test для пользователя ${userId}`);
        englishTestService.userStates.delete(userId);
    }
});
registerFeatureStateCleanup(cleanupDeadlinesState);
registerFeatureStateCleanup(cleanupFlashcardsState);
registerFeatureStateCleanup(cleanupMotivationState); // Для Motivation

// 3. Регистрация обработчиков фич
// Эти функции должны вызываться с экземпляром бота
registerDeadlinesFeature(bot);
registerEnglishTestFeature(bot);
registerFlashcardsFeature(bot);
registerMotivationFeature(bot);
registerGifsFeature(bot);

// Обработчики для кнопок главного меню, которые ведут к фичам
// (Deadlines, EnglishTest уже имеют свои точки входа через `bot.action` в своих контроллерах,
// которые вызываются из `setupGlobalNavigationHandlers` -> `showMainMenu` -> кнопки)

// Точка входа для 'menu_deadlines' (обрабатывается в deadlines.controller.js)
// bot.action('menu_deadlines', async (ctx) => { ... }); // Уже есть в deadlines.controller

// Точка входа для 'english_improvement' (обрабатывается в english-test.controller.js)
// bot.action('english_improvement', async (ctx) => { ... }); // Уже есть в english-test.controller

// Точка входа для 'menu_flashcards' (будет обрабатываться в flashcards.controller.js)
// bot.action('menu_flashcards', async (ctx) => { ... }); // Должен быть в flashcards.controller

// Команда /menu для принудительного вызова главного меню
bot.command('menu', async (ctx) => {
    await showMainMenu(ctx, false);
});

// Удаляем временные обработчики, так как кнопки теперь должны использовать ACTION_BACK_TO_MAIN_MENU
// bot.action('back_main', ...);
// bot.action('back_to_main_menu_action', ...);


bot.launch().then(() => {
    console.log('Бот успешно запущен!');
    // Запуск периодической отправки мотивационных сообщений (если используется)
    const motivationControllerInstance = require('./src/features/motivation/motivation.controller').getControllerInstanceForScheduler(bot); // нужно будет доработать motivation.controller
    if (motivationControllerInstance && motivationControllerInstance.sendDailyMotivation) {
        setInterval(() => motivationControllerInstance.sendDailyMotivation(bot), 60 * 60 * 1000); // Каждый час, например
        console.log('Планировщик мотивационных сообщений запущен.');
    }

}).catch(err => {
    console.error('Ошибка при запуске бота:', err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));