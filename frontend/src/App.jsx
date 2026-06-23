import React from 'react';
import { motion } from 'framer-motion';
import { FileDown, Settings2, Download } from 'lucide-react';
import MediaProcessor from './components/MediaProcessor';

function App() {
  return (
    <div className="main-padding" style={{ padding: '2rem' }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ textAlign: 'center', marginBottom: '3rem', marginTop: '2rem' }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '1rem', background: 'rgba(99, 102, 241, 0.1)', padding: '8px 24px', borderRadius: '30px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
          <FileDown size={20} color="#818cf8" />
          <span style={{ color: '#818cf8', fontWeight: 600, letterSpacing: '0.5px' }}>Next-Gen Downloader</span>
        </div>
        <h1 style={{ fontSize: '3.5rem', fontWeight: 700, marginBottom: '1rem', lineHeight: 1.1 }}>
          Download & Convert <br />
          <span className="gradient-text">Anything Instantly.</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.125rem', maxWidth: '600px', margin: '0 auto' }}>
          Paste a link to any video, audio, or file. Convert it to your preferred format, size, and resolution with blazing fast remote processing.
        </p>
      </motion.div>

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <MediaProcessor />
      </div>
      
      <footer style={{ textAlign: 'center', marginTop: '4rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        <p>© 2026 AdminThR Labs. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
