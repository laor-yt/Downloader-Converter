const express = require('express');
const router = express.Router();
const youtubedl = require('youtube-dl-exec');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

router.get('/info', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        // We use youtube-dl-exec to get info for both youtube and generic media urls
        const fs = require('fs');
        const path = require('path');
        const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
        const options = {
            dumpSingleJson: true,
            noWarnings: true,
            noCheckCertificate: true,
            noPlaylist: true,
            jsRuntimes: 'nodejs',
            ffmpegLocation: ffmpegInstaller.path,
            format: 'bestaudio/best/worst',
            extractorArgs: 'youtube:player_client=android,ios,web'
        };
        const cookiesPath = path.join(__dirname, '..', 'cookies.txt');
        if (fs.existsSync(cookiesPath)) {
            options.cookies = cookiesPath;
        }

        const info = await youtubedl(url, options);

        res.json({
            title: info.title || 'Unknown Title',
            thumbnail: info.thumbnail || '',
            duration: info.duration || 0,
            extractor: info.extractor || 'generic',
            formats: info.formats ? info.formats.map(f => ({
                format_id: f.format_id,
                ext: f.ext,
                resolution: f.resolution || (f.width ? `${f.width}x${f.height}` : 'audio only'),
                filesize: f.filesize,
                url: f.url
            })) : []
        });
    } catch (error) {
        console.error("Info Error:", error);
        
        // Debug: Try to get the format list to see what's actually available
        let debugInfo = error.stderr || error.message || String(error);
        try {
            const fs = require('fs');
            const path = require('path');
            const cookiesPath = path.join(__dirname, '..', 'cookies.txt');
            const debugOptions = { F: true, noWarnings: true, noCheckCertificate: true };
            if (fs.existsSync(cookiesPath)) debugOptions.cookies = cookiesPath;
            
            const formatList = await youtubedl(url, debugOptions);
            debugInfo += '\n\nAVAILABLE FORMATS:\n' + formatList;
        } catch (debugError) {
            debugInfo += '\n\nDEBUG LIST-FORMATS FAILED: ' + (debugError.stderr || debugError.message);
        }

        res.status(500).json({ error: 'Failed to fetch media info.', details: debugInfo });
    }
});

module.exports = router;
