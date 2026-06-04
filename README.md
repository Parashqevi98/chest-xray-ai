# chest-xray-ai

AI-powered chest X-ray analyzer: classifies 14 pathologies, visualizes predictions with Grad-CAM heatmaps, and audits model fairness.

---

## Overview

**chest-xray-ai** is an end-to-end medical computer vision application that takes a chest X-ray image and returns:

- **Disease classification** across 14 pathology labels
- **Grad-CAM heatmaps** highlighting the regions the model focused on
- **Per-class heatmaps** for all 14 conditions simultaneously
- **Fairness & bias report** breaking down model performance by patient subgroup
- **Image filter lab** for exploring preprocessing techniques

The model is a fine-tuned **VGG16** trained on the **CheXpert** dataset. The system runs in **demo mode** (synthetic predictions) when the model weights are not present, so the UI is always fully explorable.

---

## Features

| Feature | Description |
|---|---|
| 14-class classification | No Finding, Cardiomegaly, Pneumonia, Pleural Effusion, and 10 more |
| Grad-CAM explainability | Heatmap overlay showing what the model "sees" |
| All-class heatmaps | Individual Grad-CAM for every pathology at once |
| Fairness dashboard | AUC and accuracy broken down by demographic subgroup |
| Filter lab | Real-time image filter explorer (CLAHE, edge detection, etc.) |
| Demo mode | Works without model weights — useful for UI development |

---

## Tech Stack

**Backend**
- Python · FastAPI · TensorFlow/Keras · OpenCV · NumPy

**Frontend**
- React 18 · Vite · Tailwind CSS · Framer Motion · Recharts

---

## Project Structure

```
chest-xray-ai/
├── chestai/
│   ├── backend/
│   │   ├── main.py              # FastAPI app, API routes
│   │   ├── model_utils.py       # Model loading, preprocessing, Grad-CAM
│   │   ├── filters.py           # Image filter endpoints
│   │   ├── requirements.txt
│   │   └── models/
│   │       ├── vgg16_best.h5    # Model weights (not tracked in git — see below)
│   │       └── fairness_results.json
│   └── frontend/
│       ├── src/
│       │   ├── pages/           # Analyze, Home, Fairness, FilterLab, HowItWorks
│       │   └── components/      # Navbar, ResultPanel, AllHeatmapsPanel, ...
│       ├── package.json
│       └── vite.config.js
├── Project_Notebooks/
│   ├── notebook-1-eda.ipynb
│   ├── notebook-2-preprocessing.ipynb
│   ├── notebook-3a.ipynb
│   ├── notebook-3b-transfer-learning-densenet121-final.ipynb
│   ├── notebook-4-model-comparison.ipynb
│   ├── notebook-5-grad-cam-explainability.ipynb
│   └── notebook-6-fairness-bias-analysis.ipynb
└── README.md
```

---

## Getting Started

### 1. Model Weights

The trained model file (`vgg16_best.h5`, ~160 MB) is not stored in this repo. Download it and place it at:

```
chestai/backend/models/vgg16_best.h5
```

> Without the weights the app runs in **demo mode** — all UI features work with synthetic predictions.

### 2. Backend

```bash
cd chestai/backend

# Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at `http://localhost:8000/docs`.

### 3. Frontend

```bash
cd chestai/frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/predict` | Classify image + Grad-CAM for top prediction |
| POST | `/predict-all-heatmaps` | Grad-CAM for all 14 classes |
| GET | `/fairness` | Fairness metrics JSON |
| POST | `/filters/...` | Image filter operations |

---

## Notebooks

The `Project_Notebooks/` folder contains the full research pipeline:

1. **EDA** — dataset exploration and class distribution
2. **Preprocessing** — normalization, resizing, augmentation
3a/3b. **Model Training** — VGG16 and DenseNet121 fine-tuning
4. **Model Comparison** — benchmark across architectures
5. **Grad-CAM** — explainability experiments
6. **Fairness & Bias** — subgroup performance analysis

---

## Pathology Labels

```
No Finding · Enlarged Cardiomediastinum · Cardiomegaly · Lung Opacity
Lung Lesion · Edema · Consolidation · Pneumonia · Atelectasis
Pneumothorax · Pleural Effusion · Pleural Other · Fracture · Support Devices
```
