import { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';

const API_BASE = 'http://localhost:8000';

const LABELS = [
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

const severityColor = (value) => {
  const v = Math.abs(value ?? 0);
  if (v >= 0.10) return '#EF4444';
  if (v >= 0.05) return '#F59E0B';
  return '#10B981';
};

const fmt = (v, digits = 1) =>
  v == null ? 'N/A' : `${(v * 100).toFixed(digits)}%`;

function FadeSection({ children, delay = 0, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.55, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionCard({ title, children, className = '' }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-slate-950/70 p-5 ${className}`}>
      {title && <h2 className="mb-4 text-sm font-semibold text-slate-100">{title}</h2>}
      {children}
    </div>
  );
}

const TOOLTIP_STYLE = {
  background: '#1E293B',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  fontSize: 12,
  color: '#E2E8F0',
};

const AXIS_TICK = { fill: '#94A3B8', fontSize: 11 };
const YAXIS_TICK = { fill: '#E2E8F0', fontSize: 11 };

function Fairness() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    axios
      .get(`${API_BASE}/fairness`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail || e.message));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
        Failed to load fairness data: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-40 items-center justify-center text-muted text-sm">
        Loading fairness analysis…
      </div>
    );
  }

  const { summary = {}, sex = {}, age = {}, intersectional = {}, metadata } = data;

  // ── Sex chart data ─────────────────────────────────────────────────────────
  const sexChartData = LABELS.map((label) => ({
    name: label,
    Male: sex.male?.[label] ?? null,
    Female: sex.female?.[label] ?? null,
  }));

  // ── Age chart data ─────────────────────────────────────────────────────────
  const ageChartData = LABELS.map((label) => ({
    name: label,
    '<40': age['<40']?.[label] ?? null,
    '40–60': age['40-60']?.[label] ?? null,
    '>60': age['>60']?.[label] ?? null,
  }));

  // ── Intersectional table ───────────────────────────────────────────────────
  const subgroupLabels = {
    Male_lt40:    'Male, <40',
    'Male_<40':   'Male, <40',
    Male_4060:    'Male, 40–60',
    'Male_40-60': 'Male, 40–60',
    Male_gt60:    'Male, >60',
    'Male_>60':   'Male, >60',
    Female_lt40:    'Female, <40',
    'Female_<40':   'Female, <40',
    Female_4060:    'Female, 40–60',
    'Female_40-60': 'Female, 40–60',
    Female_gt60:    'Female, >60',
    'Female_>60':   'Female, >60',
  };

  // Rough n estimates from marginal counts (assuming independence)
  const totalN = metadata?.n_total ?? 202;
  const maleP = (metadata?.n_male ?? 108) / totalN;
  const lt40P = (metadata?.n_lt40 ?? 29) / totalN;
  const m4060P = (metadata?.n_40_60 ?? 65) / totalN;
  const gt60P = (metadata?.n_gt60 ?? 108) / totalN;
  const femaleP = 1 - maleP;

  const nEstimates = {
    'Male_<40':    Math.round(totalN * maleP * lt40P),
    'Male_40-60':  Math.round(totalN * maleP * m4060P),
    'Male_>60':    Math.round(totalN * maleP * gt60P),
    'Female_<40':  Math.round(totalN * femaleP * lt40P),
    'Female_40-60':Math.round(totalN * femaleP * m4060P),
    'Female_>60':  Math.round(totalN * femaleP * gt60P),
  };

  const interRows = Object.entries(intersectional)
    .map(([key, vals]) => {
      const nonNull = Object.values(vals).filter((v) => v !== null);
      const meanAuc = nonNull.length
        ? nonNull.reduce((a, b) => a + b, 0) / nonNull.length
        : 0;
      return { key, label: subgroupLabels[key] ?? key.replace('_', ', '), meanAuc, n: nEstimates[key] ?? '—' };
    })
    .sort((a, b) => b.meanAuc - a.meanAuc);

  const bestKey = interRows[0]?.key;
  const worstKey = interRows[interRows.length - 1]?.key;

  // ── Metric cards ───────────────────────────────────────────────────────────
  const metricCards = [
    {
      label: 'Sex Parity Gap',
      raw: summary.demographic_parity_gap,
      display: fmt(summary.demographic_parity_gap),
      note: 'Overall AUC difference between sexes',
    },
    {
      label: 'Age Opportunity Gap',
      raw: summary.age_equalized_opp_gap,
      display: fmt(summary.age_equalized_opp_gap),
      note: 'Max AUC difference across age groups',
    },
    {
      label: 'Intersectional Gap',
      raw: summary.intersectional_gap,
      display: fmt(summary.intersectional_gap),
      note: 'Best vs worst subgroup mean AUC',
    },
    {
      label: 'Most Biased Label',
      raw: null,
      display: summary.most_sex_biased_label,
      note: `Sex gap: ${summary.sex_bias_value?.toFixed(3) ?? 'N/A'}`,
      isString: true,
    },
  ];

  return (
    <div className="space-y-8">
      {/* ── SECTION 1: Hero ────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="glass-card"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow">Research Feature</p>
            <h1 className="display-title">Model Fairness Analysis</h1>
            <p className="lead">
              Does the model perform equally across demographic groups?
            </p>
          </div>
          <span className="badge shrink-0 self-start">CheXpert · N={totalN}</span>
        </div>
      </motion.section>

      {/* ── SECTION 2: Key Metrics ──────────────────────────────────────────── */}
      <FadeSection delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metricCards.map(({ label, raw, display, note, isString }) => {
            const color = isString ? '#6366F1' : severityColor(raw);
            return (
              <div
                key={label}
                className="rounded-xl border bg-slate-950/70 p-5"
                style={{ borderColor: `${color}55` }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted mb-2">
                  {label}
                </p>
                <p
                  className="text-2xl font-bold leading-none mb-1"
                  style={{ color }}
                >
                  {display}
                </p>
                <p className="text-xs text-muted">{note}</p>
              </div>
            );
          })}
        </div>
      </FadeSection>

      {/* ── SECTION 3: Sex Fairness Chart ──────────────────────────────────── */}
      <FadeSection delay={0.1}>
        <SectionCard title="Performance by Biological Sex">
          <p className="text-xs text-muted mb-4">
            AUC-ROC per pathology. Dashed line = random baseline (0.5).
          </p>
          <div style={{ height: 460 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sexChartData}
                layout="vertical"
                margin={{ top: 0, right: 40, left: 175, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  domain={[0, 1]}
                  tickFormatter={(v) => v.toFixed(1)}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'AUC-ROC', position: 'insideBottom', offset: -2, fill: '#94A3B8', fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={170}
                  tick={YAXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v) => v != null ? v.toFixed(3) : 'N/A'}
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94A3B8', paddingTop: 12 }} />
                <ReferenceLine
                  x={0.5}
                  stroke="#94A3B8"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
                <Bar dataKey="Male"   fill="#1976D2" radius={[0, 3, 3, 0]} maxBarSize={9} />
                <Bar dataKey="Female" fill="#E91E63" radius={[0, 3, 3, 0]} maxBarSize={9} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-muted">
            Most biased label:{' '}
            <span className="font-semibold text-rose-400">{summary.most_sex_biased_label}</span>
            {' '}(Δ = {summary.sex_bias_value?.toFixed(3)})
          </p>
        </SectionCard>
      </FadeSection>

      {/* ── SECTION 4: Age Fairness Chart ──────────────────────────────────── */}
      <FadeSection delay={0.1}>
        <SectionCard title="Performance by Age Group">
          <p className="text-xs text-muted mb-4">
            AUC-ROC per pathology across three age bands.
          </p>
          <div style={{ height: 500 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ageChartData}
                layout="vertical"
                margin={{ top: 0, right: 40, left: 175, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  domain={[0, 1]}
                  tickFormatter={(v) => v.toFixed(1)}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'AUC-ROC', position: 'insideBottom', offset: -2, fill: '#94A3B8', fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={170}
                  tick={YAXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v) => v != null ? v.toFixed(3) : 'N/A'}
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94A3B8', paddingTop: 12 }} />
                <ReferenceLine
                  x={0.5}
                  stroke="#94A3B8"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
                <Bar dataKey="<40"   fill="#43A047" radius={[0, 3, 3, 0]} maxBarSize={8} />
                <Bar dataKey="40–60" fill="#FB8C00" radius={[0, 3, 3, 0]} maxBarSize={8} />
                <Bar dataKey=">60"   fill="#8E24AA" radius={[0, 3, 3, 0]} maxBarSize={8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-muted">
            Worst age gap:{' '}
            <span className="font-semibold text-rose-400">{summary.most_age_sensitive_label}</span>
            {' '}(Δ = {summary.age_sensitivity_value?.toFixed(3)})
          </p>
        </SectionCard>
      </FadeSection>

      {/* ── SECTION 5: Intersectional Table ────────────────────────────────── */}
      <FadeSection delay={0.1}>
        <SectionCard title="Subgroup Performance (Sex × Age)">
          <p className="text-xs text-muted mb-4">
            Mean AUC across all pathologies per subgroup, sorted best to worst.
            N estimates are proportional approximations.
          </p>
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-widest text-muted">Subgroup</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-widest text-muted">Est. N</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-widest text-muted">Mean AUC</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-widest text-muted">Performance</th>
                </tr>
              </thead>
              <tbody>
                {interRows.map(({ key, label, meanAuc, n }, i) => {
                  const isBest = key === bestKey;
                  const isWorst = key === worstKey;
                  const rowBg = isBest
                    ? 'bg-emerald-500/10'
                    : isWorst
                    ? 'bg-rose-500/10'
                    : i % 2 === 0
                    ? 'bg-transparent'
                    : 'bg-white/[0.02]';
                  const textColor = isBest ? '#10B981' : isWorst ? '#EF4444' : '#E2E8F0';
                  return (
                    <tr key={key} className={`border-b border-white/5 last:border-0 ${rowBg}`}>
                      <td className="px-4 py-3 font-medium" style={{ color: textColor }}>
                        {label}
                        {isBest && (
                          <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400">Best</span>
                        )}
                        {isWorst && (
                          <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold bg-rose-500/20 text-rose-400">Worst</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-muted">~{n}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: textColor }}>
                        {meanAuc.toFixed(3)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-2 w-full max-w-[180px] overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(meanAuc * 100).toFixed(1)}%`,
                              background: isBest ? '#10B981' : isWorst ? '#EF4444' : '#6366F1',
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </FadeSection>

      {/* ── SECTION 6: Disclaimer ──────────────────────────────────────────── */}
      <FadeSection delay={0.05}>
        <div className="rounded-xl border border-white/5 bg-slate-900/50 px-5 py-4">
          <p className="text-xs leading-relaxed text-muted">
            <span className="font-semibold text-slate-400">Disclaimer — </span>
            This analysis was conducted on the CheXpert validation set (N=202).
            Results reflect model behavior on this specific dataset and should not be
            generalized without further validation on diverse populations.
            Fairness metrics follow{' '}
            <span className="text-slate-400">Hardt et al. (2016)</span> and{' '}
            <span className="text-slate-400">Kearns et al. (2018)</span>.
            Labels with insufficient positive samples in a subgroup are reported as N/A.
          </p>
        </div>
      </FadeSection>
    </div>
  );
}

export default Fairness;
