import os
import boto3
import botocore
from typing import BinaryIO
from datetime import datetime

def upload_to_r2(file_obj: BinaryIO, key: str, content_type: str = 'application/octet-stream', public: bool = True, cache_max_age: int = None) -> str:
    """
    Subir un archivo genérico a Cloudflare R2 con una clave (key) arbitraria y devolver la URL CDN.

    cache_max_age: override Cache-Control max-age in seconds.
                   Default: 1 year for images/video, 1 day for other types.
    """
    session = boto3.session.Session()
    s3 = session.client(
        service_name='s3',
        aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
        endpoint_url=os.getenv('R2_ENDPOINT_URL'),
    )
    bucket = os.getenv('R2_BUCKET_NAME')
    cdn_base = os.getenv('R2_CDN_BASE').rstrip('/')

    # ── Determine cache policy ────────────────────────────────────────
    ct = (content_type or '').lower()
    is_media = ct.startswith('image/') or ct.startswith('video/')
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
        extra_args = {
            'ContentType': content_type or 'application/octet-stream',
            'CacheControl': cache_control,
        }
        if public:
            extra_args['ACL'] = 'public-read'
        s3.upload_fileobj(
            Fileobj=file_obj,
            Bucket=bucket,
            Key=key,
            ExtraArgs=extra_args,
        )
        return f"{cdn_base}/{key}"
    except botocore.exceptions.ClientError as e:
        raise RuntimeError(f"Error subiendo archivo a R2: {e}")

def upload_profile_image_to_r2(file_obj: BinaryIO, filename: str) -> str:
    """
    Sube un archivo (BinaryIO) a Cloudflare R2 y devuelve la URL CDN.
    """
    # Mantener compatibilidad con llamadas existentes (asume JPEG)
    return upload_to_r2(file_obj=file_obj, key=filename, content_type='image/jpeg', public=True)
