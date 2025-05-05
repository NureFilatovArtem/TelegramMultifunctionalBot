const { spawn } = require('child_process');
const { promisify } = require('util');
const { exec } = require('child_process');
const { createWriteStream } = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');
const { v4: uuidv4 } = require('uuid');

const execAsync = promisify(exec);

class GifsService {
    constructor() {
        this.MAX_VIDEO_DURATION = 15; // seconds
        this.MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
        this.ALLOWED_MIME_TYPES = [
            'video/mp4',
            'video/quicktime',
            'video/x-matroska',
            'video/webm',
            'video/avi',
            'video/mpeg',
        ];
    }

    async handleVideo(ctx) {
        try {
            console.log('GifsService.handleVideo вызван');
            if (!ctx.message || !('video' in ctx.message)) {
                await ctx.reply('Пожалуйста, отправьте видеофайл.');
                return;
            }

            const video = ctx.message.video;
            console.log('Получено видео:', video);

            // Проверка размера файла
            if (video.file_size && video.file_size > this.MAX_FILE_SIZE) {
                await ctx.reply('Видео слишком большое. Максимальный размер — 50MB.');
                return;
            }

            // Проверка mime-типа (если есть)
            if (video.mime_type && !this.ALLOWED_MIME_TYPES.includes(video.mime_type)) {
                await ctx.reply('Неподдерживаемый формат видео. Попробуйте mp4, mov, mkv, webm, avi, mpeg.');
                return;
            }

            // Получение информации о файле
            const file = await ctx.telegram.getFile(video.file_id);
            const filePath = file.file_path;
            if (!filePath) {
                await ctx.reply('Не удалось получить путь к файлу.');
                return;
            }

            // Скачивание видео
            const videoUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
            const videoPath = join(tmpdir(), `${uuidv4()}.mp4`);
            const gifPath = join(tmpdir(), `${uuidv4()}.gif`);

            // Информируем пользователя о начале обработки
            await ctx.reply('Видео получено! ⏳ Сейчас обработаю, это может занять до 30 секунд...');

            // Динамический импорт node-fetch
            const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));
            const response = await fetch(videoUrl);
            if (!response.ok) {
                await ctx.reply('Ошибка при скачивании видео.');
                return;
            }
            const buffer = await response.buffer();
            const writeStream = createWriteStream(videoPath);
            writeStream.write(buffer);
            writeStream.end();

            // Проверка длительности видео
            const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${videoPath}`);
            const duration = parseFloat(stdout);

            if (duration > this.MAX_VIDEO_DURATION) {
                await ctx.reply(`Видео слишком длинное. Максимальная длительность — ${this.MAX_VIDEO_DURATION} секунд.`);
                await execAsync(`rm ${videoPath}`);
                return;
            }

            // Конвертация в GIF
            await this.convertToGif(videoPath, gifPath);

            // Отправка GIF пользователю
            await ctx.replyWithAnimation({
                source: gifPath
            });

            // Очистка временных файлов
            await execAsync(`rm ${videoPath} ${gifPath}`);

        } catch (error) {
            console.error('Ошибка при обработке видео:', error);
            await ctx.reply('Произошла ошибка при обработке видео. Попробуйте еще раз или отправьте другое видео.');
        }
    }

    async convertToGif(inputPath, outputPath) {
        return new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', [
                '-i', inputPath,
                '-vf', 'fps=10,scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
                '-loop', '0',
                outputPath
            ]);

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`FFmpeg завершился с кодом ${code}`));
                }
            });

            ffmpeg.on('error', (err) => {
                reject(err);
            });
        });
    }
}

module.exports = { GifsService }; 