const express = require('express');
const router = express.Router();
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const os = require('os');
const jobManager = require('../jobManager');

const upload = multer({ dest: os.tmpdir() });

const processUpload = (jobId, job) => {
    let { format, resolution, orientation, quality, audioOnly } = job.params;
    
    const outputPath = job.outputPath;
    const inputFile = job.inputFile;

    try {
        let command = ffmpeg(inputFile);

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
            let percent = progress.percent;
            if ((percent === undefined || isNaN(percent)) && job.params.duration && progress.timemark) {
                // Parse timemark "hh:mm:ss.ms"
                const parts = progress.timemark.split(':');
                if (parts.length === 3) {
                    const h = parseFloat(parts[0]);
                    const m = parseFloat(parts[1]);
                    const s = parseFloat(parts[2]);
                    const currentSeconds = (h * 3600) + (m * 60) + s;
                    percent = (currentSeconds / parseFloat(job.params.duration)) * 100;
                }
            }
            jobManager.updateProgress(jobId, percent, progress.currentKbps, progress.targetSize, progress.timemark);
        });

        command.on('error', (err) => {
            console.error('Upload FFmpeg error:', err.message);
            jobManager.failJob(jobId, 'Conversion error: ' + err.message);
        });

        command.on('end', () => {
            jobManager.completeJob(jobId);
        });

        command.save(outputPath);
        
        jobManager.setJobProcess(jobId, command, null);

    } catch (error) {
        console.error("Upload Route Error:", error);
        jobManager.failJob(jobId, 'Failed to start processing.');
    }
};

router.post('/', upload.single('file'), (req, res) => {
    let { format, resolution, orientation, quality, audioOnly, jobId, title, deviceId, duration } = req.body;

    if (!req.file || !jobId) {
        return res.status(400).json({ error: 'File and jobId are required' });
    }

    format = format || 'mp4';
    quality = quality || 'best';
    audioOnly = audioOnly === 'true';
    title = title || req.file.originalname || 'Uploaded File';
    duration = parseFloat(duration) || 0;

    const tempFileName = `out_${jobId}_${Date.now()}.${format}`;
    const outputPath = path.join(os.tmpdir(), tempFileName);

    // Create the background job immediately
    jobManager.createJob(jobId, { 
        title, 
        format, 
        outputPath,
        inputFile: req.file.path, // So we can clean it up later
        originalSize: req.file.size || 0,
        deviceId,
        params: { format, resolution, orientation, quality, audioOnly, title, deviceId, duration }
    });

    // Respond immediately so client doesn't block
    res.json({ success: true, jobId, message: 'Upload received, processing in background' });

    const job = jobManager.jobs.get(jobId);
    processUpload(jobId, job);
});

module.exports = { router, processUpload };
