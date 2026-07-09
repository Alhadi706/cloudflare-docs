"""
Spatial Memory Engine — الذاكرة المكانية لـ MINERVA.

تحفظ تاريخ الأنماط في كل موقع جغرافي.
عند رصد شذوذ جديد: تسأل "هل رأينا هذا هنا من قبل؟"

الجواب يؤثر على التشخيص:
  - نعم، وكان تسربًا: يرتفع prior لـ WATER_LEAK
  - نعم، وكان ريًا طبيعيًا: ينخفض قلق النظام
  - لا: أول ظهور لهذا النمط → تحقيق مُعجَّل
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date
from typing import Optional
import math


def encode_geohash(lat: float, lon: float, precision: int = 6) -> str:
    """
    تشفير بسيط للموقع إلى geohash string.
    precision=6 → دقة ~1.2km × 0.6km (كافية للأنابيب).
    precision=7 → دقة ~150m × 150m (للنقاط الدقيقة).
    """
    base32 = "0123456789bcdefghjkmnpqrstuvwxyz"
    lat_range = [-90.0,  90.0]
    lon_range = [-180.0, 180.0]

    bits = []
    even_bit = True
    for _ in range(precision * 5):
        if even_bit:
            mid = (lon_range[0] + lon_range[1]) / 2
            if lon >= mid:
                bits.append(1)
                lon_range[0] = mid
            else:
                bits.append(0)
                lon_range[1] = mid
        else:
            mid = (lat_range[0] + lat_range[1]) / 2
            if lat >= mid:
                bits.append(1)
                lat_range[0] = mid
            else:
                bits.append(0)
                lat_range[1] = mid
        even_bit = not even_bit

    result = ""
    for i in range(0, len(bits), 5):
        idx = sum(b << (4 - j) for j, b in enumerate(bits[i:i+5]))
        result += base32[idx]
    return result


@dataclass
class SpatialOccurrence:
    date: date
    event_type: str       # الحدث الفعلي (مؤكد ميدانيًا) أو "SUSPECTED"
    confirmed: bool       # هل جرى التحقق الميداني؟
    signal_signature: dict  # {signal_id: z_score} وقت الرصد
    asset_id: str


@dataclass
class SpatialMemoryCell:
    """
    خلية ذاكرة لموقع جغرافي محدد (geohash).
    """
    geohash: str
    occurrences: list[SpatialOccurrence] = field(default_factory=list)

    @property
    def n_confirmed(self) -> int:
        return sum(1 for o in self.occurrences if o.confirmed)

    @property
    def recurrence_score(self) -> float:
        """كلما تكرر الحدث في هذا الموقع، كلما ارتفعت درجة الاشتباه."""
        n = len(self.occurrences)
        if n == 0: return 0.0
        confirmed_weight = sum(2 if o.confirmed else 1 for o in self.occurrences)
        return min(1.0, confirmed_weight / 10.0)

    def most_common_event(self) -> Optional[str]:
        if not self.occurrences:
            return None
        counts: dict[str, int] = {}
        for o in self.occurrences:
            counts[o.event_type] = counts.get(o.event_type, 0) + (2 if o.confirmed else 1)
        return max(counts, key=counts.get)

    def get_prior_adjustment(self, event_type: str) -> float:
        """
        يُعيد معامل تعديل الـ Prior للحدث بناءً على التاريخ.
        > 1.0: هذا الموقع يميل لهذا الحدث
        < 1.0: هذا الموقع نادرًا ما يشهد هذا الحدث
        1.0: لا تاريخ
        """
        if not self.occurrences:
            return 1.0
        event_count = sum(1 for o in self.occurrences if o.event_type == event_type)
        total = len(self.occurrences)
        if total < 2:
            return 1.0
        frequency = event_count / total
        # تحويل إلى معامل: تكرار 0% → 0.5, 50% → 1.5, 100% → 2.5
        return 0.5 + 2.0 * frequency

    def match_signature(self, query_signature: dict, threshold: float = 0.60) -> list[SpatialOccurrence]:
        """
        يبحث عن حالات تاريخية تشبه الشذوذ الحالي.
        يُقارن z-scores signatures.
        """
        matches = []
        for occ in self.occurrences:
            if not occ.signal_signature:
                continue
            similarity = self._cosine_similarity(query_signature, occ.signal_signature)
            if similarity >= threshold:
                matches.append(occ)
        return matches

    @staticmethod
    def _cosine_similarity(a: dict, b: dict) -> float:
        common = set(a) & set(b)
        if not common:
            return 0.0
        dot = sum(a[k] * b[k] for k in common)
        mag_a = math.sqrt(sum(v**2 for v in a.values()))
        mag_b = math.sqrt(sum(v**2 for v in b.values()))
        if mag_a < 1e-9 or mag_b < 1e-9:
            return 0.0
        return dot / (mag_a * mag_b)


class SpatialMemory:
    """
    الذاكرة المكانية الكاملة لـ MINERVA.
    تُبنى تدريجيًا من نتائج التشخيص والتحقق الميداني.
    """

    def __init__(self):
        self._cells: dict[str, SpatialMemoryCell] = {}

    def record(
        self,
        lat: float,
        lon: float,
        obs_date: date,
        event_type: str,
        asset_id: str,
        signal_signature: dict,
        confirmed: bool = False,
        precision: int = 7,
    ):
        geohash = encode_geohash(lat, lon, precision)
        if geohash not in self._cells:
            self._cells[geohash] = SpatialMemoryCell(geohash=geohash)

        self._cells[geohash].occurrences.append(SpatialOccurrence(
            date=obs_date,
            event_type=event_type,
            confirmed=confirmed,
            signal_signature=signal_signature,
            asset_id=asset_id,
        ))

    def recall(
        self,
        lat: float,
        lon: float,
        precision: int = 7,
    ) -> Optional[SpatialMemoryCell]:
        geohash = encode_geohash(lat, lon, precision)
        return self._cells.get(geohash)

    def get_prior_adjustment(
        self,
        lat: float,
        lon: float,
        event_type: str,
        precision: int = 7,
    ) -> float:
        cell = self.recall(lat, lon, precision)
        if cell is None:
            return 1.0
        return cell.get_prior_adjustment(event_type)

    def find_similar_patterns(
        self,
        lat: float,
        lon: float,
        signal_signature: dict,
        precision: int = 7,
        radius_cells: int = 1,
    ) -> list[SpatialOccurrence]:
        """
        يبحث في الـ geohash المحيطة عن أنماط مشابهة.
        """
        geohash = encode_geohash(lat, lon, precision)
        matches = []

        # البحث في نفس الخلية والخلايا المجاورة
        for gh, cell in self._cells.items():
            if gh.startswith(geohash[:4]):   # نفس المنطقة العامة
                found = cell.match_signature(signal_signature)
                matches.extend(found)

        return matches

    def get_stats(self) -> dict:
        total_occ = sum(len(c.occurrences) for c in self._cells.values())
        confirmed = sum(c.n_confirmed for c in self._cells.values())
        return {
            "total_cells": len(self._cells),
            "total_occurrences": total_occ,
            "confirmed_occurrences": confirmed,
            "hotspot_geohash": max(
                self._cells, key=lambda gh: self._cells[gh].recurrence_score, default=None
            ),
        }
