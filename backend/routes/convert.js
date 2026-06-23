const express = require('express');
const router = express.Router();
const youtubedl = require('youtube-dl-exec');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const os = require('os');
const jobManager = require('../jobManager');

const fs = require('fs');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

const processConversion = (jobId, job) => {
    let { url, format, resolution, orientation, quality, audioOnly } = job.params;
    
    // We already have outputPath in job
    const outputPath = job.outputPath;
    const tempVideoFile = job.inputFile || path.join(os.tmpdir(), `dl_${jobId}_${Date.now()}.mkv`);
    job.inputFile = tempVideoFile;

    try {
        const ytdlProcess = youtubedl.exec(url, {
            o: tempVideoFile,
            f: audioOnly ? 'bestaudio' : 'bestvideo+bestaudio/best',
            mergeOutputFormat: 'mkv',
            ffmpegLocation: ffmpegInstaller.path,
            noWarnings: true,
            jsRuntimes: 'nodejs',
            extractorArgs: 'youtube:player_client=android'
        });
        
        let ytdlError = '';
        if (ytdlProcess.stderr) {
            ytdlProcess.stderr.on('data', data => {
                ytdlError += data.toString();
            });
        }
        
        jobManager.setJobProcess(jobId, null, ytdlProcess);

        ytdlProcess.on('close', (code) => {
            if (code !== 0 && code !== null) {
                console.error('youtube-dl-exec process exited with code', code, 'error:', ytdlError);
                jobManager.failJob(jobId, `Failed to fetch media from source. Details: ${ytdlError.substring(0, 100)}`);
                return;
            }

            // Check if file exists in case yt-dlp silently failed
            if (!fs.existsSync(tempVideoFile)) {
                jobManager.failJob(jobId, 'Download completed but file is missing.');
                return;
            }

            let command = ffmpeg(tempVideoFile);

            if (audioOnly) {
                command.noVideo();
                if (format === 'mp3') command.audioCodec('libmp3lame');
            } else {
                if (resolution) {
                    let targetSize = resolution;
                    if (orientation === 'portrait') {
                        const parts = targetSize.split('x');
                        if (parts.length === 2 && parseInt(parts[0]) > parseInt(parts[1])) {
                            targetSize = `${parts[1]}x${parts[0]}`; // Swap to Portrait
                        }
                    } else if (orientation === 'landscape') {
                        const parts = targetSize.split('x');
                        if (parts.length === 2 && parseInt(parts[1]) > parseInt(parts[0])) {
                            targetSize = `${parts[1]}x${parts[0]}`; // Swap to Landscape
                        }
                    }
                    const [w, h] = targetSize.split('x');
                    if (orientation) {
                        // Fit within target size and crop the excess using high quality lanczos scaler
                        command.videoFilters(`scale=${w}:${h}:flags=lanczos:force_original_aspect_ratio=increase,crop=${w}:${h}`);
                    } else {
                        command.videoFilters(`scale=${w}:${h}:flags=lanczos`);
                    }
                } else if (orientation) {
                    // No resolution provided, just crop to aspect ratio without scaling
                    if (orientation === 'portrait') {
                        command.videoFilters(`crop='min(iw,ih*9/16)':'min(ih,iw*16/9)'`);
                    } else if (orientation === 'landscape') {
                        command.videoFilters(`crop='min(iw,ih*16/9)':'min(ih,iw*9/16)'`);
                    }
                }
                if (format === 'mp4' || format === 'mov') {
                    let crf = '23';
                    if (quality === 'best') crf = '14'; // Visually lossless
                    if (quality === 'medium') crf = '28';
                    if (quality === 'low') crf = '32';
                    
                    command.videoCodec('libx264').outputOptions(['-preset', 'ultrafast', '-crf', crf, '-threads', '0']);
                } else if (format === 'png' || format === 'jpg') {
                    command.outputOptions(['-vframes', '1', '-q:v', '1']);
                }
            }

            command.on('progress', (progress) => {
                jobManager.updateProgress(jobId, progress.percent, progress.currentKbps, progress.targetSize, progress.timemark);
            });

            command.on('error', (err) => {
                console.error('FFmpeg error:', err.message);
                jobManager.failJob(jobId, 'Conversion error: ' + err.message);
            });

            command.on('end', () => {
                jobManager.completeJob(jobId);
            });

            command.save(outputPath);
            
            // Save references for cancellation
            jobManager.setJobProcess(jobId, command, null);
        });

    } catch (error) {
        console.error("Conversion Route Error:", error);
        jobManager.failJob(jobId, 'Failed to start conversion process.');
    }
};

router.get('/', (req, res) => {
    let { url, format, resolution, orientation, quality, audioOnly, jobId, title, duration, originalSize, deviceId } = req.query;

    if (!url || !jobId) return res.status(400).json({ error: 'URL and jobId are required' });

    format = format || 'mp4';
    quality = quality || 'best';
    audioOnly = audioOnly === 'true';
    title = title || 'URL Conversion';
    duration = parseFloat(duration) || 0;
    originalSize = parseFloat(originalSize) || 0;

    const tempFileName = `out_${jobId}_${Date.now()}.${format}`;
    const outputPath = path.join(os.tmpdir(), tempFileName);

    // Create the background job immediately
    jobManager.createJob(jobId, { 
        title, 
        format, 
        outputPath, 
        duration, 
        originalSize, 
        deviceId,
        params: { url, format, resolution, orientation, quality, audioOnly, title, duration, originalSize, deviceId }
    });

    // Respond to the client right away so they don't block
    res.json({ success: true, jobId, message: 'Job started in background' });

    const job = jobManager.jobs.get(jobId);
    processConversion(jobId, job);
});

module.exports = { router, processConversion };
