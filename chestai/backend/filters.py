import base64
import json
import random

import cv2
import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

router = APIRouter(tags=["filters"])

# ---------------------------------------------------------------------------
# Filter metadata
# ---------------------------------------------------------------------------

FILTER_INFO = {
    "gaussian_blur": {
        "name": "Gaussian Blur",
        "description": "Convolves the image with a Gaussian kernel to smoothly reduce noise and detail.",
        "math": "G(x,y) = (1/2πσ²) · exp(-(x²+y²) / 2σ²)",
        "topic": "Topic 4: Spatial Filtering",
        "use_case": "Noise reduction, anti-aliasing, pre-processing before edge detection.",
        "clinical_context": "Gaussian smoothing suppresses high-frequency sensor noise in X-ray flat-panel detectors before neural network inference. Without denoising, spurious noise activates early convolutional filters and degrades feature maps — reducing prediction accuracy for subtle pathologies like early-stage pneumonia and small nodules. This is the most common first step in chest X-ray AI pipelines including CheXNet and CheXpert-based models.",
        "use_in_pipeline": "preprocessing",
    },
    "mean_blur": {
        "name": "Mean Blur",
        "description": "Replaces each pixel with the average of its neighbourhood — the simplest smoothing filter.",
        "math": "f(x,y) = (1/k²) · Σ I(x+i, y+j)  for i,j ∈ [-k/2, k/2]",
        "topic": "Topic 4: Spatial Filtering",
        "use_case": "Quick noise reduction; less effective than Gaussian at preserving edges.",
        "clinical_context": "Mean blur provides basic noise reduction but blurs anatomical edges more aggressively than Gaussian or bilateral filters. Suitable for very noisy portable X-ray images where edge preservation is less critical. Rarely used in modern AI pipelines due to better alternatives, but demonstrates the fundamental averaging principle underlying all spatial smoothing.",
        "use_in_pipeline": "preprocessing",
    },
    "median_blur": {
        "name": "Median Blur",
        "description": "Replaces each pixel with the median of its neighbourhood — very effective against impulse noise.",
        "math": "f(x,y) = median{ I(x+i, y+j) }",
        "topic": "Topic 4: Spatial Filtering",
        "use_case": "Salt-and-pepper noise removal while preserving edges.",
        "clinical_context": "Median filtering eliminates impulse noise (bright/dark pixel artefacts) caused by flat-panel detector element failures, scatter radiation, or digital transmission errors. Critical for cleaning images from older or portable bedside X-ray systems before AI analysis. Unlike mean blur, it preserves sharp anatomical edges — making it ideal when both noise removal and boundary clarity are needed.",
        "use_in_pipeline": "preprocessing",
    },
    "sharpening": {
        "name": "Sharpening",
        "description": "Enhances edges and fine detail by subtracting a scaled Laplacian from the original.",
        "math": "Kernel: [[0,-1,0],[-1,5,-1],[0,-1,0]]  (scaled by intensity)",
        "topic": "Topic 4: Spatial Filtering",
        "use_case": "Enhancing radiograph detail, improving perceived sharpness.",
        "clinical_context": "Unsharp masking (sharpening) enhances fine anatomical detail: calcified nodules appear crisper, support device wires (ETT tubes, central lines) become more visible, hairline fractures stand out more clearly, and vascular markings are better defined. Used in PACS (Picture Archiving and Communication Systems) display stations and as a post-processing step in portable X-ray workflows.",
        "use_in_pipeline": "preprocessing",
    },
    "bilateral": {
        "name": "Bilateral Filter",
        "description": "Edge-preserving smoothing: weights neighbours by both spatial distance and intensity similarity.",
        "math": "f(x) = (1/Wp) · Σ I(y) · Gs(‖x−y‖) · Gr(|I(x)−I(y)|)",
        "topic": "Topic 4: Spatial Filtering",
        "use_case": "Noise reduction while strongly preserving anatomical boundaries.",
        "clinical_context": "Bilateral filtering is the preferred denoising filter for medical imaging AI pipelines. Unlike Gaussian blur, it preserves critical anatomical boundaries (lung-pleura interface, cardiac silhouette, fissure lines) while smoothing flat regions like the lung parenchyma. This makes it ideal as the first preprocessing step before feeding images to VGG16 — clean image, sharp boundaries, maximum pathology signal for the convolutional filters.",
        "use_in_pipeline": "preprocessing",
    },
    "sobel_x": {
        "name": "Sobel X",
        "description": "Detects vertical edges by convolving with the horizontal derivative kernel.",
        "math": "Kx = [[-1,0,1],[-2,0,2],[-1,0,1]]",
        "topic": "Topic 4: Edge Detection",
        "use_case": "Detecting vertical structures such as rib edges.",
        "clinical_context": "The horizontal Sobel derivative highlights vertical anatomical structures: the mediastinal border, spine margins, and vertical rib edges. Used in surgical planning and automated rib fracture detection algorithms. By isolating the x-gradient, clinicians can assess mediastinal widening — a key indicator of aortic dissection.",
        "use_in_pipeline": "analysis",
    },
    "sobel_y": {
        "name": "Sobel Y",
        "description": "Detects horizontal edges by convolving with the vertical derivative kernel.",
        "math": "Ky = [[-1,-2,-1],[0,0,0],[1,2,1]]",
        "topic": "Topic 4: Edge Detection",
        "use_case": "Detecting horizontal structures such as diaphragm outline.",
        "clinical_context": "The vertical Sobel derivative highlights horizontal structures: the diaphragm dome (key for assessing elevation in atelectasis or subphrenic abscess), the horizontal fissure (a marker for right upper lobe collapse), and costophrenic angles (blunted by pleural effusion). Critical for automated diaphragm tracking in serial X-rays.",
        "use_in_pipeline": "analysis",
    },
    "sobel_combined": {
        "name": "Sobel Combined",
        "description": "Gradient magnitude combining both Sobel directions — detects edges at any orientation.",
        "math": "|G| = √(Gx² + Gy²)",
        "topic": "Topic 4: Edge Detection",
        "use_case": "Full edge map; commonly used before contour-based segmentation.",
        "clinical_context": "Sobel gradient magnitude produces a comprehensive edge map of all thoracic structures regardless of orientation. Highlights the cardiac silhouette border for automated cardiomegaly assessment (cardiothoracic ratio measurement), rib contours for fracture screening, and lung-field boundaries for volumetric estimation. A key intermediate step in automated lung segmentation pipelines used with VGG16-class models.",
        "use_in_pipeline": "analysis",
    },
    "laplacian": {
        "name": "Laplacian",
        "description": "Second-order derivative operator that highlights regions of rapid intensity change.",
        "math": "∇²I = ∂²I/∂x² + ∂²I/∂y²",
        "topic": "Topic 4: Edge Detection",
        "use_case": "Edge sharpening and blob detection.",
        "clinical_context": "The Laplacian detects second-order intensity changes — more sensitive than Sobel to abrupt boundaries. Useful for highlighting calcification boundaries (dense bright structures), foreign body edges, and pneumothorax lines. Typically applied after Gaussian smoothing (see LoG) to reduce noise sensitivity. Can identify zero-crossings that mark the precise boundary between aerated lung and consolidated tissue.",
        "use_in_pipeline": "analysis",
    },
    "laplacian_gaussian": {
        "name": "Laplacian of Gaussian (LoG)",
        "description": "Gaussian blur followed by Laplacian — smooths noise before computing second derivatives.",
        "math": "LoG(x,y) = -(1/πσ⁴)(1 - (x²+y²)/2σ²) · e^(-(x²+y²)/2σ²)",
        "topic": "Topic 4: Edge Detection",
        "use_case": "Robust edge detection; blob/lesion detection in medical imaging.",
        "clinical_context": "The Laplacian of Gaussian (Marr–Hildreth detector) is particularly sensitive to rounded structures — making it valuable for pulmonary nodule detection, coin lesions, and small opacities. The Gaussian pre-smoothing eliminates high-frequency noise that would generate false edges, leaving only real anatomical boundaries. Widely used in Computer-Aided Detection (CAD) systems for lung nodule screening (e.g., LUNA16 challenge baseline methods).",
        "use_in_pipeline": "analysis",
    },
    "canny": {
        "name": "Canny Edge Detector",
        "description": "Multi-stage detector: Gaussian blur → gradient → non-max suppression → hysteresis thresholding.",
        "math": "Hysteresis: keep edge if gradient ≥ T2; keep if T1 ≤ grad < T2 and connected to strong edge",
        "topic": "Topic 4: Edge Detection",
        "use_case": "Gold-standard edge map; lung boundary delineation.",
        "clinical_context": "Canny is the gold standard for delineating anatomical boundaries in clinical radiology. It precisely traces the lung borders, diaphragm contour, cardiac silhouette, and pleural surfaces — the exact contours needed to detect pneumothorax (collapsed lung border), pleural effusion (blunted costophrenic angle), and cardiomegaly (enlarged cardiac shadow). Used as a preprocessing step in U-Net–based lung segmentation models to provide structural priors.",
        "use_in_pipeline": "analysis",
    },
    "fft_lowpass": {
        "name": "FFT Low-pass Filter",
        "description": "Transforms to frequency domain, zeros high-frequency components, inverts — keeps smooth regions.",
        "math": "H(u,v) = 1 if √(u²+v²) ≤ D₀, else 0",
        "topic": "Topic 5: Frequency Domain Filtering",
        "use_case": "Smoothing, noise removal; equivalent to blur but controllable in frequency space.",
        "clinical_context": "Low-pass filtering in the frequency domain suppresses high-frequency noise while retaining gross anatomical structures — lung fields, cardiac shadow, and mediastinal contours. Unlike spatial Gaussian blur, the cutoff frequency is precisely controllable, enabling targeted removal of specific noise frequencies identified in X-ray QA analysis. Useful when specific detector noise signatures need to be suppressed before model inference.",
        "use_in_pipeline": "analysis",
    },
    "fft_highpass": {
        "name": "FFT High-pass Filter",
        "description": "Zeros low-frequency components in the Fourier domain — keeps edges and textures.",
        "math": "H(u,v) = 0 if √(u²+v²) ≤ D₀, else 1",
        "topic": "Topic 5: Frequency Domain Filtering",
        "use_case": "Edge enhancement, texture analysis.",
        "clinical_context": "High-pass filtering removes the low-frequency background illumination gradient and retains fine anatomical detail — nodule edges, vessel walls, calcification boundaries, and fine interstitial patterns. Useful for revealing subtle findings masked by uneven X-ray beam intensity or patient positioning. The result highlights features that contribute to high-frequency activations in early VGG16 convolutional layers.",
        "use_in_pipeline": "analysis",
    },
    "fft_bandpass": {
        "name": "FFT Band-pass Filter",
        "description": "Retains only a ring of frequencies between low and high cutoffs.",
        "math": "H(u,v) = 1 if D_low ≤ √(u²+v²) ≤ D_high, else 0",
        "topic": "Topic 5: Frequency Domain Filtering",
        "use_case": "Isolating periodic structures; removing both noise and DC background.",
        "clinical_context": "Band-pass filtering isolates a specific spatial frequency range, enabling analysis of structures at a particular scale. By tuning the band, clinicians can selectively visualise rib cage periodicity, pulmonary vasculature patterns, or interstitial markings associated with fibrosis and oedema — each of which occupies a characteristic frequency band in the Fourier spectrum.",
        "use_in_pipeline": "analysis",
    },
    "fft_spectrum": {
        "name": "FFT Magnitude Spectrum",
        "description": "Visualises the log-magnitude of the 2-D Fourier transform — reveals dominant frequencies.",
        "math": "S(u,v) = log(1 + |F(u,v)|)",
        "topic": "Topic 5: Frequency Domain Filtering",
        "use_case": "Diagnostic tool to understand image frequency content and detect periodic artefacts.",
        "clinical_context": "The Fourier magnitude spectrum is a diagnostic tool for X-ray quality assurance. Bright spots displaced from the centre indicate periodic artefacts — anti-scatter grid lines, moiré patterns, or detector element row/column defects — that corrupt model predictions by introducing systematic high-frequency signals not present in clinical training data. Used in acquisition pipeline QA before images are fed to AI models.",
        "use_in_pipeline": "analysis",
    },
    "histogram_eq": {
        "name": "Histogram Equalisation",
        "description": "Redistributes pixel intensities so the cumulative histogram is approximately linear.",
        "math": "s = T(r) = (L-1) · CDF(r)",
        "topic": "Topic 3: Intensity Transformations",
        "use_case": "Improving contrast in low-contrast X-rays and CT scans.",
        "clinical_context": "Global histogram equalisation redistributes intensity values across the full dynamic range — revealing structures that are invisible in poorly windowed X-rays. Particularly effective for low-dose paediatric X-rays or images with narrow grey-level distributions. However, it can over-amplify noise in flat regions, which is why CLAHE (local adaptive version) is preferred for clinical AI pipelines.",
        "use_in_pipeline": "preprocessing",
    },
    "clahe": {
        "name": "CLAHE",
        "description": "Contrast Limited Adaptive HE — applies equalisation locally with a clip limit to avoid noise amplification.",
        "math": "Local HE with histogram clipping at clip_limit before redistribution",
        "topic": "Topic 3: Intensity Transformations",
        "use_case": "Preferred over global HE for medical images; preserves local contrast without over-amplifying noise.",
        "clinical_context": "CLAHE is the gold standard preprocessing step in clinical radiology AI. It adaptively enhances local contrast across different tissue regions — brightening subtle infiltrates in lung parenchyma while not over-amplifying noise in homogeneous regions. Standard preprocessing in CheXNet (Stanford), CheXpert-AI pipelines, and most modern chest X-ray deep learning systems. Makes early-stage pneumonia, pulmonary oedema, and subtle consolidations visible that appear completely washed out in raw images.",
        "use_in_pipeline": "preprocessing",
    },
    "gamma_correction": {
        "name": "Gamma Correction",
        "description": "Power-law transformation that brightens (γ<1) or darkens (γ>1) the image non-linearly.",
        "math": "s = c · rᵞ  where c = 255 / 255ᵞ",
        "topic": "Topic 3: Intensity Transformations",
        "use_case": "Display calibration, recovering detail in under/over-exposed radiographs.",
        "clinical_context": "Gamma correction replicates the intensity windowing performed by radiologists in PACS workstations. γ < 1 brightens the image, recovering detail in underexposed or dense-tissue regions — ideal for revealing atelectasis in large patients. γ > 1 darkens overpenetrated images to improve visualisation of mediastinal widening. Part of the standard display pipeline in clinical radiology and used in training data normalisation.",
        "use_in_pipeline": "preprocessing",
    },
    "log_transform": {
        "name": "Log Transform",
        "description": "Compresses the dynamic range by mapping pixel values through a logarithm.",
        "math": "s = c · log(1 + r)",
        "topic": "Topic 3: Intensity Transformations",
        "use_case": "Enhancing detail in dark regions; visualising Fourier spectra.",
        "clinical_context": "Logarithmic transformation compresses the wide dynamic range of X-ray images, making details in both dark (lung fields) and bright (bone, mediastinum) regions simultaneously visible. Mimics the logarithmic response of X-ray film, historically the standard display medium. Useful for revealing interstitial patterns, subtle ground-glass opacities, and small lesions hidden in the shadow of denser structures.",
        "use_in_pipeline": "preprocessing",
    },
    "negative": {
        "name": "Negative",
        "description": "Inverts pixel intensities — dark regions become bright and vice versa.",
        "math": "s = (L-1) - r",
        "topic": "Topic 3: Intensity Transformations",
        "use_case": "Enhancing white lesions in dark backgrounds on X-ray.",
        "clinical_context": "Image negation produces a 'positive' image (bone appears dark, air appears bright) from the standard X-ray negative convention. Historically important when viewing printed X-ray film. Some radiologists prefer the inverted display for detecting subtle pleural thickening and pneumothorax lines, as dark boundaries on a light background can be more perceptually salient.",
        "use_in_pipeline": "analysis",
    },
    "grayscale": {
        "name": "Grayscale",
        "description": "Converts colour image to single-channel luminance using perceptual weights.",
        "math": "Y = 0.114·B + 0.587·G + 0.299·R",
        "topic": "Topic 7: Colour Image Processing",
        "use_case": "Reducing computation; X-rays are inherently grayscale.",
        "clinical_context": "Standard chest X-rays are inherently single-channel (luminance) images. Converting colour-processed or pseudo-coloured images back to grayscale is necessary before feeding them to models trained on greyscale data like VGG16 fine-tuned on CheXpert. Also used to discard colour artefacts introduced by JPEG compression or display calibration before preprocessing.",
        "use_in_pipeline": "preprocessing",
    },
    "channel_red": {
        "name": "Red Channel",
        "description": "Isolates the red channel of the RGB image; other channels set to zero.",
        "math": "Output = [0, 0, R]  (in BGR order)",
        "topic": "Topic 7: Colour Image Processing",
        "use_case": "Analysing colour contributions; visualising colour separation.",
        "clinical_context": "Used in dual-energy subtraction radiography to separate bone-signal (higher-energy) from soft-tissue signal. In colour-coded medical imaging, isolating channels reveals how different tissue types are represented in each spectral component — relevant for understanding Grad-CAM colour maps produced by the VGG16 model.",
        "use_in_pipeline": "analysis",
    },
    "channel_green": {
        "name": "Green Channel",
        "description": "Isolates the green channel — green carries the most luminance information.",
        "math": "Output = [0, G, 0]",
        "topic": "Topic 7: Colour Image Processing",
        "use_case": "Analysing green-channel content; often closest to grayscale perception.",
        "clinical_context": "The green channel carries the most luminance information in RGB images, making it the closest approximation to grayscale. In retinal imaging and some fluorescence-enhanced X-ray systems, the green channel isolates specific contrast agent signals. Useful for understanding how colourised Grad-CAM overlays represent pathology regions in the original image.",
        "use_in_pipeline": "analysis",
    },
    "channel_blue": {
        "name": "Blue Channel",
        "description": "Isolates the blue channel of the RGB image.",
        "math": "Output = [B, 0, 0]",
        "topic": "Topic 7: Colour Image Processing",
        "use_case": "Analysing colour balance; detecting cyanosis in clinical photography.",
        "clinical_context": "Blue channel isolation is used to detect cyanosis (blue skin discoloration indicating hypoxia) in clinical photography and to analyse contrast agent distribution in fluoroscopy. In X-ray AI workflows, examining individual Grad-CAM colour channels reveals which image features drive predictions for specific pathology classes.",
        "use_in_pipeline": "analysis",
    },
    "pseudocolor": {
        "name": "Pseudo-colour (Jet)",
        "description": "Maps grayscale intensities to a perceptually distinct colour map (COLORMAP_JET).",
        "math": "Jet LUT: Blue→Cyan→Green→Yellow→Red over [0,255]",
        "topic": "Topic 7: Colour Image Processing",
        "use_case": "Enhancing perceptual differentiation of intensity levels in medical scans.",
        "clinical_context": "Pseudo-colour mapping enhances the perceptual contrast between tissue densities that appear as similar grey tones to the human eye. Used in nuclear medicine (PET/SPECT scans) and bone density mapping. Applied to chest X-rays, the Jet colourmap can reveal subtle density gradients across the lung fields that indicate early-stage oedema or infiltrative processes — differences of only a few Hounsfield units become visually distinct.",
        "use_in_pipeline": "analysis",
    },
    "add_gaussian_noise": {
        "name": "Add Gaussian Noise",
        "description": "Adds zero-mean Gaussian noise — models thermal/electronic sensor noise.",
        "math": "I_noisy(x,y) = I(x,y) + η,  η ~ N(0, σ²)",
        "topic": "Topic 6: Image Restoration",
        "use_case": "Simulating acquisition noise; testing denoising algorithms.",
        "clinical_context": "Gaussian noise addition is used for data augmentation in training robust medical AI models. By synthetically degrading clean images, the model learns to identify pathologies even in noisy acquisitions from low-dose or portable X-ray systems. CheXNet and similar models trained with noise augmentation show better generalisation to real-world clinical images from diverse acquisition settings.",
        "use_in_pipeline": "preprocessing",
    },
    "add_salt_pepper": {
        "name": "Salt & Pepper Noise",
        "description": "Randomly sets pixels to 0 (pepper) or 255 (salt) — models impulse/transmission errors.",
        "math": "P(I=0) = P(I=255) = d/2,  d = noise density",
        "topic": "Topic 6: Image Restoration",
        "use_case": "Simulating bit-error noise; motivating use of median filter.",
        "clinical_context": "Salt-and-pepper noise models flat-panel detector element failures (dead pixels/rows) and digital transmission bit errors. Adding this noise type during training produces models robust to detector artefacts common in portable and ageing hospital X-ray equipment. This demonstrates why median blur (rather than Gaussian blur) is specifically required to remove this type of noise without destroying edge information.",
        "use_in_pipeline": "preprocessing",
    },
    "wiener_approx": {
        "name": "Wiener Filter (Approx.)",
        "description": "Approximation: bilateral denoising followed by mild sharpening to simulate Wiener restoration.",
        "math": "W(u,v) = H*(u,v) / (|H(u,v)|² + Sn/Ss)",
        "topic": "Topic 6: Image Restoration",
        "use_case": "Noise reduction while restoring blurred structures; used in MRI/CT post-processing.",
        "clinical_context": "Wiener filtering minimises mean squared error between the restored and original image — theoretically optimal for Gaussian noise and linear blur. Used in MRI and CT post-processing to sharpen images blurred by patient motion or reconstruction kernels. In X-ray workflows, this approximation (bilateral + sharpening) provides a practical balance between noise suppression and structure preservation before AI inference.",
        "use_in_pipeline": "preprocessing",
    },
    "erosion": {
        "name": "Erosion",
        "description": "Morphological operation that shrinks bright regions by taking the local minimum.",
        "math": "(I ⊖ B)(x,y) = min{ I(x+i,y+j) : (i,j) ∈ B }",
        "topic": "Topic 8: Morphological Processing",
        "use_case": "Removing small bright noise, separating touching objects.",
        "clinical_context": "Morphological erosion shrinks bright regions in segmentation masks, eliminating small bright artefacts and separating structures that are falsely merged by over-dilation. Used in lung segmentation post-processing to remove mis-classified bright regions (ribs, mediastinum) that contaminate the lung field mask. Critical preprocessing step before measuring lung volumes, density histograms, or pathology area for quantitative radiology.",
        "use_in_pipeline": "segmentation",
    },
    "dilation": {
        "name": "Dilation",
        "description": "Morphological operation that expands bright regions by taking the local maximum.",
        "math": "(I ⊕ B)(x,y) = max{ I(x+i,y+j) : (i,j) ∈ B }",
        "topic": "Topic 8: Morphological Processing",
        "use_case": "Filling small holes, connecting broken edges in segmentation masks.",
        "clinical_context": "Morphological dilation fills small holes and gaps in lung segmentation masks caused by blood vessels and airways appearing as dark inclusions inside the bright lung field. Essential for producing complete, watertight lung contours used in automated cardiothoracic ratio measurement, pneumothorax quantification, and pleural effusion volume estimation in AI-assisted radiology workflows.",
        "use_in_pipeline": "segmentation",
    },
    "opening": {
        "name": "Opening",
        "description": "Erosion followed by dilation — removes small bright objects without changing larger structures.",
        "math": "I ∘ B = (I ⊖ B) ⊕ B",
        "topic": "Topic 8: Morphological Processing",
        "use_case": "Removing noise speckles, smoothing object contours.",
        "clinical_context": "Morphological opening (erosion then dilation) removes small bright objects while preserving larger lung structures unchanged. Standard operation for cleaning AI-generated lung segmentation masks — eliminates mis-classified rib fragments, scattered noise pixels, and small artefacts that inflate lung volume measurements. Used in post-processing pipelines for CXR-based lung volumetry and pathology area quantification.",
        "use_in_pipeline": "segmentation",
    },
    "closing": {
        "name": "Closing",
        "description": "Dilation followed by erosion — fills small dark holes inside bright objects.",
        "math": "I • B = (I ⊕ B) ⊖ B",
        "topic": "Topic 8: Morphological Processing",
        "use_case": "Filling gaps in lung contours, smoothing regions of interest.",
        "clinical_context": "Morphological closing (dilation then erosion) fills small dark holes inside bright segmented regions while preserving overall shape. Used to produce smooth, complete lung contours by filling inter-rib space gaps and vessel dark inclusions in segmentation outputs. Essential for accurate pleural effusion detection (filling the costophrenic angle region) and pneumothorax measurement (completing the collapsed lung boundary).",
        "use_in_pipeline": "segmentation",
    },
    "morphological_gradient": {
        "name": "Morphological Gradient",
        "description": "Difference between dilation and erosion — highlights object boundaries.",
        "math": "G = (I ⊕ B) − (I ⊖ B)",
        "topic": "Topic 8: Morphological Processing",
        "use_case": "Edge-like boundary detection for segmented structures.",
        "clinical_context": "The morphological gradient produces a precise one-pixel-wide boundary map of segmented anatomical structures. Used to extract exact lung borders, lesion contours, and cardiac silhouette outlines after coarse segmentation — enabling precise perimeter measurement and shape analysis. Key for computing circularity metrics that distinguish benign rounded nodules from irregular malignant masses.",
        "use_in_pipeline": "segmentation",
    },
    "top_hat": {
        "name": "Top Hat",
        "description": "Difference between the original and its morphological opening — highlights small bright features.",
        "math": "T = I − (I ∘ B)",
        "topic": "Topic 8: Morphological Processing",
        "use_case": "Detecting small bright lesions or nodules against a varying background.",
        "clinical_context": "Top-hat transform isolates small bright structures that are smaller than the structuring element against a varying background — directly applicable to pulmonary nodule and calcification detection. By subtracting the opened image (which removes small features), only small bright objects remain visible. Used in CAD (Computer-Aided Detection) pre-processing to generate candidate nodule locations before CNN classification.",
        "use_in_pipeline": "segmentation",
    },
    "black_hat": {
        "name": "Black Hat",
        "description": "Difference between the morphological closing and the original — highlights small dark features.",
        "math": "B = (I • B) − I",
        "topic": "Topic 8: Morphological Processing",
        "use_case": "Detecting dark structures (vessels, airways) within brighter tissue.",
        "clinical_context": "Black-hat transform reveals small dark structures within brighter tissue — pulmonary vessels, bronchi, airways, and dark linear structures like pleural fissures. Applied to chest X-rays, it highlights the vascular tree pattern, which is altered in pulmonary hypertension, oedema (increased vascular markings), and pulmonary embolism (decreased peripheral vascularity — Westermark sign).",
        "use_in_pipeline": "segmentation",
    },
}

