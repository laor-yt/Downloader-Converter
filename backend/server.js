const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const downloadRoute = require('./routes/download');
const { router: convertRoute, processConversion } = require('./routes/convert');
const { router: uploadRoute, processUpload } = require('./routes/upload');
const jobManager = require('./jobManager');
const { exec } = require('child_process');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Set up routes
app.use('/api/download', downloadRoute);
app.use('/api/convert', convertRoute);
app.use('/api/upload', uploadRoute);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running' });
});

app.get('/api/progress', (req, res) => {
    const deviceId = req.query.deviceId;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial jobs list for this device
    res.write(`data: ${JSON.stringify({ type: 'init', jobs: jobManager.getAllJobs(deviceId) })}\n\n`);

    const onProgress = (data) => {
        if (!deviceId || data.deviceId === deviceId) {
            res.write(`data: ${JSON.stringify({ type: 'update', job: data })}\n\n`);
        }
    };

    const onJobRemoved = (data) => {
        if (!deviceId || data.deviceId === deviceId) {
            res.write(`data: ${JSON.stringify({ type: 'remove', jobId: data.jobId })}\n\n`);
        }
    };

    jobManager.on('progress', onProgress);
    jobManager.on('jobRemoved', onJobRemoved);

    req.on('close', () => {
        jobManager.off('progress', onProgress);
        jobManager.off('jobRemoved', onJobRemoved);
    });
});

app.get('/api/jobs', (req, res) => {
    const deviceId = req.query.deviceId;
    res.json(jobManager.getAllJobs(deviceId));
});

app.delete('/api/jobs/:jobId', (req, res) => {
    jobManager.removeJob(req.params.jobId);
    res.json({ success: true });
});

app.post('/api/retry/:jobId', (req, res) => {
    const job = jobManager.jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'failed') return res.status(400).json({ error: 'Only failed jobs can be retried' });

    job.status = 'processing';
    job.error = null;
    job.progress = 0;
    jobManager.emitJobUpdate(req.params.jobId);

    res.json({ success: true, message: 'Retrying job' });

    if (job.params && job.params.url) {
        processConversion(req.params.jobId, job);
    } else if (job.inputFile) {
        processUpload(req.params.jobId, job);
    } else {
        jobManager.failJob(req.params.jobId, 'Cannot retry: missing URL or input file.');
    }
});

app.get('/api/download/:jobId', (req, res) => {
    const job = jobManager.jobs.get(req.params.jobId);
    if (!job || job.status !== 'completed' || !job.outputPath) {
        return res.status(404).json({ error: 'File not found or not ready' });
    }
    
    let baseTitle = job.title || 'converted_media';
    const lastDotIdx = baseTitle.lastIndexOf('.');
    if (lastDotIdx > 0 && baseTitle.length - lastDotIdx <= 5) {
        baseTitle = baseTitle.substring(0, lastDotIdx);
    }
    const safeTitle = baseTitle.replace(/[/\\?%*:|"<>]/g, '_');
    
    res.download(job.outputPath, `${safeTitle}.${job.format}`, (err) => {
        if (err) console.error("Download send error:", err);
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
