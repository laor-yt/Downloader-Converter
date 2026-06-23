const EventEmitter = require('events');
const fs = require('fs');

class JobManager extends EventEmitter {
    constructor() {
        super();
        this.jobs = new Map();
    }

    createJob(jobId, metadata) {
        const job = {
            jobId,
            title: metadata.title || 'Unknown Media',
            format: metadata.format,
            progress: 0,
            status: 'processing',
            outputPath: metadata.outputPath,
            command: null,
            ytdlProcess: null,
            inputFile: metadata.inputFile || null,
            createdAt: Date.now(),
            duration: metadata.duration || 0,
            originalSize: metadata.originalSize || 0,
            totalSizeKb: 0,
            deviceId: metadata.deviceId || null,
            params: metadata.params || {}
        };
        this.jobs.set(jobId, job);
        this.emitJobUpdate(jobId);
        return job;
    }

    setJobProcess(jobId, command, ytdlProcess = null) {
        const job = this.jobs.get(jobId);
        if (job) {
            job.command = command;
            job.ytdlProcess = ytdlProcess;
        }
    }

    updateProgress(jobId, percent, speedKbps, sizeKb, timemark) {
        const job = this.jobs.get(jobId);
        if (job && job.status === 'processing') {
            let computedPercent = percent;
            
            if ((typeof computedPercent !== 'number' || isNaN(computedPercent)) && timemark && job.duration) {
                const parts = timemark.split(':');
                if (parts.length === 3) {
                    const hours = parseFloat(parts[0]) || 0;
                    const mins = parseFloat(parts[1]) || 0;
                    const secs = parseFloat(parts[2]) || 0;
                    const currentSeconds = (hours * 3600) + (mins * 60) + secs;
                    computedPercent = (currentSeconds / job.duration) * 100;
                }
            }

            if (typeof computedPercent === 'number' && !isNaN(computedPercent)) {
                job.progress = Math.max(0, Math.min(100, computedPercent));
            }
            if (speedKbps !== undefined) job.speedKbps = speedKbps;
            if (sizeKb !== undefined) job.sizeKb = sizeKb;
            
            if (job.progress > 0 && job.progress <= 100 && job.sizeKb > 0) {
                job.totalSizeKb = job.sizeKb / (job.progress / 100);
            } else {
                job.totalSizeKb = job.originalSize ? (job.originalSize / 1024) : 0;
            }

            this.emitJobUpdate(jobId);
        }
    }

    completeJob(jobId) {
        const job = this.jobs.get(jobId);
        if (job && job.status === 'processing') {
            job.status = 'completed';
            job.progress = 100;
            job.completedAt = Date.now();
            this.emitJobUpdate(jobId);
            this.cleanupInputs(job);
        }
    }

    failJob(jobId, errorMessage) {
        const job = this.jobs.get(jobId);
        if (job && job.status === 'processing') {
            job.status = 'failed';
            job.error = errorMessage;
            this.emitJobUpdate(jobId);
            // DO NOT cleanupInputs here so the user can retry the job
            this.cleanupOutputs(job);
        }
    }

    cancelJob(jobId) {
        const job = this.jobs.get(jobId);
        if (job && job.status === 'processing') {
            if (job.command) job.command.kill('SIGKILL');
            if (job.ytdlProcess && job.ytdlProcess.cancel) job.ytdlProcess.cancel();
            
            job.status = 'canceled';
            this.emitJobUpdate(jobId);
            this.cleanupInputs(job);
            this.cleanupOutputs(job);
        }
    }
    
    removeJob(jobId) {
        const job = this.jobs.get(jobId);
        if (job) {
            if (job.status === 'processing') {
                this.cancelJob(jobId);
            } else {
                this.cleanupOutputs(job);
            }
            this.jobs.delete(jobId);
            this.emit('jobRemoved', { jobId, deviceId: job.deviceId });
        }
    }

    cleanupInputs(job) {
        if (job.inputFile) {
            fs.unlink(job.inputFile, () => {});
            job.inputFile = null;
        }
    }

    cleanupOutputs(job) {
        if (job.outputPath) {
            fs.unlink(job.outputPath, () => {});
            job.outputPath = null;
        }
    }

    emitJobUpdate(jobId) {
        const job = this.jobs.get(jobId);
        if (job) {
            // Do not send command or process references to the client
            const safeJob = {
                jobId: job.jobId,
                title: job.title,
                format: job.format,
                progress: job.progress,
                status: job.status,
                error: job.error,
                speedKbps: job.speedKbps,
                sizeKb: job.sizeKb,
                totalSizeKb: job.totalSizeKb,
                createdAt: job.createdAt,
                completedAt: job.completedAt,
                deviceId: job.deviceId
            };
            this.emit('progress', safeJob);
        }
    }

    getAllJobs(deviceId) {
        return Array.from(this.jobs.values())
            .filter(job => job.deviceId === deviceId)
            .map(job => ({
            jobId: job.jobId,
            title: job.title,
            format: job.format,
            progress: job.progress,
            status: job.status,
            error: job.error,
            speedKbps: job.speedKbps,
            sizeKb: job.sizeKb,
            totalSizeKb: job.totalSizeKb,
            createdAt: job.createdAt,
            completedAt: job.completedAt,
            deviceId: job.deviceId
        })).sort((a, b) => b.createdAt - a.createdAt);
    }
}

const jobManager = new JobManager();
module.exports = jobManager;
