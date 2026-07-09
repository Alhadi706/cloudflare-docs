#!/usr/bin/env python3
"""
Planet Full Archive Script — أرشفة شاملة قبل 13 يوليو 2026
يعمل في الخلفية مع تأخير آمن بين الطلبات (0.5 ثانية)

الاستخدام: python3 scripts/planet_full_archive.py
"""

import urllib.request, json, base64, time, os, sys, signal
from datetime import datetime

PLANET_KEY   = "PLAKaab2adfefe7642c9a878aecdded5c1f8"
AUTH         = f"Basic {base64.b64encode(f'{PLANET_KEY}:'.encode()).decode()}"
PLANET_BASE  = "https://api.planet.com/data/v1"
ARCHIVE_DIR  = os.path.join(os.path.dirname(__file__), '..', '.data', 'planet-archive')
META_DIR     = os.path.join(ARCHIVE_DIR, 'metadata')
THUMB_DIR    = os.path.join(ARCHIVE_DIR, 'thumbnails')

os.makedirs(META_DIR,  exist_ok=True)
os.makedirs(THUMB_DIR, exist_ok=True)

# ── المناطق المستهدفة ────────────────────────────────────────────────────────

AREAS = {
    # الساحل الشمالي
    "tripoli":       [12.8, 32.6, 13.5, 33.1],
    "misrata":       [15.0, 32.3, 15.5, 32.7],
    "zawiya":        [12.5, 32.7, 13.0, 32.9],
    "khoms":         [14.1, 32.5, 14.7, 32.8],
    "benghazi":      [20.0, 32.0, 20.5, 32.5],
    "tobruk":        [23.8, 31.9, 24.1, 32.2],
    "derna":         [22.5, 32.5, 22.8, 32.8],
    "sirte":         [16.4, 31.0, 16.8, 31.4],
    # النهر الصناعي — المسار الغربي
    "gmmr_tripoli":  [13.0, 32.7, 13.3, 32.95],
    "gmmr_central":  [14.0, 29.0, 15.0, 30.0],
    "gmmr_south":    [14.0, 27.5, 15.5, 29.5],
    # حقول النفط
    "brega":         [19.3, 30.3, 19.8, 30.7],
}

# السنوات المستهدفة
YEARS = list(range(2016, 2027))

# ── إحصاءات التقدم ─────────────────────────────────────────────────────────

stats = {
    "scenes_downloaded": 0,
    "thumbs_downloaded":  0,
    "skipped":            0,
    "errors":             0,
    "start_time":         datetime.now(),
}

interrupted = False

def handle_sigint(sig, frame):
    global interrupted
    interrupted = True
    print("\n\n⚠️  إيقاف... سيكتمل الطلب الحالي ثم يتوقف.")
signal.signal(signal.SIGINT, handle_sigint)

# ── وظائف مساعدة ────────────────────────────────────────────────────────────