# ---------------------------------------------------------------------------
# Image I/O helpers
# ---------------------------------------------------------------------------


def _encode(img: np.ndarray) -> str:
    _, buf = cv2.imencode(".png", img)
    return f"data:image/png;base64,{base64.b64encode(buf).decode()}"


def _load(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode image.")
    return img


# ---------------------------------------------------------------------------
# Spatial filters
# ---------------------------------------------------------------------------


def _odd(v: int, lo: int = 3, hi: int = 21) -> int:
    v = int(v)
    if v % 2 == 0:
        v += 1
    return max(lo, min(hi, v))


def _gaussian_blur(img, p):
    ks = _odd(p.get("kernel_size", 5))
    sigma = float(p.get("sigma", 0))
    return cv2.GaussianBlur(img, (ks, ks), sigma)


def _mean_blur(img, p):
    ks = _odd(p.get("kernel_size", 5))
    return cv2.blur(img, (ks, ks))


def _median_blur(img, p):
    ks = _odd(p.get("kernel_size", 5))
    return cv2.medianBlur(img, ks)


def _sharpening(img, p):
    strength = float(p.get("intensity", 1.0))
    center = 1.0 + 4.0 * strength
    kernel = np.array(
        [[0, -strength, 0], [-strength, center, -strength], [0, -strength, 0]],
        dtype=np.float32,
    )
    result = cv2.filter2D(img, -1, kernel)
    return np.clip(result, 0, 255).astype(np.uint8)


def _bilateral(img, p):
    d = int(p.get("d", 9))
    sc = float(p.get("sigma_color", 75))
    ss = float(p.get("sigma_space", 75))
    return cv2.bilateralFilter(img, d, sc, ss)


# ---------------------------------------------------------------------------
# Edge detection
# ---------------------------------------------------------------------------


def _sobel_x(img, p):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    out = cv2.convertScaleAbs(cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3))
    return cv2.cvtColor(out, cv2.COLOR_GRAY2BGR)


