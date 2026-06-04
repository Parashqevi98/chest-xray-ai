import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const getColor = (pct) => {
  if (pct >= 50) return '#EF4444';
  if (pct >= 30) return '#F59E0B';
  return '#10B981';
};

const getRiskLabel = (pct) => {
  if (pct >= 50) return 'High';
  if (pct >= 30) return 'Moderate';
  return 'Low';
};

function AllHeatmapsPanel({ heatmapsData }) {
  const [modalLabel, setModalLabel] = useState(null);

  if (!heatmapsData) return null;

  const items = Object.entries(heatmapsData.heatmaps).map(([label, src]) => ({
    label,
    src,
    pct: parseFloat(((heatmapsData.predictions[label] ?? 0) * 100).toFixed(1)),
  }));

  const modalItem = modalLabel ? items.find((i) => i.label === modalLabel) : null;

  return (
    <>
      <div className="rounded-xl border border-white/10 bg-slate-950/70 p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-100">All 14 Grad-CAM maps</h3>
          <p className="text-xs text-muted mt-1">
            Each map highlights the regions driving the model's prediction for that pathology.
            Click any card to enlarge.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {items.map((item, index) => {
            const color = getColor(item.pct);
            return (
              <motion.button
                key={item.label}
                type="button"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                onClick={() => setModalLabel(item.label)}
                className="group flex flex-col overflow-hidden rounded-xl border bg-slate-900/80 text-left transition-transform hover:scale-[1.03]"
                style={{ borderColor: `${color}40` }}
              >
                <div className="relative overflow-hidden">
                  <img
                    src={item.src}
                    alt={`Grad-CAM for ${item.label}`}
                    className="h-28 w-full object-cover transition-opacity group-hover:opacity-90"
                  />
                  <span
                    className="absolute right-1.5 top-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                    style={{ background: color }}
                  >
                    {getRiskLabel(item.pct)}
                  </span>
                </div>
                <div className="p-2">
                  <p className="truncate text-[11px] font-semibold text-slate-200">{item.label}</p>
                  <p className="text-[11px]" style={{ color }}>{item.pct.toFixed(1)}%</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {modalItem && (
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            onClick={() => setModalLabel(null)}
          >
            <motion.div
              key="modal-card"
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.88 }}
              transition={{ duration: 0.25 }}
              className="relative max-w-lg w-full rounded-2xl border border-white/10 bg-slate-900 overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={modalItem.src}
                alt={`Grad-CAM for ${modalItem.label}`}
                className="w-full object-contain"
              />
              <div className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-semibold text-slate-100">{modalItem.label}</p>
                  <p className="text-sm" style={{ color: getColor(modalItem.pct) }}>
                    {modalItem.pct.toFixed(1)}% — {getRiskLabel(modalItem.pct)} risk
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalLabel(null)}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-muted hover:text-slate-100 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default AllHeatmapsPanel;
