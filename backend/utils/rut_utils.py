# utils/rut_utils.py
import re

def clean_rut(value: str) -> str:
    """Elimina todos los caracteres excepto 0-9 y K/k y lo convierte a mayúsculas."""
    return re.sub(r'[^0-9kK]', '', str(value)).upper()

def compute_dv(num_str: str) -> str:
    """
    Calcula el dígito verificador para un número de RUT.
    Implementación estándar Módulo 11.
    """
    if not num_str.isdigit():
        return ''
    sum_ = 0
    mul = 2
    for i in range(len(num_str) - 1, -1, -1):
        sum_ += int(num_str[i]) * mul
        mul = 2 if mul == 7 else mul + 1
    remainder = 11 - (sum_ % 11)
    if remainder == 11:
        return '0'
    if remainder == 10:
        return 'K'
    return str(remainder)

def is_valid_rut(value: str) -> bool:
    """Valida un RUT completo (número + DV)."""
    cleaned = clean_rut(value)
    if len(cleaned) < 2:
        return False
    dv = cleaned[-1]
    num = cleaned[:-1]
    return compute_dv(num) == dv

def is_plausible_rut_number(rut_number_str: str) -> bool:
    """Valida que un string sea un NÚMERO de RUT plausible (SIN DV)."""
    try:
        rut_num = int(rut_number_str)
        return 1_000_000 < rut_num < 50_000_000
    except (ValueError, TypeError):
        return False

# -----------------------------
# NUEVO: helpers de normalización
# -----------------------------

def parse_and_normalize_rut(value: str):
    """
    Acepta entradas con o sin DV y retorna una tupla normalizada:
    (rut_num_str, rut_dv, rut_full, is_valid, is_plausible)
    - Si viene sin DV pero es plausible, calcula el DV.
    - Si viene con DV, lo valida.
    """
    cleaned = clean_rut(value)
    if not cleaned:
        return None, None, None, False, False

    # Caso 1: solo números (sin DV)
    if cleaned.isdigit():
        if not is_plausible_rut_number(cleaned):
            return cleaned, None, None, False, False
        dv = compute_dv(cleaned)
        full = f"{cleaned}-{dv}"
        return cleaned, dv, full, True, True

    # Caso 2: viene con DV (último char puede ser K/0-9)
    if len(cleaned) >= 2 and cleaned[:-1].isdigit():
        num = cleaned[:-1]
        dv = cleaned[-1]
        plausible = is_plausible_rut_number(num)
        valid = plausible and compute_dv(num) == dv
        full = f"{num}-{dv}" if valid else None
        return num, dv, full, valid, plausible

    return None, None, None, False, False

def rut_search_variants(value: str):
    """
    Retorna variantes útiles para queries en BD.
    Incluye: num, full con guión, num como int.
    """
    num, dv, full, valid, plausible = parse_and_normalize_rut(value)
    variants = []
    if num:
        variants.append(num)             # "18083375"
        variants.append(int(num))        # 18083375
    if full:
        variants.append(full)            # "18083375-2"
    # También sin guión si lo guardaron así
    if num and dv:
        variants.append(f"{num}{dv}")    # "180833752"
    return variants, (num, dv, full, valid, plausible)
