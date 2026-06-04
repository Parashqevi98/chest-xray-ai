# ChestAI

ChestAI is an academic medical AI project for lung pathology detection from chest X-rays. It uses a VGG16 model trained on CheXpert and Grad-CAM explainability for a polished research presentation.

## Project structure

- `backend/`
  - `main.py` — FastAPI backend with a single `/predict` endpoint and `/health` status check
  - `model_utils.py` — model loading, image preprocessing, prediction, and Grad-CAM overlay generation
  - `models/vgg16_best.h5` — trained Keras model file (download from Kaggle and place here)
  - `requirements.txt` — Python dependencies

- `frontend/`
  - `src/` — React pages and components
  - `public/` — static assets
  - `package.json` — frontend dependency manifest
  - `vite.config.js` — Vite configuration
  - `tailwind.config.js` — Tailwind CSS config
  - `postcss.config.js` — PostCSS setup

## Setup

### Backend

1. Create a virtual environment:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```
2. Install dependencies:
   ```powershell
   pip install -r backend/requirements.txt
   ```
3. Place the model file at `backend/models/vgg16_best.h5`.
4. Start the backend from the `backend` folder:
   ```powershell
   cd backend
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

### Frontend

1. Change into the frontend directory:
   ```powershell
   cd frontend
   ```
2. Install dependencies:
   ```powershell
   npm install
   ```
3. Start the development server:
   ```powershell
   npm run dev
   ```

## Notes

- The frontend sends predictions to `http://localhost:8000/predict`.
- The backend preprocesses uploads to 224x224, normalizes images to `[0,1]`, converts grayscale to RGB, and returns both probability scores and a Grad-CAM overlay.
- The frontend UI is built with React, Tailwind CSS, Framer Motion, and Recharts.
