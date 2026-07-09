#!/usr/bin/env python3
"""
tile_detect.py — كشف الكائنات في صور الأقمار الاصطناعية
═══════════════════════════════════════════════════════════════
يُشغَّل كـ subprocess من Next.js API route
يستخدم YOLOv8-OBB (DOTA dataset) المُدرَّب على الصور الجوية

الفئات المكتشفة (DOTA):
  plane | ship | storage tank | baseball diamond | tennis court
  basketball court | ground track field | harbor | bridge
  large vehicle | small vehicle | helicopter | roundabout
  soccer ball field | swimming pool

الاستخدام:
  python3 scripts/tile_detect.py --bbox minLon,minLat,maxLon,maxLat --zoom 18
"""
import sys, os, json, math, tempfile, io, argparse
from collections import Counter

def lonlat_to_tile(lon, lat, z):
    n = 2**z
    x = int((lon + 180) / 360 * n)
    lat_r = math.radians(lat)
    y = int((1 - math.log(math.tan(lat_r) + 1/math.cos(lat_r)) / math.pi) / 2 * n)
    return x, y

def tile_bounds(tx, ty, z):
    """Returns [west, south, east, north] of a tile"""
    n = 2**z
    west  = tx / n * 360 - 180
    east  = (tx+1) / n * 360 - 180
    lat_r = math.atan(math.sinh(math.pi * (1 - 2 * ty / n)))
    north = math.degrees(lat_r)
    lat_r2= math.atan(math.sinh(math.pi * (1 - 2 * (ty+1) / n)))
    south = math.degrees(lat_r2)
    return west, south, east, north

def pixel_to_lonlat(px, py, tile_x, tile_y, zoom, tile_size=256, img_size=None, cols=1, rows=1):
    """Convert pixel coords in stitched image back to lon/lat"""
    # Which tile in the grid?
    tpx = px // tile_size
    tpy = py // tile_size
    # Pixel within that tile
    local_px = px % tile_size
    local_py = py % tile_size
    # Tile index
    tx = tile_x + tpx
    ty = tile_y + tpy
    # Fractional position within tile
    frac_x = local_px / tile_size
    frac_y = local_py / tile_size
    w, s, e, n = tile_bounds(tx, ty, zoom)
    lon = w + frac_x * (e - w)
    lat = n - frac_y * (n - s)
    return lon, lat

def download_tiles(lon, lat, zoom, grid_size):
    """Download a grid of Esri tiles and stitch them"""
    try:
        from PIL import Image
        import urllib.request
    except ImportError:
        raise RuntimeError("PIL required: pip install Pillow")

    tx, ty = lonlat_to_tile(lon, lat, zoom)
    # Center the grid
    tx -= grid_size // 2
    ty -= grid_size // 2

    combined = Image.new('RGB', (256*grid_size, 256*grid_size))
    downloaded = 0
    for dy in range(grid_size):
        for dx in range(grid_size):
            url = f'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{zoom}/{ty+dy}/{tx+dx}'
            req = urllib.request.Request(url, headers={
                'User-Agent': 'DSF-GIS-Detector/1.0',
                'Referer':    'https://dev.d-me.ly/',
            })
            try:
                with urllib.request.urlopen(req, timeout=10) as r:
                    combined.paste(Image.open(io.BytesIO(r.read())), (dx*256, dy*256))
                    downloaded += 1
            except Exception:
                pass

    return combined, tx, ty, downloaded

def run_detection(bbox, zoom=18, conf=0.15, grid=4, model_name='yolov8n-obb.pt'):
    """Main detection pipeline"""
    try:
        from ultralytics import YOLO
    except ImportError:
        return {"error": "ultralytics not installed", "hint": "pip install ultralytics"}

    minLon, minLat, maxLon, maxLat = bbox
    center_lon = (minLon + maxLon) / 2
    center_lat = (minLat + maxLat) / 2

    # Download tiles
    img, base_tx, base_ty, downloaded = download_tiles(center_lon, center_lat, zoom, grid)

    img_w, img_h = img.size
    tile_size = 256
    res_m = 156543.03 * math.cos(math.radians(center_lat)) / (2**zoom)

    # Save to temp file
    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False, dir='/tmp') as f:
        img.save(f, 'JPEG', quality=95)
        tmp_path = f.name

    try:
        model = YOLO(model_name)
        results = model(tmp_path, verbose=False, conf=conf, iou=0.45)
    finally:
        os.unlink(tmp_path)

    dets_raw = results[0].obb
    detections = []
    if dets_raw is not None and len(dets_raw.cls) > 0:
        for i in range(len(dets_raw.cls)):
            cls_id = int(dets_raw.cls[i])
            score  = float(dets_raw.conf[i])
            label  = model.names[cls_id]

            # OBB center point (pixel coords)
            cx = float(dets_raw.xywhr[i][0])
            cy = float(dets_raw.xywhr[i][1])
            w  = float(dets_raw.xywhr[i][2])
            h  = float(dets_raw.xywhr[i][3])

            # Convert to lon/lat
            lon, lat = pixel_to_lonlat(int(cx), int(cy), base_tx, base_ty, zoom, tile_size, grid)

            detections.append({
                "class":    label,
                "class_ar": CLASS_AR.get(label, label),
                "lon":      round(lon, 6),
                "lat":      round(lat, 6),
                "confidence": round(score, 3),
                "width_m":  round(w * res_m, 1),
                "height_m": round(h * res_m, 1),
                "area_m2":  round(w * h * res_m * res_m, 0),
            })

    stats = dict(Counter(d["class"] for d in detections))
    return {
        "ok":         True,
        "model":      model_name,
        "zoom":       zoom,
        "res_m":      round(res_m, 2),
        "tiles":      f"{grid}×{grid} ({downloaded} downloaded)",
        "img_size_px": f"{img_w}×{img_h}",
        "center":     [center_lon, center_lat],
        "total":      len(detections),
        "stats":      stats,
        "detections": detections,
        "dataset":    "DOTA (Aerial Object Detection)",
        "classes_available": list(model.names.values()),
    }

# Arabic labels for DOTA classes
CLASS_AR = {
    "plane":              "طائرة",
    "ship":               "سفينة",
    "storage tank":       "خزان",
    "baseball diamond":   "ملعب بيسبول",
    "tennis court":       "ملعب تنس",
    "basketball court":   "ملعب كرة سلة",
    "ground track field": "ملعب ألعاب قوى",
    "harbor":             "ميناء",
    "bridge":             "جسر",
    "large vehicle":      "مركبة كبيرة",
    "small vehicle":      "مركبة صغيرة",
    "helicopter":         "مروحية",
    "roundabout":         "دوار",
    "soccer ball field":  "ملعب كرة قدم",
    "swimming pool":      "مسبح",
}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--bbox', required=True, help='minLon,minLat,maxLon,maxLat')
    parser.add_argument('--zoom', type=int, default=18)
    parser.add_argument('--conf', type=float, default=0.15)
    parser.add_argument('--grid', type=int, default=4, help='NxN tile grid')
    parser.add_argument('--model', default='yolov8n-obb.pt')
    args = parser.parse_args()

    bbox = list(map(float, args.bbox.split(',')))
    result = run_detection(bbox, zoom=args.zoom, conf=args.conf, grid=args.grid, model_name=args.model)
    print(json.dumps(result, ensure_ascii=False, indent=2))
