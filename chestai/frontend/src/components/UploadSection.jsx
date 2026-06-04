import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';

function UploadSection({ onFileSelect, file, previewUrl }) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      setDragging(false);
      const droppedFile = event.dataTransfer.files?.[0];
      if (droppedFile) {
        onFileSelect(droppedFile);
      }
    },
    [onFileSelect]
  );

  const handleChange = (event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className={`group rounded-[2rem] border border-cyan/15 bg-slate-950/60 p-6 text-center shadow-glow ${dragging ? 'border-cyan/70 bg-slate-950/85' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan/20 bg-slate-900/70 text-3xl text-cyan">
          🫁
        </div>
        <div>
          <p className="text-lg font-semibold">Upload your chest X-ray</p>
          <p className="mt-2 text-sm text-slate-400">Drop a PNG or JPEG image here, or browse to select one.</p>
        </div>
        <input
          type="file"
          accept="image/png, image/jpeg"
          id="xray-upload"
          className="hidden"
          onChange={handleChange}
        />
        <label htmlFor="xray-upload" className="primary-btn inline-flex items-center justify-center px-6 py-3">
          Browse image
        </label>
        {previewUrl && (
          <div className="mt-4 rounded-3xl border border-white/10 overflow-hidden">
            <img src={previewUrl} alt="Preview" className="h-72 w-full object-cover" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default UploadSection;