def _sobel_y(img, p):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    out = cv2.convertScaleAbs(cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3))
    return cv2.cvtColor(out, cv2.COLOR_GRAY2BGR)


def _sobel_combined(img, p):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    mag = cv2.convertScaleAbs(np.sqrt(gx ** 2 + gy ** 2))
    return cv2.cvtColor(mag, cv2.COLOR_GRAY2BGR)


def _laplacian(img, p):
    ks = _odd(p.get("kernel_size", 3), lo=1, hi=31)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    out = cv2.convertScaleAbs(cv2.Laplacian(gray, cv2.CV_64F, ksize=ks))
    return cv2.cvtColor(out, cv2.COLOR_GRAY2BGR)


def _laplacian_gaussian(img, p):
    ks = _odd(p.get("kernel_size", 5))
    sigma = float(p.get("sigma", 1.0))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (ks, ks), sigma)
    out = cv2.convertScaleAbs(cv2.Laplacian(blurred, cv2.CV_64F))
    return cv2.cvtColor(out, cv2.COLOR_GRAY2BGR)


def _canny(img, p):
    t1 = float(p.get("threshold1", 100))
    t2 = float(p.get("threshold2", 200))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, t1, t2)
    return cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)


# ---------------------------------------------------------------------------
# Frequency domain
# ---------------------------------------------------------------------------


