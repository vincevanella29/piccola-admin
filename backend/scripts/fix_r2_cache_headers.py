"""
Bulk-update Cache-Control metadata on existing R2 objects.

Ejecución (en tu servidor o por CI donde estén las .env de prod):
    python scripts/fix_r2_cache_headers.py

Usa S3 COPY_OBJECT con MetadataDirective=REPLACE, así que solo sobreescribe 
los headers (no descarga ni re-sube el peso de la imagen). Es súper rápido.
"""

import os
import sys
import boto3
import botocore
from dotenv import load_dotenv

load_dotenv()

# ── Config ─────────────────────────────────────────────────────────────────
R2_ACCESS_KEY  = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_KEY  = os.getenv("R2_SECRET_ACCESS_KEY")
R2_ENDPOINT    = os.getenv("R2_ENDPOINT_URL")
R2_BUCKET      = os.getenv("R2_BUCKET_NAME")

# Agrega más prefijos si es necesario
PREFIXES = [
    "menu_images/",
    "carta/products/",
    "carta/videos/",
    "carta/ai_generated/",
]

# Set de Políticas de cache 
CACHE_POLICIES = {
    "image/": "public, max-age=31536000, immutable",
    "video/": "public, max-age=31536000, immutable",
}
DEFAULT_CACHE = "public, max-age=86400"

s3 = boto3.client(
    "s3",
    aws_access_key_id=R2_ACCESS_KEY,
    aws_secret_access_key=R2_SECRET_KEY,
    endpoint_url=R2_ENDPOINT,
)

def get_cache_control(content_type: str) -> str:
    ct = (content_type or "").lower()
    for prefix, policy in CACHE_POLICIES.items():
        if ct.startswith(prefix):
            return policy
    return DEFAULT_CACHE

def fix_object(key: str) -> bool:
    try:
        head = s3.head_object(Bucket=R2_BUCKET, Key=key)
    except botocore.exceptions.ClientError:
        return False

    current_cc = head.get("CacheControl", "")
    content_type = head.get("ContentType", "application/octet-stream")
    desired_cc = get_cache_control(content_type)

    # Si ya tiene el header correcto, lo saltamos
    if current_cc == desired_cc:
        return False

    # Actualizar metadata copiando el objeto sobre sí mismo (Súper rápido y seguro)
    s3.copy_object(
        Bucket=R2_BUCKET,
        Key=key,
        CopySource={"Bucket": R2_BUCKET, "Key": key},
        MetadataDirective="REPLACE",
        ContentType=content_type,
        CacheControl=desired_cc,
        ACL="public-read",
    )
    print(f"✅ Fix: {key} → {desired_cc}")
    return True

def main():
    print(f"\n🚀 Iniciando Fix de Cache Headers en R2 (Bucket: {R2_BUCKET})...\n")
    total = 0
    fixed = 0

    for prefix in PREFIXES:
        print(f"Scaneando prefijo: {prefix}")
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=R2_BUCKET, Prefix=prefix):
            for obj in page.get("Contents", []):
                total += 1
                if fix_object(obj["Key"]):
                    fixed += 1

    print("\n" + "="*50)
    print(f"🎉 COMPLETADO. Imágenes analizadas: {total} | Imágenes arregladas: {fixed}")
    print("="*50 + "\n")

if __name__ == "__main__":
    main()
