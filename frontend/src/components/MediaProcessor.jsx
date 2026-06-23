import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UploadCloud, File, Video, Settings, DownloadCloud, 
  X, AlertCircle, CheckCircle, Clock, Loader2, RefreshCw, Link2, Music, Play
} from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = `http://${window.location.hostname}:5000`;

const calculateETA = (job) => {
  if (!job.progress || job.progress <= 0 || !job.createdAt) return null;
  const elapsedSeconds = (Date.now() - job.createdAt) / 1000;
  const estimatedTotalSeconds = elapsedSeconds / (job.progress / 100);
  const remainingSeconds = Math.max(0, estimatedTotalSeconds - elapsedSeconds);
  
  if (remainingSeconds === Infinity || isNaN(remainingSeconds)) return null;
  
  if (remainingSeconds < 60) return `${Math.round(remainingSeconds)}s`;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = Math.round(remainingSeconds % 60);
  return `${minutes}m ${seconds}s`;
};

const MediaProcessor = () => {
  const [mode, setMode] = useState('link'); // 'link' or 'upload'
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);
  
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Conversion Settings
  const [format, setFormat] = useState('mp4');
  const [resolution, setResolution] = useState('');
  const [orientation, setOrientation] = useState('');
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [quality, setQuality] = useState('best');
  
  // Jobs State
  const [jobs, setJobs] = useState([]);
  
  const [deviceId] = useState(() => {
    let id = localStorage.getItem('deviceId');
    if (!id) {
      id = 'device-' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('deviceId', id);
    }
    return id;
  });
  
  const fileInputRef = useRef(null);

  // Initialize SSE and fetch initial jobs
  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE_URL}/api/progress?deviceId=${deviceId}`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'init') {
        setJobs(data.jobs);
      } else if (data.type === 'update') {
        setJobs(prevJobs => {
          const index = prevJobs.findIndex(j => j.jobId === data.job.jobId);
          if (index >= 0) {
            const newJobs = [...prevJobs];
            newJobs[index] = data.job;
            return newJobs;
          } else {
            return [data.job, ...prevJobs];
          }
        });
      } else if (data.type === 'remove') {
        setJobs(prevJobs => prevJobs.filter(j => j.jobId !== data.jobId));
      }
    };
    
    return () => eventSource.close();
  }, []);

  const fetchInfo = async () => {
    if (mode === 'link' && !url) {
      setError('Please enter a valid URL');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/download/info?url=${encodeURIComponent(url)}`);
      setInfo(response.data);
    } catch (err) {
      setError('Failed to fetch media info. Ensure the URL is valid and accessible.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setInfo({
        title: selectedFile.name,
        extractor: 'Local File',
        duration: 0,
      });
      setError('');

      if (selectedFile.type.startsWith('video/') || selectedFile.type.startsWith('audio/')) {
        const url = URL.createObjectURL(selectedFile);
        const media = document.createElement(selectedFile.type.startsWith('video/') ? 'video' : 'audio');
        media.addEventListener('loadedmetadata', () => {
           setInfo(prev => ({ ...prev, duration: media.duration }));
           URL.revokeObjectURL(url);
        });
        media.src = url;
      }
    }
  };

  const startJob = async () => {
    const jobId = Math.random().toString(36).substring(2, 15);
    
    try {
      if (mode === 'link') {
        const title = info ? info.title : 'URL Download';
        const duration = info ? info.duration : 0;
        const originalSize = info ? (info.filesize || info.filesize_approx || 0) : 0;
        await axios.get(`${API_BASE_URL}/api/convert`, {
          params: { url, format, resolution, orientation, quality, audioOnly: isAudioOnly, jobId, title, duration, originalSize, deviceId }
        });
      } else if (mode === 'upload' && file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('format', format);
        formData.append('resolution', resolution);
        formData.append('orientation', orientation);
        formData.append('quality', quality);
        formData.append('audioOnly', isAudioOnly);
        formData.append('jobId', jobId);
        formData.append('title', file.name);
        formData.append('deviceId', deviceId);
        formData.append('duration', info ? info.duration : 0);
        
        await axios.post(`${API_BASE_URL}/api/upload`, formData);
      }
      
      // Clear inputs for next job
      if (mode === 'link') setUrl('');
      if (mode === 'upload') setFile(null);
      setInfo(null);
      setError('');
      
    } catch (err) {
      setError('Failed to start the conversion process.');
    }
  };

  const handleStopJob = async (jobId) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/jobs/${jobId}`);
      setJobs(prev => prev.filter(j => j.jobId !== jobId));
    } catch (err) {
      console.error("Failed to stop job", err);
    }
  };

  const handleRetryJob = async (jobId) => {
    try {
      await axios.post(`${API_BASE_URL}/api/retry/${jobId}`);
    } catch (err) {
      console.error("Failed to retry job", err);
    }
  };

  const handleDownloadCompleted = (job) => {
    const url = `${API_BASE_URL}/api/download/${job.jobId}`;
    const link = document.createElement('a');
    link.href = url;
    
    const safeTitle = job.title ? job.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'download';
    link.setAttribute('download', `${safeTitle}.${job.format}`);
    
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
  };

  const handleFormatChange = (e) => {
    const val = e.target.value;
    setFormat(val);
    if (['mp3', 'wav', 'flac'].includes(val)) {
      setIsAudioOnly(true);
    } else {
      setIsAudioOnly(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="glass-panel" style={{ padding: '2rem' }}>
        
        {/* Mode Switcher */}
        <div className="mode-switcher" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '16px', width: 'fit-content', margin: '0 auto 2rem auto' }}>
          <button 
            onClick={() => { setMode('link'); setInfo(null); setFile(null); setError(''); }}
            style={{ 
              background: mode === 'link' ? 'var(--primary)' : 'transparent',
              color: 'white', border: 'none', padding: '8px 20px', borderRadius: '12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500, transition: '0.3s'
            }}
          >
            <Link2 size={18} /> URL Link
          </button>
          <button 
            onClick={() => { setMode('upload'); setInfo(null); setUrl(''); setError(''); }}
            style={{ 
              background: mode === 'upload' ? 'var(--primary)' : 'transparent',
              color: 'white', border: 'none', padding: '8px 20px', borderRadius: '12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500, transition: '0.3s'
            }}
          >
            <UploadCloud size={18} /> File Upload
          </button>
        </div>

        <div className="input-container" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          {mode === 'link' ? (
            <>
              <div style={{ flex: 1, position: 'relative' }}>
                <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                  <Link2 size={20} />
                </div>
                <input 
                  type="text" 
                  placeholder="Paste media link here (YouTube, Vimeo, direct links, etc.)"
                  className="input-field"
                  style={{ paddingLeft: '48px' }}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchInfo()}
                />
              </div>
              <button className="btn-primary" onClick={fetchInfo} disabled={loading} style={{ minWidth: '140px' }}>
                {loading ? <Loader2 size={20} className="spin" /> : <span>Fetch Info</span>}
              </button>
            </>
          ) : (
            <div 
              style={{ flex: 1, border: '2px dashed var(--border)', borderRadius: '16px', padding: '2rem', textAlign: 'center', cursor: 'pointer', transition: '0.3s', background: 'rgba(0,0,0,0.1)' }}
              onClick={() => fileInputRef.current.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileChange({ target: { files: e.dataTransfer.files } });
                }
              }}
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
              <UploadCloud size={40} color="var(--primary)" style={{ margin: '0 auto 1rem auto' }} />
              <p style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>Click to browse or drag a file here</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Supports Video, Audio, and Image formats</p>
            </div>
          )}
        </div>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: 'auto' }} 
              exit={{ opacity: 0, height: 0 }}
              style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '12px 16px', borderRadius: '12px', marginBottom: '1rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}
            >
              {error}
            </motion.div>
          )}

          {info && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}
            >
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 300px' }}>
                  <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>{info.title}</h3>
                  {info.thumbnail && (
                    <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '1rem' }}>
                      <img src={info.thumbnail} alt="Thumbnail" style={{ width: '100%', display: 'block', objectFit: 'cover', aspectRatio: '16/9' }} />
                    </div>
                  )}
                  {mode === 'upload' && file && !info.thumbnail && (
                    <div style={{ borderRadius: '16px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', marginBottom: '1rem', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <File size={60} color="var(--text-muted)" />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '12px', color: 'var(--text-muted)', fontSize: '0.9rem', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '20px' }}>
                      <Video size={14} /> {info.extractor}
                    </span>
                    {info.duration > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '20px' }}>
                        Duration: {Math.floor(info.duration / 60)}:{(info.duration % 60).toString().padStart(2, '0')}
                      </span>
                    )}
                    {file && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '20px' }}>
                        Size: {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ flex: '1 1 300px', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border)' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
                    <Settings size={18} /> Output Configuration
                  </h4>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Format</label>
                    <select className="input-field select-field" value={format} onChange={handleFormatChange}>
                      <optgroup label="Video">
                        <option value="mp4">MP4</option>
                        <option value="mov">MOV</option>
                        <option value="webm">WebM</option>
                        <option value="avi">AVI</option>
                        <option value="mkv">MKV</option>
                      </optgroup>
                      <optgroup label="Audio">
                        <option value="mp3">MP3</option>
                        <option value="wav">WAV</option>
                        <option value="flac">FLAC</option>
                      </optgroup>
                      <optgroup label="Image (1st Frame)">
                        <option value="png">PNG</option>
                        <option value="jpg">JPG</option>
                      </optgroup>
                    </select>
                  </div>

                  {!isAudioOnly && (
                    <>
                      <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Quality</label>
                        <select className="input-field select-field" value={quality} onChange={(e) => setQuality(e.target.value)}>
                          <option value="best">Best (Lossless, Largest File)</option>
                          <option value="high">High (Great Quality)</option>
                          <option value="medium">Medium (Standard)</option>
                          <option value="low">Low (Smallest File)</option>
                        </select>
                      </div>

                      <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Resolution (Optional)</label>
                        <select className="input-field select-field" value={resolution} onChange={(e) => setResolution(e.target.value)}>
                          <option value="">Original/Best</option>
                          <option value="7680x4320">8K (4320p)</option>
                          <option value="3840x2160">4K (2160p)</option>
                          <option value="2560x1440">2K (1440p)</option>
                          <option value="1920x1080">1080p</option>
                          <option value="1280x720">720p</option>
                          <option value="854x480">480p</option>
                          <option value="640x360">360p</option>
                        </select>
                      </div>

                      <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Orientation</label>
                        <select className="input-field select-field" value={orientation} onChange={(e) => setOrientation(e.target.value)}>
                          <option value="">Original</option>
                          <option value="portrait">Portrait (9:16 - TikTok/Shorts)</option>
                          <option value="landscape">Landscape (16:9 - YouTube)</option>
                        </select>
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>Automatically crops video to fill screen entirely without black bars.</small>
                      </div>
                    </>
                  )}

                  <button 
                    className="btn-primary" 
                    onClick={startJob} 
                    style={{ width: '100%', marginTop: '0.5rem' }}
                  >
                    <Play size={20} /> Start Process
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Jobs List UI */}
      {jobs.length > 0 && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={22} className="spin" style={{ animationDuration: '3s' }} /> Active & Completed Jobs
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <AnimatePresence>
              {jobs.map(job => (
                <motion.div 
                  key={job.jobId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  style={{ 
                    background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', 
                    borderRadius: '16px', padding: '1.5rem', position: 'relative', overflow: 'hidden'
                  }}
                >
                  {job.status === 'processing' && (
                    <div style={{ position: 'absolute', top: 0, left: 0, height: '4px', width: `${Math.max(2, job.progress)}%`, background: 'var(--primary)', transition: 'width 0.3s ease' }} />
                  )}
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', wordBreak: 'break-word' }}>{job.title}</h4>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        <span style={{ textTransform: 'uppercase', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px' }}>{job.format}</span>
                        {job.status === 'processing' && <span style={{ color: '#818cf8' }}>Processing {Math.round(job.progress)}%</span>}
                        {job.status === 'completed' && <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={14} /> Ready</span>}
                        {job.status === 'failed' && <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={14} /> Failed</span>}
                        {job.status === 'canceled' && <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '4px' }}><X size={14} /> Canceled</span>}
                      </div>
                      
                      {job.status === 'processing' && (job.speedKbps > 0 || job.sizeKb > 0 || calculateETA(job)) && (
                        <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '4px 8px', borderRadius: '4px', width: 'fit-content', flexWrap: 'wrap' }}>
                          {job.speedKbps > 0 && <span>Speed: {(job.speedKbps / 8 / 1024).toFixed(2)} MB/s</span>}
                          {job.sizeKb > 0 && <span>Size: {(job.sizeKb / 1024).toFixed(2)} MB {job.totalSizeKb > 0 && `/ ${(job.totalSizeKb / 1024).toFixed(2)} MB`}</span>}
                          {calculateETA(job) && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> ETA: {calculateETA(job)}</span>}
                        </div>
                      )}
                      
                      {job.status === 'completed' && job.completedAt && job.createdAt && (
                        <div style={{ display: 'flex', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                          <span>Finished in {((job.completedAt - job.createdAt) / 1000).toFixed(1)}s</span>
                        </div>
                      )}

                      {job.error && <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem' }}>{job.error}</div>}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '12px' }}>
                      {job.status === 'processing' && (
                        <button 
                          onClick={() => handleStopJob(job.jobId)}
                          style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}
                        >
                          <X size={16} /> Stop
                        </button>
                      )}
                      
                      {job.status === 'completed' && (
                        <button 
                          onClick={() => handleDownloadCompleted(job)}
                          className="btn-primary"
                          style={{ border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <DownloadCloud size={18} /> Download
                        </button>
                      )}
                      
                      {(job.status !== 'processing') && (
                        <>
                          {job.status === 'failed' && (
                            <button 
                              onClick={() => handleRetryJob(job.jobId)}
                              style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}
                            >
                              <RefreshCw size={16} /> Retry
                            </button>
                          )}
                          <button 
                            onClick={() => handleStopJob(job.jobId)} // Delete calls removeJob to cleanup
                            style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}
                          >
                            Clear
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
      
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default MediaProcessor;
