import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import ResultPanel from '../components/ResultPanel.jsx';
import { Play, Loader2, Upload, X } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function Analyze() {
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [heatmap, setHeatmap] = useState('');
  const [alpha, setAlpha] = useState(0.45);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [allHeatmapsData, setAllHeatmapsData] = useState(null);
  const [isLoadingAllHeatmaps, setIsLoadingAllHeatmaps] = useState(false);

  // Pre-load image sent from Filter Lab
  useEffect(() => {
    const pending = localStorage.getItem('chestai_pendingAnalysis');
    if (!pending) return;
    localStorage.removeItem('chestai_pendingAnalysis');
    try {
      const { image } = JSON.parse(pending);
      if (!image) return;
      fetch(image)
        .then((r) => r.blob())
        .then((blob) => {
          const f = new File([blob], 'enhanced_xray.png', { type: 'image/png' });
          handleFile(f);
        });
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = useCallback((selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setPrediction(null);
    setHeatmap('');
    setError('');
    setAllHeatmapsData(null);
  }, []);

  const clearFile = () => {
    setFile(null);
    setPreviewUrl('');
    setPrediction(null);
    setHeatmap('');
    setError('');
    setAllHeatmapsData(null);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const submit = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post(`${API_BASE}/predict`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPrediction(response.data);
      setHeatmap(response.data.heatmap);
      setIsDemoMode(!!response.data.demo_mode);
      if (response.data.heatmap) {
        localStorage.setItem('chestai_lastHeatmap', response.data.heatmap);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Unable to analyze image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const fetchAllHeatmaps = async () => {
    if (!file) return;
    setIsLoadingAllHeatmaps(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post(`${API_BASE}/predict-all-heatmaps`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAllHeatmapsData(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Unable to generate heatmaps.');
    } finally {
      setIsLoadingAllHeatmaps(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Constrained: header + upload flow + banners */}
      <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="eyebrow">Analyze</p>
        <h1 className="display-title">Upload an X-ray and inspect the model output.</h1>
        <p className="lead">
          Get probability scores for 14 lung pathologies plus an explainable Grad-CAM overlay.
        </p>
      </motion.section>

      {/* Step 1 / Step 2 */}
      <AnimatePresence mode="wait">
        {!file ? (
          /* ── Step 1: Upload zone ── */
          <motion.section
            key="upload"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
          >
            <div
              className={`group rounded-[2rem] border-2 border-dashed p-10 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-accent/60 bg-accent/5'
                  : 'border-white/10 hover:border-white/20 bg-surface/40'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <div className="mx-auto flex flex-col items-center gap-5">
                <motion.div
                  animate={{ y: isDragging ? -6 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex h-20 w-20 items-center justify-center rounded-3xl border border-accent/20 bg-surface text-4xl"
                >
                  🫁
                </motion.div>
                <div>
                  <p className="text-lg font-semibold text-slate-100">Upload your chest X-ray</p>
                  <p className="mt-1.5 text-sm text-muted">Drop a PNG or JPEG here, or browse to select one.</p>
                </div>
                <span className="primary-btn pointer-events-none flex items-center gap-2 px-6 py-2.5">
                  <Upload size={15} />
                  Browse image
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          </motion.section>
        ) : (
          /* ── Step 2: Preview + Run Analysis CTA ── */
          <motion.section
            key="preview"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            {/* Image preview */}
            <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/30">
              <img
                src={previewUrl}
                alt="X-ray preview"
                className="w-full object-contain"
                style={{ maxHeight: 320 }}
              />
              <button
                onClick={clearFile}
                className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 border border-white/20 text-white/60 hover:text-white hover:bg-black/80 transition-all"
                title="Remove image"
              >
                <X size={14} />
              </button>
            </div>

            {/* Filename + size */}
            <p className="text-center text-xs text-muted">
              {file.name} &nbsp;·&nbsp; {formatBytes(file.size)}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="ml-3 text-accent-hi underline hover:no-underline"
              >
                change
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </p>

            {/* Big Run Analysis button */}
            <motion.button
              onClick={submit}
              disabled={isProcessing}
              animate={!isProcessing ? {
                boxShadow: [
                  '0 0 0px rgba(99,102,241,0)',
                  '0 0 28px rgba(99,102,241,0.55), 0 0 56px rgba(99,102,241,0.15)',
                  '0 0 0px rgba(99,102,241,0)',
                ],
              } : {}}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full rounded-2xl border-2 border-accent/50 bg-gradient-to-r from-accent/15 to-accent/5 px-6 py-5 text-left transition-all hover:border-accent/80 hover:from-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/20 border border-accent/30">
                  {isProcessing ? (
                    <Loader2 size={28} className="animate-spin text-accent-hi" />
                  ) : (
                    <Play size={28} className="text-accent-hi" fill="currentColor" />
                  )}
                </div>
                <div>
                  <p className="text-xl font-bold text-white">
                    {isProcessing ? 'Analyzing X-ray…' : 'Run Analysis'}
                  </p>
                  <p className="text-sm text-muted mt-0.5">
                    Analyzes 14 pathologies + generates Grad-CAM heatmap
                  </p>
                </div>
              </div>
            </motion.button>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Demo mode banner */}
      {isDemoMode && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <strong className="font-semibold">Demo mode</strong> — model file not found at{' '}
          <code className="font-mono text-xs">backend/models/vgg16_best.h5</code>.
          Predictions are randomly generated for UI demonstration only.
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}
      </div>{/* end max-w-2xl wrapper */}

      {/* Results — full width, no narrow container */}
      <ResultPanel
        prediction={prediction}
        previewUrl={previewUrl}
        heatmap={heatmap}
        alpha={alpha}
        setAlpha={setAlpha}
        isProcessing={isProcessing}
        allHeatmapsData={allHeatmapsData}
        isLoadingAllHeatmaps={isLoadingAllHeatmaps}
        onShowAllHeatmaps={fetchAllHeatmaps}
      />
    </div>
  );
}

export default Analyze;
