import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import XrayIllustration from './XrayIllustration.jsx';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay },
});

function Hero() {
  const navigate = useNavigate();

  return (
    <div className="grid gap-12 py-6 lg:grid-cols-[1fr_320px] lg:items-center lg:gap-20">
      {/* Left — text */}
      <div className="space-y-6">
        <motion.span {...fadeUp(0)} className="eyebrow block">
          MSc Computer Vision · Research Project
        </motion.span>

        <motion.div {...fadeUp(0.06)} className="space-y-1">
          <h1 className="text-3xl font-light tracking-tight text-slate-300 sm:text-4xl">
            ChestAI
          </h1>
          <p className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            Lung Pathology Detection
          </p>
        </motion.div>

        <motion.p {...fadeUp(0.12)} className="lead max-w-lg">
          Upload a chest X-ray and receive probability predictions for 14 lung
          pathologies, plus a Grad-CAM heatmap for model explainability.
        </motion.p>

        <motion.div {...fadeUp(0.18)} className="flex flex-wrap items-center gap-3">
          <button className="primary-btn" onClick={() => navigate('/analyze')}>
            Analyze X-Ray
          </button>
          <button className="secondary-btn" onClick={() => navigate('/how-it-works')}>
            How it works
          </button>
        </motion.div>

        <motion.div
          {...fadeUp(0.24)}
          className="flex flex-wrap gap-4 text-xs text-muted"
        >
          {[
            { dot: 'bg-green-400', label: '14 pathology classes' },
            { dot: 'bg-accent-hi', label: 'VGG16 backbone' },
            { dot: 'bg-slate-500', label: 'Grad-CAM explainability' },
          ].map(({ dot, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
              {label}
            </span>
          ))}
        </motion.div>
      </div>

      {/* Right — X-ray illustration */}
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.65, delay: 0.1 }}
        className="flex items-center justify-center"
      >
        <XrayIllustration />
      </motion.div>
    </div>
  );
}

export default Hero;