def _fft_lowpass(img, p):
    cutoff = float(p.get("cutoff_radius", 30))
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    fshift = np.fft.fftshift(np.fft.fft2(gray))
    cy, cx = h // 2, w // 2
    y, x = np.ogrid[-cy : h - cy, -cx : w - cx]
    mask = (np.sqrt(x * x + y * y) <= cutoff).astype(np.float32)
    result = np.clip(
        np.abs(np.fft.ifft2(np.fft.ifftshift(fshift * mask))), 0, 255
    ).astype(np.uint8)
    return cv2.cvtColor(result, cv2.COLOR_GRAY2BGR)


def _fft_highpass(img, p):
    cutoff = float(p.get("cutoff_radius", 30))
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    fshift = np.fft.fftshift(np.fft.fft2(gray))
    cy, cx = h // 2, w // 2
    y, x = np.ogrid[-cy : h - cy, -cx : w - cx]
    mask = (np.sqrt(x * x + y * y) > cutoff).astype(np.float32)
    result = np.clip(
        np.abs(np.fft.ifft2(np.fft.ifftshift(fshift * mask))), 0, 255
    ).astype(np.uint8)
    return cv2.cvtColor(result, cv2.COLOR_GRAY2BGR)


def _fft_bandpass(img, p):
    lo = float(p.get("low_cutoff", 10))
    hi = float(p.get("high_cutoff", 60))
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    fshift = np.fft.fftshift(np.fft.fft2(gray))
    cy, cx = h // 2, w // 2
    y, x = np.ogrid[-cy : h - cy, -cx : w - cx]
    r = np.sqrt(x * x + y * y)
    mask = ((r >= lo) & (r <= hi)).astype(np.float32)
    result = np.clip(
        np.abs(np.fft.ifft2(np.fft.ifftshift(fshift * mask))), 0, 255
    ).astype(np.uint8)
    return cv2.cvtColor(result, cv2.COLOR_GRAY2BGR)


