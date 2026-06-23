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
        const info = await youtubedl(url, {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificate: true,
            youtubeSkipDashManifest: true,
            noPlaylist: true,
            jsRuntimes: 'nodejs',
            extractorArgs: 'youtube:player_client=android',
        });

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
        res.status(500).json({ error: 'Failed to fetch media info.', details: error.stderr || error.message || String(error) });
    }
});

module.exports = router;
