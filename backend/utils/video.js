/**
 * Video download and cleanup utilities for recipe video parsing
 */

const { execFile } = require('child_process');
const fs = require('fs');
const { logger } = require('./logger');
const { sanitizeVideoUrl } = require('./validation');

// Download video using yt-dlp (using execFile to prevent command injection)
function downloadVideo(url, outputPath) {
    return new Promise((resolve, reject) => {
        // Validate URL before executing
        const sanitized = sanitizeVideoUrl(url);
        if (!sanitized) {
            reject(new Error('Invalid or unsupported video URL'));
            return;
        }

        // Use execFile with arguments array to prevent shell injection
        const args = [
            '-f', 'best[ext=mp4]/best',
            '--no-playlist',
            '--max-filesize', '50M',
            '-o', outputPath,
            sanitized
        ];

        execFile('yt-dlp', args, { timeout: 120000 }, (error, stdout, stderr) => {
            if (error) {
                logger.error('yt-dlp error', { error: error.message, stderr, component: 'video' });
                reject(new Error(`Video download failed: ${error.message}`));
                return;
            }
            resolve(outputPath);
        });
    });
}

// Clean up temporary files
function cleanupTempFiles(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (e) {
        logger.warn('Cleanup error', { error: e.message, filePath, component: 'video' });
    }
}

module.exports = {
    downloadVideo,
    cleanupTempFiles
};
