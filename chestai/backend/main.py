import base64
import json
import random
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from model_utils import load_model, preprocess_image, predict, generate_gradcam, generate_all_gradcams
from filters import router as filters_router

FAIRNESS_PATH = Path(__file__).parent / "models" / "fairness_results.json"

app = FastAPI(title="ChestAI Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = "models/vgg16_best.h5"
LABELS = [
    "No Finding",
    "Enlarged Cardiomediastinum",
    "Cardiomegaly",
    "Lung Opacity",
    "Lung Lesion",
    "Edema",
    "Consolidation",
    "Pneumonia",
    "Atelectasis",
    "Pneumothorax",
    "Pleural Effusion",
    "Pleural Other",
    "Fracture",
    "Support Devices",
]

app.include_router(filters_router, prefix="/filters")

try:
    model = load_model(MODEL_PATH)
except FileNotFoundError:
    model = None
except Exception as exc:
    raise RuntimeError(f"Unable to load model from {MODEL_PATH}: {exc}")


def _demo_predictions():
    probs = [random.uniform(0.008, 0.06) for _ in LABELS]
    probs[LABELS.index("No Finding")] = random.uniform(0.42, 0.65)
    return probs


def _demo_heatmap(original_image: np.ndarray) -> str:
    h, w = original_image.shape[:2]
    x = np.linspace(-1, 1, w)
    y = np.linspace(-1, 1, h)
    xx, yy = np.meshgrid(x, y)
    z = (
        np.exp(-4 * ((xx + 0.30) ** 2 + (yy + 0.05) ** 2))
        + 0.75 * np.exp(-4 * ((xx - 0.30) ** 2 + (yy + 0.05) ** 2))
    )
    z = (z / z.max() * 255).astype(np.uint8)
    heatmap_color = cv2.applyColorMap(z, cv2.COLORMAP_JET)
    original_bgr = cv2.cvtColor(original_image, cv2.COLOR_RGB2BGR)
    overlay = cv2.addWeighted(heatmap_color, 0.45, original_bgr, 0.55, 0)
    overlay_rgb = cv2.cvtColor(overlay, cv2.COLOR_BGR2RGB)
    _, buf = cv2.imencode(".png", overlay_rgb)
    return f"data:image/png;base64,{base64.b64encode(buf).decode()}"


def _demo_all_heatmaps(original_image: np.ndarray, probs: list) -> dict:
    h, w = original_image.shape[:2]
    x = np.linspace(-1, 1, w)
    y = np.linspace(-1, 1, h)
    xx, yy = np.meshgrid(x, y)
    original_bgr = cv2.cvtColor(original_image, cv2.COLOR_RGB2BGR)

    # Distinct hotspot centers for each of the 14 classes
    centers = [
        (0.0, 0.0),   # No Finding  — central
        (-0.1, -0.5), # Enlarged Cardiomediastinum
        (0.0, -0.3),  # Cardiomegaly
        (-0.4, 0.1),  # Lung Opacity — left lung
        (0.4, 0.1),   # Lung Lesion  — right lung
        (-0.3, -0.1), # Edema
        (0.3, 0.2),   # Consolidation
        (0.2, 0.3),   # Pneumonia
        (-0.35, 0.4), # Atelectasis
        (0.45, -0.2), # Pneumothorax
        (0.0, 0.5),   # Pleural Effusion — base
        (-0.45, 0.5), # Pleural Other
        (0.1, -0.6),  # Fracture — upper
        (-0.2, -0.4), # Support Devices
    ]

    result = {}
    for idx, (cx, cy) in enumerate(centers):
        spread = 0.8 + probs[idx] * 2.0
        z = np.exp(-spread * ((xx - cx) ** 2 + (yy - cy) ** 2))
        z = (z / z.max() * 255).astype(np.uint8)
        heatmap_color = cv2.applyColorMap(z, cv2.COLORMAP_JET)
        overlay = cv2.addWeighted(heatmap_color, 0.45, original_bgr, 0.55, 0)
        overlay_rgb = cv2.cvtColor(overlay, cv2.COLOR_BGR2RGB)
        _, buf = cv2.imencode(".png", overlay_rgb)
        result[idx] = f"data:image/png;base64,{base64.b64encode(buf).decode()}"
    return result


@app.get("/")
def root():
    return {"status": "ChestAI backend running", "model_loaded": model is not None}


@app.get("/health")
def health_check():
    return {"status": "alive", "model_loaded": model is not None}


@app.post("/predict")
async def predict_image(file: UploadFile = File(...)):
    if file.content_type not in ["image/png", "image/jpeg", "image/jpg"]:
        raise HTTPException(status_code=415, detail="Unsupported media type")

    image_bytes = await file.read()
    image_tensor, original_image = preprocess_image(image_bytes)

    if model is None:
        probs = _demo_predictions()
        top_index = int(np.argmax(probs))
        return JSONResponse(
            {
                "predictions": {LABELS[i]: probs[i] for i in range(len(LABELS))},
                "top_prediction": {
                    "label": LABELS[top_index],
                    "confidence": round(probs[top_index], 4),
                },
                "heatmap": _demo_heatmap(original_image),
                "demo_mode": True,
            }
        )

    probabilities = predict(model, image_tensor)
    probabilities = np.squeeze(probabilities).astype(float).tolist()
    top_index = int(np.argmax(probabilities))

    heatmap_overlay = generate_gradcam(
        model,
        image_tensor,
        original_image,
        last_conv_layer_name="block5_conv3",
        alpha=0.45,
    )

    return JSONResponse(
        {
            "predictions": {LABELS[i]: probabilities[i] for i in range(len(LABELS))},
            "top_prediction": {
                "label": LABELS[top_index],
                "confidence": round(probabilities[top_index], 4),
            },
            "heatmap": heatmap_overlay,
        }
    )


@app.get("/fairness")
def get_fairness():
    with open(FAIRNESS_PATH) as f:
        return json.load(f)


@app.post("/predict-all-heatmaps")
async def predict_all_heatmaps(file: UploadFile = File(...)):
    if file.content_type not in ["image/png", "image/jpeg", "image/jpg"]:
        raise HTTPException(status_code=415, detail="Unsupported media type")

    image_bytes = await file.read()
    image_tensor, original_image = preprocess_image(image_bytes)

    if model is None:
        probs = _demo_predictions()
        heatmap_dict = _demo_all_heatmaps(original_image, probs)
        return JSONResponse({
            "heatmaps": {LABELS[i]: heatmap_dict[i] for i in range(len(LABELS))},
            "predictions": {LABELS[i]: round(probs[i], 4) for i in range(len(LABELS))},
            "demo_mode": True,
        })

    probabilities = predict(model, image_tensor)
    probabilities = np.squeeze(probabilities).astype(float).tolist()

    heatmap_dict, _ = generate_all_gradcams(
        model,
        image_tensor,
        original_image,
        last_conv_layer_name="block5_conv3",
        alpha=0.45,
    )

    return JSONResponse({
        "heatmaps": {LABELS[i]: heatmap_dict[i] for i in range(len(LABELS))},
        "predictions": {LABELS[i]: round(probabilities[i], 4) for i in range(len(LABELS))},
    })


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
