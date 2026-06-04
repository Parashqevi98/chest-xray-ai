import io
import base64
import numpy as np
import cv2
from PIL import Image
import tensorflow as tf


def load_model(model_path: str):
    model = tf.keras.models.load_model(model_path, compile=False)
    model.trainable = False
    return model


def preprocess_image(image_bytes: bytes, target_size=(224, 224)):
    image = Image.open(io.BytesIO(image_bytes))
    if image.mode != "RGB":
        image = image.convert("RGB")

    original_image = np.asarray(image, dtype=np.uint8)
    image = image.resize(target_size, Image.BILINEAR)
    image_array = np.asarray(image, dtype=np.float32) / 255.0
    image_array = np.expand_dims(image_array, axis=0)
    return image_array, np.asarray(image, dtype=np.uint8)


def predict(model, image_array):
    return model.predict(image_array)


def generate_all_gradcams(model, image_array, original_image, last_conv_layer_name="block5_conv3", alpha=0.45):
    grad_model = tf.keras.models.Model(
        inputs=model.inputs,
        outputs=[model.get_layer(last_conv_layer_name).output, model.output],
    )

    img = tf.cast(image_array, tf.float32)

    with tf.GradientTape(persistent=True) as tape:
        tape.watch(img)
        result = grad_model(img)
        conv_outputs = result[0]
        preds_raw = result[1]
        predictions = preds_raw[0] if isinstance(preds_raw, (list, tuple)) else preds_raw
        class_scores = tf.unstack(predictions, axis=1)

    h, w = original_image.shape[:2]
    original_bgr = cv2.cvtColor(original_image, cv2.COLOR_RGB2BGR)
    heatmaps = {}
    prob_list = predictions[0].numpy().tolist()

    for idx, class_score in enumerate(class_scores):
        grads = tape.gradient(class_score, conv_outputs)
        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
        heatmap = tf.reduce_sum(conv_outputs[0] * pooled_grads, axis=-1)
        heatmap = tf.maximum(heatmap, 0) / (tf.reduce_max(heatmap) + 1e-8)
        heatmap_np = np.uint8(255 * heatmap.numpy())
        heatmap_np = cv2.resize(heatmap_np, (w, h))
        heatmap_color = cv2.applyColorMap(heatmap_np, cv2.COLORMAP_JET)
        overlay_bgr = cv2.addWeighted(heatmap_color, alpha, original_bgr, 1 - alpha, 0)
        overlay_rgb = cv2.cvtColor(overlay_bgr, cv2.COLOR_BGR2RGB)
        _, buffer = cv2.imencode('.png', overlay_rgb)
        heatmaps[idx] = f"data:image/png;base64,{base64.b64encode(buffer).decode('utf-8')}"

    del tape
    return heatmaps, prob_list


def generate_gradcam(model, image_array, original_image, last_conv_layer_name="block5_conv3", alpha=0.45):
    grad_model = tf.keras.models.Model(
        inputs=model.inputs,
        outputs=[model.get_layer(last_conv_layer_name).output, model.output],
    )

    img = tf.cast(image_array, tf.float32)

    with tf.GradientTape() as tape:
        result = grad_model(img)
        # result[0]: conv output (1, H, W, C)
        # result[1]: model output — may be wrapped in a list by some Keras versions
        conv_outputs = result[0]
        preds_raw = result[1]
        predictions = preds_raw[0] if isinstance(preds_raw, (list, tuple)) else preds_raw
        # predictions: (1, num_classes)
        top_class_idx = int(np.argmax(predictions[0]))
        class_score = predictions[:, top_class_idx]

    grads = tape.gradient(class_score, conv_outputs)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
    heatmap = tf.reduce_sum(conv_outputs[0] * pooled_grads, axis=-1)
    heatmap = tf.maximum(heatmap, 0) / (tf.reduce_max(heatmap) + 1e-8)
    heatmap = heatmap.numpy()

    heatmap = np.uint8(255 * heatmap)
    heatmap = cv2.resize(heatmap, (original_image.shape[1], original_image.shape[0]))
    heatmap_color = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)

    original_bgr = cv2.cvtColor(original_image, cv2.COLOR_RGB2BGR)
    overlay_bgr = cv2.addWeighted(heatmap_color, alpha, original_bgr, 1 - alpha, 0)
    overlay_rgb = cv2.cvtColor(overlay_bgr, cv2.COLOR_BGR2RGB)

    _, buffer = cv2.imencode('.png', overlay_rgb)
    encoded = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/png;base64,{encoded}"
