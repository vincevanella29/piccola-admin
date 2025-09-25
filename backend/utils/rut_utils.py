# utils/rut_utils.py

import re

def clean_rut(value: str) -> str:
    """Elimina todos los caracteres excepto 0-9 y K/k y lo convierte a mayúsculas."""
    return re.sub(r'[^0-9kK]', '', str(value)).upper()

def compute_dv(num_str: str) -> str:
    """
    Calcula el dígito verificador para un número de RUT.
    Esta es la implementación estándar del algoritmo Módulo 11.
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
    """
    **Valida un RUT completo (número + DV).**
    Útil para validar inputs de un formulario, por ejemplo: '11.222.333-K'.
    """
    cleaned = clean_rut(value)
    if len(cleaned) < 2:
        return False
    dv = cleaned[-1]
    num = cleaned[:-1]
    return compute_dv(num) == dv

def is_plausible_rut_number(rut_number_str: str) -> bool:
    """
    **Valida que un string sea un NÚMERO de RUT plausible (SIN DV).**
    Esta es la función que debes usar en tu worker para filtrar RUTs como "0" o inválidos.
    """
    try:
        # Verifica que sea un string de solo números y que esté en un rango lógico.
        rut_num = int(rut_number_str)
        return 1_000_000 < rut_num < 50_000_000
    except (ValueError, TypeError):
        # Si no se puede convertir a número, no es plausible.
        return False