def _fft_spectrum(img, p):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    fshift = np.fft.fftshift(np.fft.fft2(gray))
    mag = np.log(np.abs(fshift) + 1)
    mag = cv2.normalize(mag, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    return cv2.applyColorMap(mag, cv2.COLORMAP_INFERNO)


# ---------------------------------------------------------------------------
# Intensity / histogram
# ---------------------------------------------------------------------------


def _histogram_eq(img, p):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return cv2.cvtColor(cv2.equalizeHist(gray), cv2.COLOR_GRAY2BGR)


def _clahe(img, p):
    clip = float(p.get("clip_limit", 2.0))
    tile = int(p.get("tile_size", 8))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe_obj = cv2.createCLAHE(clipLimit=clip, tileGridSize=(tile, tile))
    return cv2.cvtColor(clahe_obj.apply(gray), cv2.COLOR_GRAY2BGR)


def _gamma_correction(img, p):
    gamma = max(float(p.get("gamma", 1.0)), 0.01)
    table = np.array(
        [((i / 255.0) ** (1.0 / gamma)) * 255 for i in range(256)], dtype=np.uint8
    )
    return cv2.LUT(img, table)


def _log_transform(img, p):
    fimg = img.astype(np.float32)
    max_val = np.max(fimg)
    c = 255.0 / (np.log(1.0 + max_val) if max_val > 0 else 1.0)
    result = c * np.log(1.0 + fimg)
    return np.clip(result, 0, 255).astype(np.uint8)


def _negative(img, p):
    return 255 - img


# ---------------------------------------------------------------------------
# Colour processing
# ---------------------------------------------------------------------------


def _grayscale(img, p):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)


