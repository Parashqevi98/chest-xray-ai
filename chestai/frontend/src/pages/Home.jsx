import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal, Sun, Scan, Activity, Shield, ChevronRight } from 'lucide-react';
import Hero from '../components/Hero.jsx';
import HowItWorks from '../components/HowItWorks.jsx';

const stats = [
  { icon: '🫁', value: '14', label: 'Pathology classes', sub: 'CheXpert label schema' },
  { icon: '🧠', value: 'VGG16', label: 'CNN backbone', sub: 'Deep feature extraction' },
  { icon: '🔬', value: 'Grad-CAM', label: 'Explainability', sub: 'Visual attribution maps' },
  { icon: '📊', value: 'CheXpert', label: 'Training dataset', sub: 'MSc research project' },
  { icon: '⚗️', value: 'Filter Lab', label: 'X-Ray Enhancement', sub: '35 clinical algorithms' },
];

const inView = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, delay },
});

const filterCats = [
  { icon: Sun,              label: 'Lung Enhancement',    color: '#F59E0B' },
  { icon: Scan,             label: 'Edge & Structure',     color: '#EC4899' },
  { icon: Activity,         label: 'Frequency Analysis',  color: '#6366F1' },
  { icon: Shield,           label: 'Noise Reduction',     color: '#10B981' },
];

function Home() {
  const navigate = useNavigate();

  return (
    <div className="space-y-20 py-4">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
      >
        <Hero />
      </motion.section>

      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Stats grid */}
      <motion.section {...inView(0)}>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 lg:grid-cols-5">
          {stats.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="flex flex-col gap-1 bg-surface px-6 py-6"
            >
              <p className="text-xl">{item.icon}</p>
              <p className="text-xl font-semibold text-slate-100">{item.value}</p>
              <p className="text-sm font-medium text-slate-300">{item.label}</p>
              <p className="text-xs text-muted">{item.sub}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* How it works */}
      <motion.section {...inView(0.05)}>
        <HowItWorks />
      </motion.section>

      {/* Filter Lab feature highlight */}
      <motion.section {...inView(0)}>
        <div className="glass-card overflow-hidden">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            {/* Text */}
            <div className="space-y-5">
              <div>
                <span className="inline-block rounded-md border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-accent-hi mb-3">
                  New Feature
                </span>
                <h2 className="text-2xl font-semibold text-slate-50 leading-snug">
                  X-Ray Enhancement Lab
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Apply 35 radiological image processing algorithms — CLAHE, Sobel edge detection,
                  Laplacian, FFT frequency analysis, morphological operations — directly to chest X-rays.
                  Understand how preprocessing affects what the VGG16 model sees.
                </p>
              </div>

              <ul className="space-y-2.5">
                {[
                  { emoji: '🫁', title: 'Lung Enhancement', desc: 'Reveal hidden infiltrates and consolidation' },
                  { emoji: '🔍', title: 'Edge & Structure', desc: 'Detect lung boundaries and vascular markings' },
                  { emoji: '📊', title: 'Frequency Analysis', desc: 'Analyse spatial frequencies in X-ray images' },
                ].map((b) => (
                  <li key={b.title} className="flex items-start gap-2.5 text-sm">
                    <span className="text-base mt-0.5">{b.emoji}</span>
                    <span>
                      <span className="font-medium text-slate-200">{b.title}</span>
                      <span className="text-muted"> — {b.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <motion.button
                onClick={() => navigate('/filter-lab')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="primary-btn flex items-center gap-2"
              >
                Open Filter Lab
                <ChevronRight size={15} />
              </motion.button>
            </div>

            {/* Visual: 2×2 icon grid */}
            <div className="grid grid-cols-2 gap-3">
              {filterCats.map(({ icon: Icon, label, color }) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, scale: 0.92 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-surface/60 p-5 text-center"
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{ backgroundColor: color + '20', border: `1px solid ${color}30` }}
                  >
                    <Icon size={22} style={{ color }} />
                  </div>
                  <p className="text-xs font-medium text-slate-300 leading-tight">{label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Footer note */}
      <motion.footer
        {...inView(0)}
        className="border-t border-white/5 pt-8 text-sm text-muted"
      >
        ChestAI is an academic Computer Vision project for lung pathology detection using
        CheXpert and VGG16. Not intended for clinical use.
      </motion.footer>
    </div>
  );
}

export default Home;
