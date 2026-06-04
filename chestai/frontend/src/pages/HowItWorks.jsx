import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Sun, Scan, Activity, ChevronRight } from 'lucide-react';

const pathologies = [
  { label: 'No Finding', description: 'No lung pathology detected.' },
  { label: 'Enlarged Cardiomediastinum', description: 'Widened central thoracic silhouette.' },
  { label: 'Cardiomegaly', description: 'Enlarged cardiac silhouette on X-ray.' },
  { label: 'Lung Opacity', description: 'Diffuse haziness in lung fields.' },
  { label: 'Lung Lesion', description: 'Focal abnormal opacity in the lungs.' },
  { label: 'Edema', description: 'Fluid accumulation visible in lung tissue.' },
  { label: 'Consolidation', description: 'Dense region due to lung infection.' },
  { label: 'Pneumonia', description: 'Infection presenting as patchy opacity.' },
  { label: 'Atelectasis', description: 'Collapsed lung tissue visible on X-ray.' },
  { label: 'Pneumothorax', description: 'Air outside lung in pleural space.' },
  { label: 'Pleural Effusion', description: 'Fluid collection around the lung.' },
  { label: 'Pleural Other', description: 'Other pleural abnormalities detected.' },
  { label: 'Fracture', description: 'Rib or chest wall bone fracture.' },
  { label: 'Support Devices', description: 'Medical devices visible on imaging.' },
];

const preprocessCards = [
  {
    icon: Sun,
    color: '#F59E0B',
    title: 'Contrast Enhancement',
    body: 'CLAHE (Contrast Limited Adaptive Histogram Equalization) is the clinical standard for making lung infiltrates, edema, and subtle opacities visible that are otherwise hidden in raw X-rays.',
    tag: 'Topic 3-4 · Intensity Transformation',
  },
  {
    icon: Scan,
    color: '#EC4899',
    title: 'Edge & Structure Detection',
    body: 'Sobel, Laplacian, and Canny operators detect lung boundaries, cardiac silhouette contours, and nodule edges — the same mathematical foundations used in modern segmentation networks.',
    tag: 'Topic 4-8 · Spatial Filtering',
  },
  {
    icon: Activity,
    color: '#6366F1',
    title: 'Frequency Domain Analysis',
    body: 'FFT-based low-pass and high-pass filters separate gross anatomical structures from fine radiological details, helping isolate diagnostically relevant frequency bands.',
    tag: 'Topic 5 · Frequency Domain',
  },
];

const pipelineSteps = [
  { label: 'Raw X-Ray',              highlight: false },
  { label: 'Filter Lab Enhancement', highlight: true  },
  { label: 'VGG16 Input',            highlight: false },
  { label: 'Inference',              highlight: false },
  { label: 'Grad-CAM',               highlight: false },
  { label: 'Diagnosis',              highlight: false },
];

const inView = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, delay },
});

function HowItWorks() {
  const navigate = useNavigate();

  return (
    <div className="space-y-16 py-4">
      {/* Header */}
      <motion.section {...inView(0)}>
        <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="eyebrow">How it works</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
              Explainable lung<br />pathology detection
            </h1>
            <p className="lead max-w-lg">
              ChestAI combines a VGG16 backbone trained on CheXpert with Grad-CAM
              explainability. Upload an X-ray, get a ranked pathology report, and
              inspect the model heatmap.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Architecture', value: 'VGG16' },
              { label: 'Explainability', value: 'Grad-CAM' },
              { label: 'Dataset', value: 'CheXpert' },
              { label: 'Pathologies', value: '14 labels' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/10 bg-surface p-4">
                <p className="stat-label">{s.label}</p>
                <p className="stat-value">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── NEW: Preprocessing section ── */}
      <motion.section {...inView(0)}>
        <div className="glass-card space-y-8">
          {/* Header */}
          <div>
            <p className="eyebrow">Preprocessing</p>
            <h2 className="section-title">Image Enhancement Before AI Analysis</h2>
            <p className="text-sm leading-relaxed text-muted max-w-2xl">
              Raw chest X-rays often have suboptimal contrast, sensor noise, or poor visibility of
              subtle structures. Classical computer vision filters — the same techniques taught in
              medical imaging curricula — are applied as preprocessing steps to improve the quality
              of input images before the VGG16 model processes them.
            </p>
          </div>

          {/* Three cards */}
          <div className="grid gap-4 lg:grid-cols-3">
            {preprocessCards.map(({ icon: Icon, color, title, body, tag }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="rounded-xl border border-white/10 bg-surface/60 p-5 space-y-3"
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: color + '20', border: `1px solid ${color}30` }}
                >
                  <Icon size={20} style={{ color }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 mb-1.5">{title}</h3>
                  <p className="text-xs leading-relaxed text-muted">{body}</p>
                </div>
                <span className="inline-block rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-muted">
                  {tag}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Pipeline flow */}
          <div>
            <p className="text-xs text-muted mb-3 font-medium uppercase tracking-wider">AI Diagnostic Pipeline</p>
            <div className="flex flex-wrap items-center gap-1">
              {pipelineSteps.map((step, i) => (
                <div key={step.label} className="flex items-center gap-1">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      step.highlight
                        ? 'bg-accent/20 border border-accent/40 text-accent-hi'
                        : 'bg-white/5 border border-white/10 text-muted'
                    }`}
                  >
                    {step.label}
                  </span>
                  {i < pipelineSteps.length - 1 && (
                    <span className="text-white/20 text-xs">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Link */}
          <div>
            <button
              onClick={() => navigate('/filter-lab')}
              className="primary-btn flex items-center gap-2"
            >
              Explore the Filter Lab
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </motion.section>

      {/* Architecture */}
      <motion.section {...inView(0)}>
        <div className="glass-card">
          <h2 className="section-title">VGG16 + Grad-CAM explained</h2>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="info-card">
              <h3>VGG16</h3>
              <p>Deep convolutional layers extract lung textures and structure across 224×224 inputs.</p>
            </div>
            <div className="info-card">
              <h3>Grad-CAM</h3>
              <p>Gradients from block5_conv3 are projected back to image space to highlight salient regions.</p>
            </div>
            <div className="info-card">
              <h3>Clinical focus</h3>
              <p>Output is presented as probability scores per pathology plus a visual heatmap overlay.</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Pathologies */}
      <motion.section {...inView(0)}>
        <div className="glass-card">
          <h2 className="section-title">The 14 pathologies</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {pathologies.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
                className="pathology-card"
              >
                <h4>{item.label}</h4>
                <p>{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>
    </div>
  );
}

export default HowItWorks;
