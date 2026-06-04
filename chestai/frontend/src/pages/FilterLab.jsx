import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Stethoscope, Sun, Scan, Activity, LayoutGrid, Shield, Layers,
  Play, Download, Upload, ArrowLeftRight, Loader2, ImageIcon,
  ChevronRight, ChevronUp, ChevronDown, Brain, Check, Info, Zap, X,
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Pipeline metadata
// ---------------------------------------------------------------------------

const PIPELINE_STAGES = ['Preprocessing', 'Model Input', 'VGG16 Inference', 'Diagnosis'];
const PIPELINE_ACTIVE = { preprocessing: [0, 1], analysis: [1, 2, 3], segmentation: [0, 1, 2] };
const PIPELINE_BADGE = {
  preprocessing: { label: 'Preprocessing', cls: 'bg-blue-500/20 text-blue-300 border border-blue-500/30' },
  analysis:      { label: 'Analysis',       cls: 'bg-purple-500/20 text-purple-300 border border-purple-500/30' },
  segmentation:  { label: 'Segmentation',   cls: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' },
};

// ---------------------------------------------------------------------------
// Clinical categories
// ---------------------------------------------------------------------------

const CLINICAL_CATS = [
  {
    id: 'enhancement',
    label: 'Lung Enhancement',
    icon: Sun,
    color: '#F59E0B',
    desc: 'Improve tissue contrast and visibility',
    filters: ['clahe', 'gamma_correction', 'histogram_eq', 'log_transform', 'negative', 'sharpening'],
  },
  {
    id: 'edge',
    label: 'Edge & Structure',
    icon: Scan,
    color: '#EC4899',
    desc: 'Detect borders, vessels and fine details',
    filters: ['canny', 'sobel_combined', 'sobel_x', 'sobel_y', 'laplacian', 'laplacian_gaussian'],
  },
  {
    id: 'noise',
    label: 'Noise Reduction',
    icon: Shield,
    color: '#10B981',
    desc: 'Remove artefacts while preserving anatomy',
    filters: ['gaussian_blur', 'bilateral', 'median_blur', 'mean_blur', 'wiener_approx', 'add_gaussian_noise', 'add_salt_pepper'],
  },
  {
    id: 'frequency',
    label: 'Frequency Analysis',
    icon: Activity,
    color: '#6366F1',
    desc: 'Spatial frequency decomposition and filtering',
    filters: ['fft_spectrum', 'fft_lowpass', 'fft_highpass', 'fft_bandpass'],
  },
  {
    id: 'morphology',
    label: 'Morphology & Color',
    icon: LayoutGrid,
    color: '#14B8A6',
    desc: 'Shape-based operations and colour mapping',
    filters: ['top_hat', 'black_hat', 'morphological_gradient', 'erosion', 'dilation', 'opening', 'closing', 'grayscale', 'pseudocolor', 'channel_red', 'channel_green', 'channel_blue'],
  },
];

// ---------------------------------------------------------------------------
// Per-filter clinical metadata and parameter definitions
// ---------------------------------------------------------------------------

const FILTER_META = {
  clahe: {
    displayName: 'CLAHE',
    shortDesc: 'Adaptive contrast per lung zone',
    pipelineRole: 'preprocessing',
    pathologies: ['Pneumonia', 'Pleural Effusion', 'Atelectasis'],
    params: [
      { name: 'clip_limit', label: 'Clip Limit', min: 1, max: 20, step: 0.5, default: 2.0,
        note: 'Limit 2–4 is optimal; higher risks noise amplification in homogeneous lung parenchyma' },
      { name: 'tile_size', label: 'Tile Size', min: 4, max: 32, step: 2, default: 8,
        note: '8×8 tiles are standard for chest X-ray; smaller tiles adapt more aggressively to local density' },
    ],
  },
  gamma_correction: {
    displayName: 'Gamma Correction',
    shortDesc: 'Brightens under-exposed lung regions',
    pipelineRole: 'preprocessing',
    pathologies: ['Pneumonia', 'Cardiomegaly', 'Pleural Effusion'],
    params: [
      { name: 'gamma', label: 'Gamma (γ)', min: 0.1, max: 3.0, step: 0.05, default: 1.0,
        note: 'γ < 1 brightens shadows revealing hidden consolidation; γ > 1 darkens over-exposed highlights' },
    ],
  },
  histogram_eq: {
    displayName: 'Histogram Equalization',
    shortDesc: 'Global contrast redistribution',
    pipelineRole: 'preprocessing',
    pathologies: ['Pneumonia', 'Consolidation', 'Opacity'],
    params: [],
  },
  log_transform: {
    displayName: 'Log Transform',
    shortDesc: 'Compresses highlights, expands shadows',
    pipelineRole: 'preprocessing',
    pathologies: ['Pneumothorax', 'Nodule', 'Mass'],
    params: [],
  },
  negative: {
    displayName: 'Negative (Invert)',
    shortDesc: 'Reverses contrast for visual inspection',
    pipelineRole: 'analysis',
    pathologies: ['Pneumothorax', 'Pleural Line Detection'],
    params: [],
  },
  sharpening: {
    displayName: 'Sharpening',
    shortDesc: 'Enhances fine anatomical detail',
    pipelineRole: 'preprocessing',
    pathologies: ['Nodule', 'Fracture', 'ETT Placement'],
    params: [
      { name: 'intensity', label: 'Intensity', min: 0.5, max: 3.0, step: 0.1, default: 1.0,
        note: 'Values > 2 may introduce ringing artefacts around high-contrast anatomical edges' },
    ],
  },
  canny: {
    displayName: 'Canny Edge',
    shortDesc: 'Precise lung border detection',
    pipelineRole: 'analysis',
    pathologies: ['Pneumothorax', 'Pleural Effusion', 'Cardiomegaly'],
    params: [
      { name: 'threshold1', label: 'Low Threshold', min: 10, max: 300, step: 5, default: 100,
        note: 'Reduce to detect subtle pleural lines and faint consolidation borders' },
      { name: 'threshold2', label: 'High Threshold', min: 50, max: 600, step: 10, default: 200,
        note: 'Recommended ratio 1:2 or 1:3 with the low threshold for robust edge chains' },
    ],
  },
  sobel_combined: {
    displayName: 'Sobel Gradient',
    shortDesc: 'Full edge magnitude map',
    pipelineRole: 'analysis',
    pathologies: ['Cardiomegaly', 'Pleural Effusion', 'Atelectasis'],
    params: [],
  },
  sobel_x: {
    displayName: 'Sobel X',
    shortDesc: 'Horizontal structural edges',
    pipelineRole: 'analysis',
    pathologies: ['Rib Detection', 'Vertebral Body'],
    params: [],
  },
  sobel_y: {
    displayName: 'Sobel Y',
    shortDesc: 'Vertical structural edges',
    pipelineRole: 'analysis',
    pathologies: ['Cardiomegaly', 'Tracheal Deviation'],
    params: [],
  },
  laplacian: {
    displayName: 'Laplacian',
    shortDesc: 'Second-derivative edge response',
    pipelineRole: 'analysis',
    pathologies: ['Nodule', 'Mass', 'Calcification'],
    params: [
      { name: 'kernel_size', label: 'Kernel Size', min: 1, max: 31, step: 2, default: 3,
        note: 'Larger kernels produce broader edge response but amplify noise significantly' },
    ],
  },
  laplacian_gaussian: {
    displayName: 'LoG (Marr-Hildreth)',
    shortDesc: 'Blob and boundary detection',
    pipelineRole: 'analysis',
    pathologies: ['Nodule', 'Calcification', 'Mass'],
    params: [
      { name: 'kernel_size', label: 'Kernel Size', min: 3, max: 21, step: 2, default: 5,
        note: 'Determines the spatial scale of detected features' },
      { name: 'sigma', label: 'Sigma (σ)', min: 0.1, max: 3.0, step: 0.1, default: 1.0,
        note: 'Larger σ detects larger structural blobs such as masses or effusions' },
    ],
  },
  gaussian_blur: {
    displayName: 'Gaussian Blur',
    shortDesc: 'Standard pre-processing denoiser',
    pipelineRole: 'preprocessing',
    pathologies: ['All pathologies (upstream benefit)'],
    params: [
      { name: 'kernel_size', label: 'Kernel Size', min: 3, max: 21, step: 2, default: 5,
        note: 'Size 3–5 for light denoising before CNN input; 9–15 for aggressive pre-segmentation smoothing' },
      { name: 'sigma', label: 'Sigma (σ)', min: 0, max: 5, step: 0.1, default: 0,
        note: 'σ = 0 auto-calculates from kernel size; σ = 1 is standard clinical denoising level' },
    ],
  },
  bilateral: {
    displayName: 'Bilateral Filter',
    shortDesc: 'Edge-preserving noise reduction',
    pipelineRole: 'preprocessing',
    pathologies: ['Pneumonia', 'Infiltrate', 'Consolidation'],
    params: [
      { name: 'd', label: 'Diameter', min: 3, max: 15, step: 2, default: 9,
        note: 'Pixel neighbourhood diameter; 9 balances quality vs speed for 1024px images' },
      { name: 'sigma_color', label: 'Sigma Color', min: 10, max: 150, step: 5, default: 75,
        note: 'Higher values blend across more intensity differences — use carefully near pleural surfaces' },
      { name: 'sigma_space', label: 'Sigma Space', min: 10, max: 150, step: 5, default: 75,
        note: 'Higher values sample more distant pixels; affects smoothness of lung parenchyma texture' },
    ],
  },
  median_blur: {
    displayName: 'Median Blur',
    shortDesc: 'Impulse noise removal',
    pipelineRole: 'preprocessing',
    pathologies: ['Portable X-ray artefacts', 'Sensor noise'],
    params: [
      { name: 'kernel_size', label: 'Kernel Size', min: 3, max: 21, step: 2, default: 5,
        note: 'Size 3–5 removes impulse noise while preserving anatomical edges cleanly' },
    ],
  },
  mean_blur: {
    displayName: 'Mean Blur',
    shortDesc: 'Simple averaging smoother',
    pipelineRole: 'preprocessing',
    pathologies: ['Heavy noise X-rays'],
    params: [
      { name: 'kernel_size', label: 'Kernel Size', min: 3, max: 21, step: 2, default: 5,
        note: 'Larger kernel = more smoothing but greater anatomical edge degradation' },
    ],
  },
  wiener_approx: {
    displayName: 'Wiener Filter (approx.)',
    shortDesc: 'Noise-aware optimal smoothing',
    pipelineRole: 'preprocessing',
    pathologies: ['Low SNR X-rays', 'Noisy portable images'],
    params: [],
  },
  add_gaussian_noise: {
    displayName: 'Add Gaussian Noise',
    shortDesc: 'Simulate sensor noise (augmentation)',
    pipelineRole: 'analysis',
    pathologies: ['AI robustness testing'],
    params: [
      { name: 'std', label: 'Noise Std Dev', min: 1, max: 80, step: 1, default: 25,
        note: 'Simulates detector noise; used in data augmentation to improve model robustness to acquisition variance' },
    ],
  },
  add_salt_pepper: {
    displayName: 'Add Salt & Pepper',
    shortDesc: 'Simulate detector element failure',
    pipelineRole: 'analysis',
    pathologies: ['Artefact simulation', 'Pipeline robustness'],
    params: [
      { name: 'density', label: 'Density', min: 0.01, max: 0.2, step: 0.01, default: 0.05,
        note: 'Fraction of pixels corrupted; models flat-panel detector dead-pixel artefacts' },
    ],
  },
  fft_spectrum: {
    displayName: 'FFT Spectrum',
    shortDesc: 'Frequency content visualisation',
    pipelineRole: 'analysis',
    pathologies: ['Grid artefacts', 'Systematic scanner noise'],
    params: [],
  },
  fft_lowpass: {
    displayName: 'FFT Low-Pass',
    shortDesc: 'Removes high-frequency noise',
    pipelineRole: 'preprocessing',
    pathologies: ['Anti-scatter grid artefacts', 'High-frequency structured noise'],
    params: [
      { name: 'cutoff_radius', label: 'Cutoff Radius', min: 5, max: 150, step: 5, default: 30,
        note: 'Higher radius retains more detail; 15–30 removes anti-scatter grid line artefacts' },
    ],
  },
  fft_highpass: {
    displayName: 'FFT High-Pass',
    shortDesc: 'Extracts fine structural detail',
    pipelineRole: 'analysis',
    pathologies: ['Nodule', 'Calcification', 'Fine vascular markings'],
    params: [
      { name: 'cutoff_radius', label: 'Cutoff Radius', min: 5, max: 150, step: 5, default: 30,
        note: 'Smaller radius passes only very high frequencies — isolates fine anatomical margins' },
    ],
  },
  fft_bandpass: {
    displayName: 'FFT Band-Pass',
    shortDesc: 'Isolates a specific frequency band',
    pipelineRole: 'analysis',
    pathologies: ['Selective feature extraction'],
    params: [
      { name: 'low_cutoff', label: 'Low Cutoff', min: 5, max: 100, step: 5, default: 10,
        note: 'Lower bound of the frequency band to pass through' },
      { name: 'high_cutoff', label: 'High Cutoff', min: 30, max: 200, step: 5, default: 60,
        note: 'Upper bound; the difference from low cutoff determines the band width' },
    ],
  },
  top_hat: {
    displayName: 'Top-Hat',
    shortDesc: 'Highlights bright structures on dark BG',
    pipelineRole: 'segmentation',
    pathologies: ['Nodule', 'Calcification', 'Vascular markings'],
    params: [
      { name: 'kernel_size', label: 'Kernel Size', min: 3, max: 51, step: 2, default: 15,
        note: 'Kernel slightly larger than target structure; 15–25 for nodule detection' },
    ],
  },
  black_hat: {
    displayName: 'Black-Hat',
    shortDesc: 'Highlights dark structures on bright BG',
    pipelineRole: 'segmentation',
    pathologies: ['Consolidation', 'Pleural Effusion', 'Atelectasis'],
    params: [
      { name: 'kernel_size', label: 'Kernel Size', min: 3, max: 51, step: 2, default: 15,
        note: 'Larger kernel captures more extensive dark regions like pleural fluid collections' },
    ],
  },
  morphological_gradient: {
    displayName: 'Morphological Gradient',
    shortDesc: 'Edge strength via dilation minus erosion',
    pipelineRole: 'segmentation',
    pathologies: ['Lung field boundaries', 'Lesion borders'],
    params: [
      { name: 'kernel_size', label: 'Kernel Size', min: 3, max: 21, step: 2, default: 5,
        note: 'Larger kernel produces a thicker boundary response' },
    ],
  },
  erosion: {
    displayName: 'Erosion',
    shortDesc: 'Shrinks bright regions',
    pipelineRole: 'segmentation',
    pathologies: ['Noise removal', 'Boundary refinement'],
    params: [
      { name: 'kernel_size', label: 'Kernel Size', min: 3, max: 21, step: 2, default: 5,
        note: 'Small kernel for fine cleanup; larger kernel for aggressive region shrinking' },
      { name: 'iterations', label: 'Iterations', min: 1, max: 5, step: 1, default: 1,
        note: 'Multiple passes increase the erosion effect, equivalent to a larger kernel' },
    ],
  },
  dilation: {
    displayName: 'Dilation',
    shortDesc: 'Expands bright regions',
    pipelineRole: 'segmentation',
    pathologies: ['Lung mask expansion', 'Region growing'],
    params: [
      { name: 'kernel_size', label: 'Kernel Size', min: 3, max: 21, step: 2, default: 5,
        note: 'Used to expand lung segmentation masks to include pleural surfaces' },
      { name: 'iterations', label: 'Iterations', min: 1, max: 5, step: 1, default: 1,
        note: 'Use 2–3 for gap filling in incomplete segmentation masks' },
    ],
  },
  opening: {
    displayName: 'Opening',
    shortDesc: 'Removes small bright objects',
    pipelineRole: 'segmentation',
    pathologies: ['Noise removal before segmentation'],
    params: [
      { name: 'kernel_size', label: 'Kernel Size', min: 3, max: 21, step: 2, default: 5,
        note: 'Size 3–5 removes small artefacts without affecting major anatomical structures' },
    ],
  },
  closing: {
    displayName: 'Closing',
    shortDesc: 'Fills small dark holes',
    pipelineRole: 'segmentation',
    pathologies: ['Hole filling in lung masks', 'Consolidation delineation'],
    params: [
      { name: 'kernel_size', label: 'Kernel Size', min: 3, max: 21, step: 2, default: 5,
        note: 'Closes gaps in lung field segmentation masks to produce clean, filled regions' },
    ],
  },
  grayscale: {
    displayName: 'Grayscale',
    shortDesc: 'Convert to luminance channel',
    pipelineRole: 'preprocessing',
    pathologies: ['Standard X-ray format preparation'],
    params: [],
  },
  pseudocolor: {
    displayName: 'Pseudocolor (JET)',
    shortDesc: 'False-colour density map',
    pipelineRole: 'analysis',
    pathologies: ['Density mapping', 'Teaching visualisation'],
    params: [],
  },
  channel_red: {
    displayName: 'Red Channel',
    shortDesc: 'Isolate R component',
    pipelineRole: 'analysis',
    pathologies: ['Colour artefact analysis'],
    params: [],
  },
  channel_green: {
    displayName: 'Green Channel',
    shortDesc: 'Isolate G component',
    pipelineRole: 'analysis',
    pathologies: ['Colour artefact analysis'],
    params: [],
  },
  channel_blue: {
    displayName: 'Blue Channel',
    shortDesc: 'Isolate B component',
    pipelineRole: 'analysis',
    pathologies: ['Colour artefact analysis'],
    params: [],
  },
};

// ---------------------------------------------------------------------------
// Helper: default params for a filter
// ---------------------------------------------------------------------------

function defaultParams(filterId) {
  const meta = FILTER_META[filterId];
  if (!meta) return {};
  return Object.fromEntries(meta.params.map((p) => [p.name, p.default]));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FilterLab() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const splitRef = useRef(null);

  const [activeCat, setActiveCat] = useState('enhancement');
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [params, setParams] = useState({});
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [splitPos, setSplitPos] = useState(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [chainMode, setChainMode] = useState(false);
  const [filterChain, setFilterChain] = useState([]);  // [{filterId, params, expanded}]
  const [chainResult, setChainResult] = useState(null);


  // Load sample image on mount
  useEffect(() => {
    (async () => {
      try {
        const resp = await axios.get(`${API_BASE}/filters/sample`);
        const dataUrl = resp.data.image;
        setImagePreview(dataUrl);
        const blob = await fetch(dataUrl).then((r) => r.blob());
        setImageFile(new File([blob], 'sample_xray.png', { type: 'image/png' }));
      } catch {}
    })();
  }, []);

  // File drop / upload
  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setResult(null);
    setError('');
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // Filter selection
  const selectFilter = (id) => {
    setSelectedFilter(id);
    setParams(defaultParams(id));
    setResult(null);
    setError('');
  };

  // Apply filter
  const applyFilter = async () => {
    if (!imageFile || !selectedFilter) return;
    setIsProcessing(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', imageFile);
      fd.append('filter_type', selectedFilter);
      fd.append('params', JSON.stringify(params));
      const resp = await axios.post(`${API_BASE}/filters/apply`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(resp.data);
      setShowSplit(false);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Filter application failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Split-view drag
  const onSplitMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDraggingSlider(true);
  }, []);

  useEffect(() => {
    if (!isDraggingSlider) return;
    const onMove = (e) => {
      const rect = splitRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
      setSplitPos(pct);
    };
    const onUp = () => setIsDraggingSlider(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [isDraggingSlider]);

  // Download enhanced image
  const downloadResult = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.filtered_image;
    a.download = `${selectedFilter}_enhanced.png`;
    a.click();
  };

  // Send to Analyze page (single mode)
  const analyzeEnhanced = () => {
    if (!result) return;
    localStorage.setItem('chestai_pendingAnalysis', JSON.stringify({
      image: result.filtered_image,
      filterName: result.filter_name,
    }));
    navigate('/analyze');
  };

  // ── Chain mode helpers ──────────────────────────────────────────────────

  const toggleChainMode = () => {
    setChainMode((v) => !v);
    setFilterChain([]);
    setChainResult(null);
    setResult(null);
    setSelectedFilter(null);
    setError('');
  };

  const addToChain = (filterId) => {
    setFilterChain((prev) => [
      ...prev,
      { filterId, params: defaultParams(filterId), expanded: false },
    ]);
  };

  const removeFromChain = (idx) => {
    setFilterChain((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveChainStep = (idx, dir) => {
    setFilterChain((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return next;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const toggleChainStepExpanded = (idx) => {
    setFilterChain((prev) =>
      prev.map((step, i) => (i === idx ? { ...step, expanded: !step.expanded } : step))
    );
  };

  const updateChainStepParam = (idx, paramName, value) => {
    setFilterChain((prev) =>
      prev.map((step, i) =>
        i === idx ? { ...step, params: { ...step.params, [paramName]: parseFloat(value) } } : step
      )
    );
  };

  const applyChain = async () => {
    if (!imageFile || filterChain.length === 0) return;
    setIsProcessing(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', imageFile);
      const filtersJson = JSON.stringify(
        filterChain.map((s) => ({ filter_type: s.filterId, params: s.params }))
      );
      fd.append('filters', filtersJson);
      const url = `${API_BASE}/filters/apply-chain`;
      console.log('[FilterLab] apply-chain URL:', url);
      console.log('[FilterLab] apply-chain filters:', filtersJson);
      const resp = await axios.post(url, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setChainResult(resp.data);
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || err.response?.data || err.message;
      const msg = status ? `HTTP ${status}: ${detail}` : (detail || 'Chain application failed.');
      console.error('[FilterLab] apply-chain error:', msg, err);
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadChainResult = () => {
    if (!chainResult) return;
    const a = document.createElement('a');
    a.href = chainResult.final_image;
    a.download = `chain_${chainResult.total_steps}steps_enhanced.png`;
    a.click();
  };

  const analyzeChainResult = () => {
    if (!chainResult) return;
    localStorage.setItem(
      'chestai_pendingAnalysis',
      JSON.stringify({
        image: chainResult.final_image,
        filterName: `Filter Chain (${chainResult.total_steps} steps)`,
      })
    );
    navigate('/analyze');
  };

  const activeCatData = CLINICAL_CATS.find((c) => c.id === activeCat);
  const selectedMeta = selectedFilter ? FILTER_META[selectedFilter] : null;
  const badge = selectedMeta ? PIPELINE_BADGE[selectedMeta.pipelineRole] : null;
  const activeStages = selectedMeta ? (PIPELINE_ACTIVE[selectedMeta.pipelineRole] || []) : [];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-card"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Stethoscope size={18} className="text-cyan-400" />
              <p className="eyebrow">X-Ray Enhancement Lab</p>
            </div>
            <h1 className="display-title">Clinical Image Processing</h1>
            <p className="lead">Apply radiological image-processing algorithms to chest X-rays and understand their role in the VGG16 diagnostic pipeline.</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <span className="badge">35 Algorithms</span>
            <span className="badge">5 Clinical Categories</span>
            <span className="badge"><Zap size={11} className="inline mr-1" />AI Pipeline Ready</span>
          </div>
        </div>
      </motion.section>

      {/* ── Upload + Filter Selection ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Upload */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="glass-card lg:col-span-2 flex flex-col gap-4"
        >
          <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
            <Upload size={15} className="text-cyan-400" />
            Upload X-Ray
          </h2>

          <div
            className={`relative rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
              isDragging ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-white/10 hover:border-white/20'
            }`}
            style={{ minHeight: 200 }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
          >
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="X-ray preview"
                className="w-full h-full object-contain rounded-xl"
                style={{ maxHeight: 280 }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                <ImageIcon size={32} className="text-white/20" />
                <p className="text-sm text-white/40">Drop a chest X-ray here or click to upload</p>
                <p className="text-xs text-white/20">PNG, JPG, DICOM export</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
            />
          </div>

          {imagePreview && (
            <p className="text-xs text-white/30 text-center">
              {imageFile?.name || 'sample_xray.png'} · click to replace
            </p>
          )}

          {/* Chain builder (chain mode) OR single filter params */}
          {chainMode ? (
            <div className="border-t border-white/5 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <Layers size={14} className="text-cyan-400" />
                  Filter Chain
                </h3>
                {filterChain.length > 0 && (
                  <span className="text-xs text-white/40">
                    {filterChain.length} step{filterChain.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {filterChain.length === 0 ? (
                <p className="text-xs text-white/35 py-2">
                  Click filter cards on the right to add them to the chain.
                </p>
              ) : (
                <div className="space-y-1.5 overflow-y-auto" style={{ maxHeight: 320 }}>
                  {filterChain.map((step, idx) => {
                    const sMeta = FILTER_META[step.filterId];
                    if (!sMeta) return null;
                    const sB = PIPELINE_BADGE[sMeta.pipelineRole];
                    return (
                      <div key={idx} className="rounded-lg border border-white/10 bg-white/3">
                        {/* Step header row */}
                        <div className="flex items-center gap-1.5 p-2">
                          <span className="text-xs font-mono text-white/35 w-4 shrink-0 text-center">{idx + 1}</span>
                          <span className="text-xs font-semibold text-white/80 flex-1 truncate">{sMeta.displayName}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${sB.cls}`}>{sB.label}</span>
                          <button
                            onClick={() => moveChainStep(idx, -1)}
                            disabled={idx === 0}
                            className="p-0.5 text-white/30 hover:text-white disabled:opacity-20 transition-colors"
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            onClick={() => moveChainStep(idx, 1)}
                            disabled={idx === filterChain.length - 1}
                            className="p-0.5 text-white/30 hover:text-white disabled:opacity-20 transition-colors"
                          >
                            <ChevronDown size={12} />
                          </button>
                          {sMeta.params.length > 0 && (
                            <button
                              onClick={() => toggleChainStepExpanded(idx)}
                              className="p-0.5 text-white/30 hover:text-cyan-400 transition-colors"
                              title="Expand parameters"
                            >
                              {step.expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} className="text-white/20" />}
                            </button>
                          )}
                          <button
                            onClick={() => removeFromChain(idx)}
                            className="p-0.5 text-rose-400/50 hover:text-rose-400 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        {/* Expanded params */}
                        {step.expanded && sMeta.params.length > 0 && (
                          <div className="border-t border-white/5 px-3 pb-3 pt-2 space-y-2.5">
                            {sMeta.params.map((p) => (
                              <div key={p.name} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="text-white/60">{p.label}</span>
                                  <span className="text-cyan-400 font-mono">
                                    {step.params[p.name] ?? p.default}
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={p.min}
                                  max={p.max}
                                  step={p.step}
                                  value={step.params[p.name] ?? p.default}
                                  onChange={(e) => updateChainStepParam(idx, p.name, e.target.value)}
                                  className="range-slider w-full"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                onClick={applyChain}
                disabled={isProcessing || !imageFile || filterChain.length === 0}
                className="primary-btn w-full flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <><Loader2 size={15} className="animate-spin" />Applying Chain…</>
                ) : (
                  <><Layers size={15} />Apply Filter Chain ({filterChain.length})</>
                )}
              </button>

              {error && (
                <p className="text-xs text-rose-400 bg-rose-500/10 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>
          ) : (
            /* ── Single filter params ── */
            <AnimatePresence>
              {selectedMeta && (
                <motion.div
                  key={selectedFilter}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-white/5 pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">{selectedMeta.displayName}</h3>
                      {badge && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      )}
                    </div>

                    {selectedMeta.params.length > 0 ? (
                      selectedMeta.params.map((p) => (
                        <div key={p.name} className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-white/70">{p.label}</span>
                            <span className="text-cyan-400 font-mono">{params[p.name] ?? p.default}</span>
                          </div>
                          <input
                            type="range"
                            min={p.min}
                            max={p.max}
                            step={p.step}
                            value={params[p.name] ?? p.default}
                            onChange={(e) =>
                              setParams((prev) => ({ ...prev, [p.name]: parseFloat(e.target.value) }))
                            }
                            className="range-slider w-full"
                          />
                          <p className="text-xs text-white/35 leading-snug">{p.note}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-white/35">No adjustable parameters for this filter.</p>
                    )}

                    <button
                      onClick={applyFilter}
                      disabled={isProcessing || !imageFile}
                      className="primary-btn w-full flex items-center justify-center gap-2"
                    >
                      {isProcessing ? (
                        <><Loader2 size={15} className="animate-spin" />Enhancing…</>
                      ) : (
                        <><Play size={15} />Enhance X-Ray</>
                      )}
                    </button>

                    {error && (
                      <p className="text-xs text-rose-400 bg-rose-500/10 rounded-lg px-3 py-2">
                        {error}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </motion.div>

        {/* Category tabs + filter grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.14 }}
          className="glass-card lg:col-span-3 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
              <Info size={15} className="text-cyan-400" />
              {chainMode ? 'Filter Chain Mode' : 'Select a Filter'}
            </h2>
            {/* Single / Chain toggle */}
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-medium transition-colors ${!chainMode ? 'text-white/70' : 'text-white/30'}`}>Single</span>
              <button
                onClick={toggleChainMode}
                className={`relative w-10 h-5 rounded-full transition-colors ${chainMode ? 'bg-cyan-500/80' : 'bg-white/20'}`}
                title={chainMode ? 'Switch to Single Filter mode' : 'Switch to Filter Chain mode'}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${chainMode ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
              <span className={`text-xs font-medium transition-colors ${chainMode ? 'text-cyan-300' : 'text-white/30'}`}>Chain</span>
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CLINICAL_CATS.map((cat) => {
              const Icon = cat.icon;
              const active = activeCat === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCat(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    active
                      ? 'text-white'
                      : 'text-white/40 hover:text-white/60 bg-white/5 hover:bg-white/8'
                  }`}
                  style={active ? { backgroundColor: cat.color + '25', color: cat.color } : {}}
                >
                  <Icon size={13} />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Category description */}
          {activeCatData && (
            <p className="text-xs text-white/40">{activeCatData.desc}</p>
          )}

          {/* Filter grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto" style={{ maxHeight: 380 }}>
            {(activeCatData?.filters || []).map((filterId) => {
              const meta = FILTER_META[filterId];
              if (!meta) return null;
              const role = meta.pipelineRole;
              const b = PIPELINE_BADGE[role];
              const isSelected = selectedFilter === filterId;
              return (
                <motion.button
                  key={filterId}
                  onClick={() => chainMode ? addToChain(filterId) : selectFilter(filterId)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    !chainMode && isSelected
                      ? 'border-cyan-500/50 bg-cyan-500/10'
                      : 'border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/6'
                  }`}
                  title={chainMode ? `Add ${meta.displayName} to chain` : meta.displayName}
                >
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <span className={`text-xs font-semibold ${!chainMode && isSelected ? 'text-cyan-300' : 'text-white/80'}`}>
                      {meta.displayName}
                    </span>
                    {!chainMode && isSelected && <Check size={12} className="text-cyan-400 shrink-0 mt-0.5" />}
                    {chainMode && <span className="text-white/25 text-xs shrink-0">+ add</span>}
                  </div>
                  <p className="text-xs text-white/40 leading-snug mb-2">{meta.shortDesc}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${b.cls}`}>{b.label}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* ── Results ── */}
      <AnimatePresence>
        {chainMode && chainResult ? (
          /* ═══════════════════════════════════════════
             CHAIN MODE RESULTS
          ═══════════════════════════════════════════ */
          <motion.div
            key="chain-results"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.45 }}
            className="space-y-6"
          >
            {/* Top bar */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/80">
                Chain Results — {chainResult.total_steps} Filter{chainResult.total_steps !== 1 ? 's' : ''} Applied
              </h2>
              <div className="flex gap-2">
                <button onClick={downloadChainResult} className="secondary-btn flex items-center gap-1.5 text-xs py-1.5 px-3">
                  <Download size={13} />Download Final
                </button>
              </div>
            </div>

            {/* Original + Final two-panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Original */}
              <div className="glass-card flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white/30" />
                  <span className="text-xs font-semibold text-white/60">Original X-Ray</span>
                </div>
                <div className="rounded-xl overflow-hidden bg-black/20" style={{ height: 260 }}>
                  {imagePreview && (
                    <img src={imagePreview} alt="Original" className="w-full h-full object-contain" />
                  )}
                </div>
                <p className="text-xs text-white/30 text-center">Input image</p>
              </div>

              {/* Final enhanced */}
              <div className="glass-card flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span className="text-xs font-semibold text-cyan-300">Chain Enhanced X-Ray</span>
                  <span className="ml-auto text-xs text-white/30">{chainResult.total_steps} steps</span>
                </div>
                <div className="rounded-xl overflow-hidden bg-black/20" style={{ height: 260 }}>
                  <img src={chainResult.final_image} alt="Final enhanced" className="w-full h-full object-contain" />
                </div>
                <motion.button
                  onClick={analyzeChainResult}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="primary-btn flex items-center justify-center gap-2 w-full"
                >
                  <Brain size={14} />
                  Analyze Enhanced X-Ray
                  <ChevronRight size={14} />
                </motion.button>
              </div>
            </div>

            {/* Step-by-step strip */}
            <div className="glass-card space-y-4">
              <h3 className="text-sm font-semibold text-white/80">Processing Pipeline</h3>
              <div className="flex items-start gap-2 overflow-x-auto pb-2">
                {/* Original thumbnail */}
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <div className="rounded-lg overflow-hidden border border-white/10 bg-black/20" style={{ width: 120, height: 90 }}>
                    {imagePreview && <img src={imagePreview} alt="Original" className="w-full h-full object-contain" />}
                  </div>
                  <span className="text-[11px] text-white/40 font-medium">Original</span>
                </div>

                {/* Steps */}
                {chainResult.steps.map((step) => (
                  <div key={step.step} className="flex items-center gap-2 shrink-0">
                    <span className="text-white/20 text-sm">→</span>
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className="rounded-lg overflow-hidden border border-white/10 bg-black/20 cursor-pointer hover:border-cyan-500/40 transition-colors"
                        style={{ width: 120, height: 90 }}
                        title={`Step ${step.step}: ${step.filter_name}`}
                      >
                        <img src={step.image} alt={step.filter_name} className="w-full h-full object-contain" />
                      </div>
                      <span className="text-[11px] text-white/50 text-center" style={{ maxWidth: 120 }}>
                        {step.step}. {step.filter_name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-step clinical context cards */}
            {chainResult.steps.map((step) => {
              const sMeta = FILTER_META[step.filter_type];
              const sB = sMeta ? PIPELINE_BADGE[sMeta.pipelineRole] : null;
              const sActiveStages = sMeta ? (PIPELINE_ACTIVE[sMeta.pipelineRole] || []) : [];
              return (
                <div key={step.step} className="glass-card space-y-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="eyebrow mb-1">Step {step.step} — Clinical Context</p>
                      <h3 className="text-lg font-semibold text-white">{step.filter_name}</h3>
                    </div>
                    {sB && <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sB.cls}`}>{sB.label}</span>}
                  </div>
                  {step.clinical_context && (
                    <p className="text-sm text-white/60 leading-relaxed">{step.clinical_context}</p>
                  )}
                  {/* Pipeline stages */}
                  <div>
                    <p className="text-xs text-white/40 mb-3 font-medium uppercase tracking-wider">AI Diagnostic Pipeline</p>
                    <div className="flex items-center gap-0">
                      {PIPELINE_STAGES.map((stage, i) => {
                        const isActive = sActiveStages.includes(i);
                        return (
                          <div key={stage} className="flex items-center">
                            <div className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${isActive ? 'bg-cyan-500/15 border border-cyan-500/30' : 'opacity-30'}`}>
                              <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-cyan-400' : 'bg-white/20'}`} />
                              <span className={`text-xs font-medium ${isActive ? 'text-cyan-300' : 'text-white/30'}`}>{stage}</span>
                            </div>
                            {i < PIPELINE_STAGES.length - 1 && (
                              <div className={`h-px w-4 ${sActiveStages.includes(i) && sActiveStages.includes(i + 1) ? 'bg-cyan-400/50' : 'bg-white/10'}`} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {sMeta?.pathologies?.length > 0 && (
                    <div>
                      <p className="text-xs text-white/40 mb-2 font-medium uppercase tracking-wider">Helps Detect</p>
                      <div className="flex flex-wrap gap-2">
                        {sMeta.pathologies.map((p) => (
                          <span key={p} className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {step.topic && (
                    <p className="text-xs text-white/30 font-mono">{step.topic}</p>
                  )}
                </div>
              );
            })}
          </motion.div>
        ) : !chainMode && result ? (
          /* ═══════════════════════════════════════════
             SINGLE FILTER RESULTS (unchanged)
          ═══════════════════════════════════════════ */
          <motion.div
            key="single-results"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.45 }}
            className="space-y-6"
          >
            {/* Three-panel / split-view toggle */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/80">Enhancement Results</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSplit((v) => !v)}
                  className={`secondary-btn flex items-center gap-1.5 text-xs py-1.5 px-3 ${showSplit ? 'border-cyan-500/50 text-cyan-300' : ''}`}
                >
                  <ArrowLeftRight size={13} />
                  {showSplit ? 'Three Panels' : 'Split View'}
                </button>
                <button
                  onClick={downloadResult}
                  className="secondary-btn flex items-center gap-1.5 text-xs py-1.5 px-3"
                >
                  <Download size={13} />
                  Download
                </button>
              </div>
            </div>

            {showSplit ? (
              /* Split view */
              <div className="glass-card overflow-hidden">
                <p className="text-xs text-white/40 mb-3">Drag the divider to compare</p>
                <div
                  ref={splitRef}
                  className="relative select-none rounded-xl overflow-hidden"
                  style={{ height: 400, cursor: isDraggingSlider ? 'col-resize' : 'default' }}
                >
                  {/* Original */}
                  <img
                    src={imagePreview}
                    alt="Original"
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                  {/* Enhanced overlay */}
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
                  >
                    <img
                      src={result.filtered_image}
                      alt="Enhanced"
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  </div>
                  {/* Divider */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-cyan-400/80 cursor-col-resize flex items-center justify-center"
                    style={{ left: `${splitPos}%` }}
                    onMouseDown={onSplitMouseDown}
                    onTouchStart={onSplitMouseDown}
                  >
                    <div className="w-6 h-6 rounded-full bg-cyan-400 flex items-center justify-center shadow-lg">
                      <ArrowLeftRight size={12} className="text-navy" />
                    </div>
                  </div>
                  {/* Labels */}
                  <span className="absolute top-2 left-2 text-xs bg-black/50 text-white/70 px-2 py-1 rounded-md">Original</span>
                  <span className="absolute top-2 right-2 text-xs bg-black/50 text-cyan-300 px-2 py-1 rounded-md">{result.filter_name}</span>
                </div>
              </div>
            ) : (
              /* Two panels */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original */}
                <div className="glass-card flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-white/30" />
                    <span className="text-xs font-semibold text-white/60">Original X-Ray</span>
                  </div>
                  <div className="rounded-xl overflow-hidden bg-black/20" style={{ height: 260 }}>
                    {imagePreview && (
                      <img src={imagePreview} alt="Original" className="w-full h-full object-contain" />
                    )}
                  </div>
                  <p className="text-xs text-white/30 text-center">Input image</p>
                </div>

                {/* Enhanced */}
                <div className="glass-card flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="text-xs font-semibold text-cyan-300">{result.filter_name} Enhanced</span>
                  </div>
                  <div className="rounded-xl overflow-hidden bg-black/20" style={{ height: 260 }}>
                    <img src={result.filtered_image} alt="Enhanced" className="w-full h-full object-contain" />
                  </div>
                  <p className="text-xs text-white/30 text-center">After applying filter</p>
                </div>
              </div>
            )}

            {/* Clinical Context Card */}
            <div className="glass-card space-y-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="eyebrow mb-1">Clinical Context</p>
                  <h3 className="text-lg font-semibold text-white">{result.filter_name}</h3>
                </div>
                {badge && (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badge.cls}`}>
                    {badge.label}
                  </span>
                )}
              </div>

              {result.clinical_context && (
                <p className="text-sm text-white/60 leading-relaxed">{result.clinical_context}</p>
              )}

              {/* Pipeline indicator */}
              <div>
                <p className="text-xs text-white/40 mb-3 font-medium uppercase tracking-wider">AI Diagnostic Pipeline</p>
                <div className="flex items-center gap-0">
                  {PIPELINE_STAGES.map((stage, i) => {
                    const isActive = activeStages.includes(i);
                    return (
                      <div key={stage} className="flex items-center">
                        <motion.div
                          animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
                          className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
                            isActive
                              ? 'bg-cyan-500/15 border border-cyan-500/30'
                              : 'opacity-30'
                          }`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-cyan-400' : 'bg-white/20'}`} />
                          <span className={`text-xs font-medium ${isActive ? 'text-cyan-300' : 'text-white/30'}`}>
                            {stage}
                          </span>
                        </motion.div>
                        {i < PIPELINE_STAGES.length - 1 && (
                          <div className={`h-px w-4 ${activeStages.includes(i) && activeStages.includes(i + 1) ? 'bg-cyan-400/50' : 'bg-white/10'}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pathologies */}
              {selectedMeta?.pathologies?.length > 0 && (
                <div>
                  <p className="text-xs text-white/40 mb-2 font-medium uppercase tracking-wider">Helps Detect</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedMeta.pathologies.map((p) => (
                      <span key={p} className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Math formula */}
              {result.math && (
                <div className="rounded-lg bg-black/30 border border-white/5 px-4 py-3">
                  <p className="text-xs text-white/30 mb-1 font-medium">Formula</p>
                  <code className="text-xs text-cyan-300/80 font-mono">{result.math}</code>
                </div>
              )}

              {/* CTA */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-white/5">
                <motion.button
                  onClick={analyzeEnhanced}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="primary-btn flex items-center justify-center gap-2"
                >
                  <Brain size={15} />
                  Analyze Enhanced X-Ray
                  <ChevronRight size={15} />
                </motion.button>
                <p className="text-xs text-white/30 self-center">
                  Sends the enhanced image to the Analyze page for VGG16 inference.
                </p>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