def _channel_red(img, p):
    out = np.zeros_like(img)
    out[:, :, 2] = img[:, :, 2]
    return out


def _channel_green(img, p):
    out = np.zeros_like(img)
    out[:, :, 1] = img[:, :, 1]
    return out


def _channel_blue(img, p):
    out = np.zeros_like(img)
    out[:, :, 0] = img[:, :, 0]
    return out


def _pseudocolor(img, p):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return cv2.applyColorMap(gray, cv2.COLORMAP_JET)


# ---------------------------------------------------------------------------
# Restoration / noise
# ---------------------------------------------------------------------------


def _add_gaussian_noise(img, p):
    std = float(p.get("std", 25))
    noise = np.random.normal(0, std, img.shape).astype(np.float32)
    return np.clip(img.astype(np.float32) + noise, 0, 255).astype(np.uint8)


def _add_salt_pepper(img, p):
    density = float(p.get("density", 0.05))
    out = img.copy()
    n = max(1, int(density * img.shape[0] * img.shape[1]))
    ys = np.random.randint(0, img.shape[0], n)
    xs = np.random.randint(0, img.shape[1], n)
    out[ys, xs] = 255
    ys = np.random.randint(0, img.shape[0], n)
    xs = np.random.randint(0, img.shape[1], n)
    out[ys, xs] = 0
    return out


