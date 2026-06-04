import { motion } from 'framer-motion';
import AllHeatmapsPanel from './AllHeatmapsPanel.jsx';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';

const LABEL_COLS = [
  'No Finding',
  'Enlarged Cardiomediastinum',
  'Cardiomegaly',
  'Lung Opacity',
  'Lung Lesion',
  'Edema',
  'Consolidation',
  'Pneumonia',
  'Atelectasis',
  'Pneumothorax',
  'Pleural Effusion',
  'Pleural Other',
  'Fracture',
  'Support Devices',
];

const getColor = (value) => {
  if (value >= 50) return '#EF4444';
  if (value >= 30) return '#F59E0B';
  return '#10B981';
};

function ResultPanel({ prediction, previewUrl, heatmap, alpha, setAlpha, isProcessing, allHeatmapsData, isLoadingAllHeatmaps, onShowAllHeatmaps }) {
  const predictions = prediction?.predictions || {};

  const chartData = LABEL_COLS
    .map((name) => ({
      name,
      value: parseFloat(((predictions[name] ?? 0) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.value - a.value);

  const topFindings = chartData.slice(0, 3);
  const hasResults = Object.keys(predictions).length > 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.15 }}
      className="glass-card"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Results</p>
            <h2 className="section-title">Model prediction & explainability</h2>
          </div>
          {isProcessing && <span className="badge">Analyzing image…</span>}
        </div>

        {!hasResults && !isProcessing && (
          <p className="text-sm text-muted">
            Upload an X-ray and run analysis to see the heatmap and probability chart.
          </p>
        )}

        {hasResults && (
          <div className="space-y-6">
            {/* Images row */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Original */}
              <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-hi/80 mb-3">
                  Original X-ray
                </p>
                <div className="overflow-hidden rounded-xl border border-white/10">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Original X-ray" className="h-80 w-full object-cover" />
                  ) : (
                    <div className="flex h-80 items-center justify-center text-muted text-sm">
                      No preview available
                    </div>
                  )}
                </div>
              </div>

              {/* Grad-CAM */}
              <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-hi/80">
                      Grad-CAM heatmap
                    </p>
                    <p className="text-xs text-muted mt-0.5">Adjust overlay intensity</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.open(heatmap, '_blank')}
                    className="secondary-btn text-xs px-3 py-1.5"
                  >
                    Download
                  </button>
                </div>
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <img
                    src={heatmap}
                    alt="Grad-CAM overlay"
                    className="h-80 w-full object-cover"
                    style={{ opacity: Math.max(0.3, alpha + 0.1) }}
                  />
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>Overlay strength</span>
                    <span>{Math.round(alpha * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={alpha}
                    onChange={(ev) => setAlpha(parseFloat(ev.target.value))}
                    className="range-slider"
                  />
                </div>
                {!allHeatmapsData && (
                  <button
                    type="button"
                    onClick={onShowAllHeatmaps}
                    disabled={isLoadingAllHeatmaps}
                    className="mt-4 w-full rounded-lg border border-accent/40 px-4 py-2 text-xs font-semibold text-accent-hi transition-colors hover:bg-accent/10 disabled:opacity-50"
                  >
                    {isLoadingAllHeatmaps ? 'Generating 14 Grad-CAM maps…' : 'Show All 14 Heatmaps'}
                  </button>
                )}
              </div>
            </div>

            {/* Top findings + chart */}
            <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
              {/* Top 3 */}
              <div className="rounded-xl border border-white/10 bg-slate-950/70 p-5">
                <h3 className="text-sm font-semibold text-slate-100 mb-4">Top findings</h3>
                <div className="flex flex-col gap-3">
                  {topFindings.map((item, index) => (
                    <div key={item.name} className="result-card">
                      <span className="text-xl">{['🥇', '🥈', '🥉'][index]}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                        <p className="text-xs text-muted">{item.value.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}

                  {/* Legend */}
                  <div className="mt-2 space-y-1.5 border-t border-white/5 pt-3">
                    {[
                      { color: '#EF4444', label: '≥ 50% — High risk' },
                      { color: '#F59E0B', label: '30–50% — Moderate' },
                      { color: '#10B981', label: '< 30% — Low' },
                    ].map(({ color, label }) => (
                      <div key={label} className="flex items-center gap-2 text-xs text-muted">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Horizontal bar chart */}
              <div className="rounded-xl border border-white/10 bg-slate-950/70 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-100">Pathology probabilities</h3>
                  <span className="text-xs text-muted">Sorted by confidence</span>
                </div>
                <div style={{ height: 420 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ top: 0, right: 40, left: 160, bottom: 0 }}
                    >
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fill: '#94A3B8', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={155}
                        tick={{ fill: '#E2E8F0', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value) => [`${value}%`, 'Probability']}
                        contentStyle={{
                          background: '#1E293B',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
                        {chartData.map((entry, index) => (
                          <Cell key={index} fill={getColor(entry.value)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {allHeatmapsData && (
              <AllHeatmapsPanel heatmapsData={allHeatmapsData} />
            )}
          </div>
        )}
      </div>
    </motion.section>
  );
}

export default ResultPanel;
