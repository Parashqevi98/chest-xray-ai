import { motion } from 'framer-motion';

const steps = [
  {
    num: '01',
    title: 'Upload X-ray',
    desc: 'Drop a PNG or JPEG chest radiograph. Standard digital X-ray output is accepted.',
    optional: false,
  },
  {
    num: '02',
    title: 'Enhance (optional)',
    desc: 'Use the Filter Lab to apply CLAHE, edge detection, or noise reduction to improve image quality before analysis.',
    optional: true,
    link: '/filter-lab',
  },
  {
    num: '03',
    title: 'VGG16 inference',
    desc: 'The deep CNN processes the 224×224 input and produces probability scores for 14 pathology classes.',
    optional: false,
  },
  {
    num: '04',
    title: 'Grad-CAM overlay',
    desc: 'Gradients from block5_conv3 are projected back to image space to highlight salient regions.',
    optional: false,
  },
  {
    num: '05',
    title: 'Inspect results',
    desc: 'Review ranked predictions, the probability chart, and heatmap overlay with adjustable intensity.',
    optional: false,
  },
];

function HowItWorks() {
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Workflow</p>
        <h2 className="text-xl font-semibold text-slate-100">How ChestAI works</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step, i) => (
          <motion.div
            key={step.num}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.07 }}
            className={`relative rounded-xl border p-5 ${
              step.optional
                ? 'border-accent/20 bg-accent/5'
                : 'border-white/10 bg-surface/60'
            }`}
          >
            {step.optional && (
              <span className="absolute top-3 right-3 rounded-md border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-hi">
                Optional
              </span>
            )}
            <p className={`mb-3 text-2xl font-light ${step.optional ? 'text-accent/40' : 'text-accent/25'}`}>
              {step.num}
            </p>
            <p className="mb-1.5 text-sm font-semibold text-slate-100">{step.title}</p>
            <p className="text-xs leading-relaxed text-muted">{step.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default HowItWorks;