def _wiener_approx(img, p):
    bi = cv2.bilateralFilter(img, 9, 75, 75)
    kernel = np.array(
        [[0, -0.5, 0], [-0.5, 3.0, -0.5], [0, -0.5, 0]], dtype=np.float32
    )
    return np.clip(cv2.filter2D(bi, -1, kernel), 0, 255).astype(np.uint8)


# ---------------------------------------------------------------------------
# Morphological
# ---------------------------------------------------------------------------


def _struct(p, lo=3, hi=21):
    ks = _odd(p.get("kernel_size", 5), lo=lo, hi=hi)
    return cv2.getStructuringElement(cv2.MORPH_RECT, (ks, ks))


def _erosion(img, p):
    iters = max(1, int(p.get("iterations", 1)))
    return cv2.erode(img, _struct(p), iterations=iters)


def _dilation(img, p):
    iters = max(1, int(p.get("iterations", 1)))
    return cv2.dilate(img, _struct(p), iterations=iters)


def _opening(img, p):
    return cv2.morphologyEx(img, cv2.MORPH_OPEN, _struct(p))


def _closing(img, p):
    return cv2.morphologyEx(img, cv2.MORPH_CLOSE, _struct(p))


def _morphological_gradient(img, p):
    return cv2.morphologyEx(img, cv2.MORPH_GRADIENT, _struct(p))


def _top_hat(img, p):
    return cv2.morphologyEx(img, cv2.MORPH_TOPHAT, _struct(p, hi=51))


def _black_hat(img, p):
    return cv2.morphologyEx(img, cv2.MORPH_BLACKHAT, _struct(p, hi=51))


# ---------------------------------------------------------------------------
# Dispatch table
# ---------------------------------------------------------------------------

