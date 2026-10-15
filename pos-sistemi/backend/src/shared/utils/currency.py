"""
Currency & Financial Precision Utility
Finansal yuvarlama ve ondalik hassasiyet fonksiyonlari (Issue H4)
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Union, Optional

CENT = Decimal('0.01')


def to_decimal(val: Optional[Union[float, int, str, Decimal]]) -> Decimal:
    """Float veya str degeri guvenli bicimde Decimal('0.01') hassasiyetine cevirir."""
    if val is None:
        return Decimal('0.00')
    try:
        return Decimal(str(val)).quantize(CENT, rounding=ROUND_HALF_UP)
    except Exception:
        return Decimal('0.00')


def round_money(val: Optional[Union[float, int, str, Decimal]], decimals: int = 2) -> float:
    """
    Parasal degerleri standart muhasebe kuralina (ROUND_HALF_UP) gore yuvarlar
    ve IEEE-754 kayan nokta artiklarini engeller.
    """
    if val is None:
        return 0.0
    try:
        d = Decimal(str(val))
        target_quant = Decimal('10') ** -decimals
        rounded = d.quantize(target_quant, rounding=ROUND_HALF_UP)
        return float(rounded)
    except Exception:
        return round(float(val), decimals)