def search_scenes(bbox, date_from, date_to, limit=250):
    body = json.dumps({
        "item_types": ["PSScene"],
        "limit": limit,
        "filter": {
            "type": "AndFilter",
            "config": [
                {"type": "GeometryFilter", "field_name": "geometry",
                 "config": {"type": "Polygon", "coordinates": [
                     [[bbox[0],bbox[1]],[bbox[2],bbox[1]],[bbox[2],bbox[3]],[bbox[0],bbox[3]],[bbox[0],bbox[1]]]
                 ]}},
                {"type": "DateRangeFilter", "field_name": "acquired",
                 "config": {"gte": f"{date_from}T00:00:00Z", "lte": f"{date_to}T23:59:59Z"}},
                {"type": "RangeFilter", "field_name": "cloud_cover", "config": {"lte": 0.25}},
            ]
        }
    }).encode()
    req = urllib.request.Request(f"{PLANET_BASE}/quick-search",
        data=body, headers={"Authorization": AUTH, "Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read()).get("features", [])

def download_thumbnail(scene_id, item_type="PSScene"):
    thumb_path = os.path.join(THUMB_DIR, f"{scene_id}.png")
    if os.path.exists(thumb_path):
        return True  # already cached
    url = f"https://tiles.planet.com/data/v1/item-types/{item_type}/items/{scene_id}/thumb"
    req = urllib.request.Request(url, headers={"Authorization": AUTH})
    with urllib.request.urlopen(req, timeout=15) as r:
        data = r.read()
        with open(thumb_path, 'wb') as f:
            f.write(data)
    return True

def save_metadata(feature, area_key):
    p = feature.get("properties", {})
    scene_id = feature["id"]
    meta = {
        "scene_uid":          scene_id,
        "area_key":           area_key,
        "acquisition_date":   p.get("acquired", "")[:10],
        "acquisition_time":   p.get("acquired", "")[11:16],
        "cloud_cover_pct":    round((p.get("cloud_cover", 0) or 0) * 100),
        "satellite_id":       p.get("satellite_id", ""),
        "pixel_resolution_m": p.get("pixel_resolution", 3),
        "item_type":          p.get("item_type", "PSScene"),
        "geometry":           feature.get("geometry"),
        "source":             "PlanetScope",
        "archived_at":        datetime.now().isoformat(),
        "data_is_real":       True,
    }
    with open(os.path.join(META_DIR, f"{scene_id}.json"), 'w') as f:
        json.dump(meta, f, ensure_ascii=False)
    return meta

def progress_bar(done, total, width=30):
    pct = done / total if total > 0 else 0
    filled = int(width * pct)
    bar = '█' * filled + '░' * (width - filled)
    return f"[{bar}] {done}/{total} ({pct*100:.0f}%)"

# ── الحلقة الرئيسية ─────────────────────────────────────────────────────────

total_tasks = len(AREAS) * len(YEARS)
done_tasks  = 0

print("=" * 60)
print("🌍 Planet Full Archive — أرشفة شاملة")
print(f"📅 السنوات: {YEARS[0]}–{YEARS[-1]}  ({len(YEARS)} سنة)")
print(f"📍 المناطق: {len(AREAS)}")
print(f"🎯 المتوقع: ~{total_tasks * 250:,} مشهد | ~{total_tasks * 250 * 56 // 1024 // 1024:.0f} MB")
print("=" * 60)
print()

for area_key, bbox in AREAS.items():
    if interrupted: break

    for year in YEARS:
        if interrupted: break

        done_tasks += 1
        date_from = f"{year}-01-01"
        date_to   = f"{year}-12-31"

        # Skip future dates
        if year > datetime.now().year: continue
        if year == datetime.now().year:
            date_to = datetime.now().strftime("%Y-%m-%d")

        sys.stdout.write(f"\r{progress_bar(done_tasks, total_tasks)} | {area_key} {year}   ")
        sys.stdout.flush()

        try:
            features = search_scenes(bbox, date_from, date_to)
            time.sleep(0.3)  # Rate limit between searches

            new_scenes = 0
            for feat in features:
                if interrupted: break
                scene_id  = feat["id"]
                item_type = feat.get("properties", {}).get("item_type", "PSScene")
                meta_path = os.path.join(META_DIR, f"{scene_id}.json")
                thumb_path= os.path.join(THUMB_DIR, f"{scene_id}.png")

                # Save metadata (fast, always)
                if not os.path.exists(meta_path):
                    save_metadata(feat, area_key)
                    stats["scenes_downloaded"] += 1
                    new_scenes += 1
                else:
                    stats["skipped"] += 1

                # Download thumbnail
                if not os.path.exists(thumb_path):
                    try:
                        download_thumbnail(scene_id, item_type)
                        stats["thumbs_downloaded"] += 1
                        time.sleep(0.4)  # Respectful delay between thumbnails
                    except Exception as e:
                        stats["errors"] += 1

        except Exception as e:
            stats["errors"] += 1
            time.sleep(1)  # Extra wait on error

# ── الملخص النهائي ───────────────────────────────────────────────────────────

print("\n")
print("=" * 60)
print("✅ اكتملت الأرشفة!" if not interrupted else "⏸ توقفت مؤقتاً")
print(f"  📂 مشاهد جديدة:    {stats['scenes_downloaded']:,}")
print(f"  🖼️ صور محملة:       {stats['thumbs_downloaded']:,}")
print(f"  ⏭️  موجود مسبقاً:   {stats['skipped']:,}")
print(f"  ❌ أخطاء:           {stats['errors']:,}")

total_meta  = len(os.listdir(META_DIR))
total_thumb = len(os.listdir(THUMB_DIR))
size_mb = sum(
    os.path.getsize(os.path.join(d, f))
    for d in [META_DIR, THUMB_DIR]
    for f in os.listdir(d)
) / (1024 * 1024)

elapsed = (datetime.now() - stats["start_time"]).total_seconds() / 60
print(f"\n  📊 الإجمالي الكامل:  {total_meta:,} مشهد | {total_thumb:,} صورة")
print(f"  💾 الحجم الكلي:      {size_mb:.1f} MB")
print(f"  ⏱️  الوقت المستغرق:  {elapsed:.1f} دقيقة")
print("=" * 60)