DISPATCH = {
    "gaussian_blur": _gaussian_blur,
    "mean_blur": _mean_blur,
    "median_blur": _median_blur,
    "sharpening": _sharpening,
    "bilateral": _bilateral,
    "sobel_x": _sobel_x,
    "sobel_y": _sobel_y,
    "sobel_combined": _sobel_combined,
    "laplacian": _laplacian,
    "laplacian_gaussian": _laplacian_gaussian,
    "canny": _canny,
    "fft_lowpass": _fft_lowpass,
    "fft_highpass": _fft_highpass,
    "fft_bandpass": _fft_bandpass,
    "fft_spectrum": _fft_spectrum,
    "histogram_eq": _histogram_eq,
    "clahe": _clahe,
    "gamma_correction": _gamma_correction,
    "log_transform": _log_transform,
    "negative": _negative,
    "grayscale": _grayscale,
    "channel_red": _channel_red,
    "channel_green": _channel_green,
    "channel_blue": _channel_blue,
    "pseudocolor": _pseudocolor,
    "add_gaussian_noise": _add_gaussian_noise,
    "add_salt_pepper": _add_salt_pepper,
    "wiener_approx": _wiener_approx,
    "erosion": _erosion,
    "dilation": _dilation,
    "opening": _opening,
    "closing": _closing,
    "morphological_gradient": _morphological_gradient,
    "top_hat": _top_hat,
    "black_hat": _black_hat,
}

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/apply")
async def apply_filter(
    file: UploadFile = File(...),
    filter_type: str = Form(...),
    params: str = Form("{}"),
):
    if filter_type not in DISPATCH:
        raise HTTPException(status_code=400, detail=f"Unknown filter: {filter_type}")
    try:
        params_dict = json.loads(params)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="params must be valid JSON.")

    img = _load(await file.read())

    try:
        result = DISPATCH[filter_type](img, params_dict)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Filter error: {exc}")

    info = FILTER_INFO.get(filter_type, {})
    return JSONResponse(
        {
            "filtered_image": _encode(result),
            "filter_name": info.get("name", filter_type),
            "description": info.get("description", ""),
            "math": info.get("math", ""),
            "topic": info.get("topic", ""),
            "use_case": info.get("use_case", ""),
            "clinical_context": info.get("clinical_context", ""),
            "use_in_pipeline": info.get("use_in_pipeline", "analysis"),
        }
    )


@router.post("/apply-chain")
async def apply_filter_chain(
    file: UploadFile = File(...),
    filters: str = Form(...),
):
    """Apply an ordered list of filters sequentially, returning each intermediate image."""
    try:
        filter_steps = json.loads(filters)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="filters must be valid JSON.")

    if not filter_steps:
        raise HTTPException(status_code=400, detail="No filters specified.")

    img = _load(await file.read())
    steps_result = []
    current_img = img

    for i, step in enumerate(filter_steps):
        filter_type = step.get("filter_type", "")
        params_dict = step.get("params", {})

        if filter_type not in DISPATCH:
            raise HTTPException(status_code=400, detail=f"Unknown filter at step {i + 1}: {filter_type}")

        try:
            current_img = DISPATCH[filter_type](current_img, params_dict)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Step {i + 1} ({filter_type}) error: {exc}")

        info = FILTER_INFO.get(filter_type, {})
        steps_result.append(
            {
                "step": i + 1,
                "filter_name": info.get("name", filter_type),
                "filter_type": filter_type,
                "image": _encode(current_img),
                "clinical_context": info.get("clinical_context", ""),
                "topic": info.get("topic", ""),
                "use_in_pipeline": info.get("use_in_pipeline", "analysis"),
            }
        )

    return JSONResponse(
        {
            "final_image": _encode(current_img),
            "steps": steps_result,
            "total_steps": len(steps_result),
        }
    )


@router.get("/sample")
def get_sample_image():
    """Return a synthetic chest-X-ray-like grayscale test image."""
    h, w = 420, 420
    canvas = np.full((h, w, 3), 18, dtype=np.uint8)

    # Ribcage arcs
    for i in range(7):
        y = 90 + i * 42
        cv2.ellipse(canvas, (210, y), (168, 16), 0, 0, 180, (130, 130, 130), 2)
        cv2.ellipse(canvas, (210, y), (168, 16), 0, 180, 360, (110, 110, 110), 2)

    # Spine
    cv2.line(canvas, (210, 55), (210, 365), (95, 95, 95), 10)

    # Lung fields
    cv2.ellipse(canvas, (145, 215), (85, 135), 0, 0, 360, (55, 55, 55), -1)
    cv2.ellipse(canvas, (275, 215), (85, 135), 0, 0, 360, (55, 55, 55), -1)

    # Heart
    cv2.ellipse(canvas, (200, 235), (55, 65), 12, 0, 360, (78, 78, 78), -1)

    # Diaphragm
    cv2.ellipse(canvas, (210, 355), (170, 40), 0, 0, 180, (100, 100, 100), 3)

    # Clavicles
    cv2.line(canvas, (50, 85), (200, 110), (105, 105, 105), 4)
    cv2.line(canvas, (370, 85), (220, 110), (105, 105, 105), 4)

    # Subtle texture
    rng = np.random.default_rng(42)
    noise = rng.normal(0, 7, canvas.shape).astype(np.float32)
    canvas = np.clip(canvas.astype(np.float32) + noise, 0, 255).astype(np.uint8)

    _, buf = cv2.imencode(".png", canvas)
    b64 = base64.b64encode(buf).decode()
    return JSONResponse({"image": f"data:image/png;base64,{b64}"})
