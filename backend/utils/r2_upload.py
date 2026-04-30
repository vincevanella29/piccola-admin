import os
import io
import re
import logging
import boto3
import botocore
from typing import BinaryIO
from datetime import datetime

logger = logging.getLogger(__name__)

# Thumbnail config — 400px is plenty for grid cards (display at 165-250px)
THUMB_WIDTH = 400
THUMB_QUALITY = 80
_IMG_EXTS = {'.webp', '.jpg', '.jpeg', '.png'}


def _get_s3_client():
    """Shared S3 client factory."""
    session = boto3.session.Session()
    return session.client(
        service_name='s3',
        aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
        endpoint_url=os.getenv('R2_ENDPOINT_URL'),
    )


def _generate_and_upload_thumb(s3, bucket: str, key: str, original_bytes: bytes):
    """
    Generate a 400px-wide WebP thumbnail and upload to R2 as {name}_thumb.webp.
    Runs silently — errors are logged but never block the original upload.
    """
    try:
        from PIL import Image

        # Derive thumb key: menu_images/pizza.webp → menu_images/pizza_thumb.webp
        match = re.match(r'^(.+)(\.\w+)$', key)
        if not match:
            return
        thumb_key = f"{match.group(1)}_thumb.webp"

        img = Image.open(io.BytesIO(original_bytes))
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGBA')
        else:
            img = img.convert('RGB')

        # Only resize if wider than THUMB_WIDTH
        if img.width > THUMB_WIDTH:
            ratio = THUMB_WIDTH / img.width
            new_h = int(img.height * ratio)
            img = img.resize((THUMB_WIDTH, new_h), Image.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, format='WEBP', quality=THUMB_QUALITY, method=4)
        buf.seek(0)
        thumb_size = buf.tell()
        buf.seek(0)

        s3.upload_fileobj(
            Fileobj=buf,
            Bucket=bucket,
            Key=thumb_key,
            ExtraArgs={
                'ContentType': 'image/webp',
                'CacheControl': 'public, max-age=31536000, immutable',
                'ACL': 'public-read',
            },
        )
        logger.info(f"[r2] Thumbnail generated: {thumb_key} ({thumb_size / 1024:.0f}KB)")
    except ImportError:
        logger.debug("[r2] Pillow not installed — skipping thumbnail generation")
    except Exception as e:
        logger.warning(f"[r2] Thumbnail generation failed for {key}: {e}")


def upload_to_r2(file_obj: BinaryIO, key: str, content_type: str = 'application/octet-stream', public: bool = True, cache_max_age: int = None) -> str:
    """
    Subir un archivo genérico a Cloudflare R2 con una clave (key) arbitraria y devolver la URL CDN.

    For images: also generates and uploads a 400px-wide _thumb.webp variant
    for use in grid/card views. This eliminates the need for Cloudflare Image
    Resizing ($0.50/1000 transforms) while keeping the grid blazing fast.

    cache_max_age: override Cache-Control max-age in seconds.
                   Default: 1 year for images/video, 1 day for other types.
    """
    s3 = _get_s3_client()
    bucket = os.getenv('R2_BUCKET_NAME')
    cdn_base = os.getenv('R2_CDN_BASE').rstrip('/')

    # ── Determine cache policy ────────────────────────────────────────
    ct = (content_type or '').lower()
    is_image = ct.startswith('image/')
    is_media = is_image or ct.startswith('video/')
    if cache_max_age is not None:
        max_age = cache_max_age
    elif is_media:
        max_age = 31536000   # 1 year — URLs are busted via ?v= when content changes
    else:
        max_age = 86400      # 1 day — safe default for non-media

    cache_control = f"public, max-age={max_age}"
    if is_media:
        cache_control += ", immutable"

    try:
        # Read file bytes so we can both upload original AND generate thumbnail
        file_bytes = file_obj.read()
        file_obj_copy = io.BytesIO(file_bytes)

        extra_args = {
            'ContentType': content_type or 'application/octet-stream',
            'CacheControl': cache_control,
        }
        if public:
            extra_args['ACL'] = 'public-read'
        s3.upload_fileobj(
            Fileobj=file_obj_copy,
            Bucket=bucket,
            Key=key,
            ExtraArgs=extra_args,
        )

        # ── Auto-generate thumbnail for images ──
        if is_image and any(key.lower().endswith(ext) for ext in _IMG_EXTS):
            _generate_and_upload_thumb(s3, bucket, key, file_bytes)

        return f"{cdn_base}/{key}"
    except botocore.exceptions.ClientError as e:
        raise RuntimeError(f"Error subiendo archivo a R2: {e}")

def upload_profile_image_to_r2(file_obj: BinaryIO, filename: str) -> str:
    """
    Sube un archivo (BinaryIO) a Cloudflare R2 y devuelve la URL CDN.
    """
    # Mantener compatibilidad con llamadas existentes (asume JPEG)
    return upload_to_r2(file_obj=file_obj, key=filename, content_type='image/jpeg', public=True)
