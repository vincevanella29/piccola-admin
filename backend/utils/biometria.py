import logging

import cv2
import numpy as np
from insightface.app import FaceAnalysis

logger = logging.getLogger(__name__)

# --- CONFIGURACIÓN DEL MOTOR (Singleton) ---
# providers=['CPUExecutionProvider'] asegura que corra en VPS y Mac sin GPU.
# det_size=(640, 640): Tamaño de análisis. 640 es rápido y preciso.
biometric_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
biometric_app.prepare(ctx_id=0, det_size=(640, 640))


def get_secure_face_embedding(image_bytes: bytes):
    """Analiza una imagen y extrae el vector biométrico del rostro principal.

    Retorna: (embedding [list] | None, error [str] | None, face_info [dict] | None)
    """
    try:
        # 1. Decodificar imagen
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return None, "La imagen está corrupta o no es válida.", None

        # 2. Inferencia InsightFace
        faces = biometric_app.get(img)
        if not faces:
            return None, "No se detectó ningún rostro en la imagen.", None

        # 3. Seleccionar rostro principal (el más grande por área)
        primary_face = sorted(
            faces,
            key=lambda x: (x.bbox[2] - x.bbox[0]) * (x.bbox[3] - x.bbox[1]),
        )[-1]

        # 4. Control de Calidad (Anti-Spoofing Básico por Confianza)
        if primary_face.det_score < 0.60:
            logger.warning("Calidad de rostro baja: %s", primary_face.det_score)
            return None, "La calidad del rostro es insuficiente. Asegúrate de tener buena luz.", None

        return primary_face.embedding.tolist(), None, {
            "bbox": primary_face.bbox.tolist(),
            "det_score": float(primary_face.det_score),
            "age": primary_face.age,
            "gender": "M" if primary_face.sex == 1 else "F",
        }

    except Exception as e:
        logger.error("Error crítico en biometría: %s", e)
        return None, "Error interno procesando biometría.", None


def compare_faces_cosine(vec1: list, vec2: list) -> float:
    """Compara dos embeddings con similitud coseno (-1.0 a 1.0)."""
    if not vec1 or not vec2:
        return 0.0

    a = np.array(vec1, dtype=np.float32)
    b = np.array(vec2, dtype=np.float32)

    dot_product = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return float(dot_product / (norm_a * norm_b))


def is_match_secure(score: float, threshold: float = 0.40) -> bool:
    """Determina si hay match biométrico según umbral de ArcFace."""
    return score >= threshold
