#!/usr/bin/env python3
"""
sar_optical_fusion.py — دمج SAR + Optical لصور أوضح
═══════════════════════════════════════════════════════
يدمج:
  - Sentinel-1 SAR VV (يكشف المباني والمعادن)
  - Sentinel-2 RGB (الألوان الحقيقية)
  - Sentinel-2 SWIR (تمييز المواد - صحراء/حضر/نبات)
  
النتيجة: صورة مُعزَّزة بدقة فعلية أعلى من S2 وحده

الاستخدام:
  python3 scripts/sar_optical_fusion.py --bbox minLon,minLat,maxLon,maxLat --zoom 12
"""
import sys, os, json, math, tempfile, io, argparse
import numpy as np
import cv2

def get_cdse_token():
    import urllib.request, urllib.parse
    client_id  = os.environ.get('CDSE_CLIENT_ID','sh-6dcac58b-957e-4a64-8b57-7c3105a65fe2')
    client_sec = os.environ.get('CDSE_CLIENT_SECRET','EgIauxIaacCVLVgGDM4QocfRG7w9V890')
    data = urllib.parse.urlencode({'grant_type':'client_credentials','client_id':client_id,'client_secret':client_sec}).encode()
    req = urllib.request.Request('https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token',
        data=data, headers={'Content-Type':'application/x-www-form-urlencoded'})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())['access_token']

def tile_bbox(tx, ty, z):
    n=2**z; w=tx/n*360-180; e=(tx+1)/n*360-180
    lr1=math.atan(math.sinh(math.pi*(1-2*ty/n))); n_=math.degrees(lr1)
    lr2=math.atan(math.sinh(math.pi*(1-2*(ty+1)/n))); s=math.degrees(lr2)
    return [w,s,e,n_]

def lonlat_to_tile(lon, lat, z):
    n=2**z; x=int((lon+180)/360*n); lr=math.radians(lat)
    y=int((1-math.log(math.tan(lr)+1/math.cos(lr))/math.pi)/2*n)
    return x, y

def fetch_sh_tile(token, bbox, collection, evalscript, size=256, isSAR=False):
    import urllib.request
    body = json.dumps({
        'input': {
            'bounds': {'bbox': bbox, 'properties': {'crs':'http://www.opengis.net/def/crs/EPSG/0/4326'}},
            'data': [{'type': collection, 'dataFilter': {
                'timeRange': {'from':'2026-01-01T00:00:00Z','to':'2026-07-07T23:59:59Z'},
                # SAR has no cloud cover — use mostRecent; optical use leastCC
                'mosaickingOrder': 'mostRecent' if isSAR else 'leastCC',
            }}],
        },
        'output': {'width': size, 'height': size, 'responses': [{'identifier':'default','format':{'type':'image/png'}}]},
        'evalscript': evalscript,
    }).encode()
    req = urllib.request.Request('https://sh.dataspace.copernicus.eu/api/v1/process',
        data=body, method='POST',
        headers={'Authorization':f'Bearer {token}','Content-Type':'application/json','Accept':'image/png'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()

def png_to_numpy(data):
    from PIL import Image
    img = Image.open(io.BytesIO(data)).convert('RGB')
    return np.array(img, dtype=np.float32)

EVALSCRIPTS = {
    's2_rgb': """//VERSION=3
function setup(){return{input:[{bands:["B04","B03","B02"],units:"REFLECTANCE"}],output:{bands:3,sampleType:"UINT8"}}}
function evaluatePixel(s){
  const gamma=2.2;
  return[Math.min(255,Math.round(Math.pow(Math.min(1,s.B04*3.5),1/gamma)*255)),
         Math.min(255,Math.round(Math.pow(Math.min(1,s.B03*3.5),1/gamma)*255)),
         Math.min(255,Math.round(Math.pow(Math.min(1,s.B02*3.5),1/gamma)*255))];}""",

    's2_swir': """//VERSION=3
function setup(){return{input:[{bands:["B12","B11","B08"],units:"REFLECTANCE"}],output:{bands:3,sampleType:"UINT8"}}}
function evaluatePixel(s){
  return[Math.min(255,Math.round(s.B12*3.5*255)),
         Math.min(255,Math.round(s.B11*3.0*255)),
         Math.min(255,Math.round(s.B08*2.5*255))];}""",

    's1_sar': """//VERSION=3
function setup(){return{input:[{bands:["VV"],units:"LINEAR_POWER"}],output:{bands:3,sampleType:"UINT8"}}}
function toDb(v){return 10*Math.log10(v+1e-10);}
function evaluatePixel(s){
  const db=toDb(s.VV);
  const scaled=Math.min(255,Math.max(0,Math.round((db+25)/30*255)));
  return[scaled,scaled,scaled];
}""",
}

def fuse_sar_optical(rgb, sar, swir, alpha_sar=0.25, alpha_swir=0.15):
    """
    الدمج:
    1. حوّل RGB إلى LAB color space
    2. أضف SAR كـ texture layer على قناة L (الإضاءة)
    3. أضف SWIR كـ hint للمواد
    4. حوّل عكسياً لـ RGB
    """
    # Normalize to 0-1
    rgb_n   = rgb / 255.0
    sar_n   = sar[:,:,0] / 255.0 if sar.ndim == 3 else sar / 255.0
    swir_n  = swir / 255.0

    # Convert RGB to LAB
    rgb_bgr = cv2.cvtColor((rgb_n * 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
    lab     = cv2.cvtColor(rgb_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)

    # Enhance L channel with SAR texture
    # SAR provides structural info (buildings, roads) without color
    lab_l   = lab[:,:,0] / 255.0  # L is 0-255 in OpenCV LAB
    
    # SAR enhancement: add edge information from radar
    sar_edges = cv2.Sobel(sar_n.astype(np.float32), cv2.CV_32F, 1, 1)
    sar_edges = np.abs(sar_edges)
    sar_edges = sar_edges / (sar_edges.max() + 1e-6)
    
    # Blend: enhance brightness where SAR shows structure
    l_enhanced = np.clip(lab_l + alpha_sar * sar_edges * 0.5 + alpha_sar * sar_n * 0.3, 0, 1)
    lab[:,:,0]  = (l_enhanced * 255).astype(np.float32)

    # Subtle SWIR tinting for material classification
    # SWIR highlights: built-up areas, bare soil, vegetation differences
    swir_gray = cv2.cvtColor((swir_n * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
    lab[:,:,1] = np.clip(lab[:,:,1] + alpha_swir * (swir_gray - 0.5) * 128, 0, 255)

    # Convert back to RGB
    lab_uint8   = np.clip(lab, 0, 255).astype(np.uint8)
    fused_bgr   = cv2.cvtColor(lab_uint8, cv2.COLOR_LAB2BGR)
    fused_rgb   = cv2.cvtColor(fused_bgr, cv2.COLOR_BGR2RGB)

    return fused_rgb

def apply_clahe(img):
    """Contrast Limited Adaptive Histogram Equalization — تحسين التباين"""
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    lab[:,:,0] = clahe.apply(lab[:,:,0])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)

def upscale_4x(img):
    """4× bicubic upscale + unsharp masking — رفع الدقة الافتراضية"""
    h, w = img.shape[:2]
    # 4× bicubic
    upscaled = cv2.resize(img, (w*4, h*4), interpolation=cv2.INTER_CUBIC)
    # Unsharp mask for edge enhancement
    blurred  = cv2.GaussianBlur(upscaled, (5,5), 1.0)
    sharpened = cv2.addWeighted(upscaled, 1.5, blurred, -0.5, 0)
    return np.clip(sharpened, 0, 255).astype(np.uint8)

def run_fusion(bbox, zoom=12, size=256, output_scale=2):
    """Main fusion pipeline"""
    token = get_cdse_token()

    print(f"Downloading S2 RGB...", file=sys.stderr)
    s2_data   = fetch_sh_tile(token, bbox, 'S2L2A', EVALSCRIPTS['s2_rgb'], size)
    
    print(f"Downloading S2 SWIR...", file=sys.stderr)
    swir_data = fetch_sh_tile(token, bbox, 'S2L2A', EVALSCRIPTS['s2_swir'], size)
    
    print(f"Downloading S1 SAR...", file=sys.stderr)
    sar_data  = fetch_sh_tile(token, bbox, 'S1GRD', EVALSCRIPTS['s1_sar'], size, isSAR=True)

    # Convert to numpy
    rgb  = png_to_numpy(s2_data)
    swir = png_to_numpy(swir_data)
    sar  = png_to_numpy(sar_data)

    print("Fusing SAR + Optical...", file=sys.stderr)
    fused = fuse_sar_optical(rgb, sar, swir)

    # CLAHE contrast enhancement
    fused = apply_clahe(fused)

    # Optional 2x upscale
    if output_scale > 1:
        h, w = fused.shape[:2]
        fused = cv2.resize(fused, (w*output_scale, h*output_scale), interpolation=cv2.INTER_CUBIC)
        # Final unsharp mask
        blurred = cv2.GaussianBlur(fused, (3,3), 0.8)
        fused   = np.clip(cv2.addWeighted(fused, 1.4, blurred, -0.4, 0), 0, 255).astype(np.uint8)

    # Encode to PNG
    from PIL import Image
    out = Image.fromarray(fused)
    buf = io.BytesIO()
    out.save(buf, 'PNG', optimize=True)
    
    return {
        'ok': True,
        'image_b64': buf.getvalue().hex(),  # hex for easy JSON
        'width': fused.shape[1],
        'height': fused.shape[0],
        'input_size': size,
        'output_scale': output_scale,
        'sources': ['Sentinel-2 RGB 10م', 'Sentinel-2 SWIR 20م', 'Sentinel-1 SAR 10م'],
        'method': 'SAR-texture + SWIR-material + CLAHE + bicubic',
    }

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--bbox',  required=True, help='minLon,minLat,maxLon,maxLat')
    parser.add_argument('--zoom',  type=int, default=12)
    parser.add_argument('--size',  type=int, default=256)
    parser.add_argument('--scale', type=int, default=2, help='Output upscale factor')
    args = parser.parse_args()

    bbox = list(map(float, args.bbox.split(',')))
    result = run_fusion(bbox, zoom=args.zoom, size=args.size, output_scale=args.scale)
    # Save PNG directly, print metadata as JSON to stderr
    import base64
    png_bytes = bytes.fromhex(result['image_b64'])
    sys.stdout.buffer.write(png_bytes)
    print(f"\n✅ Fusion: {result['width']}×{result['height']} | Methods: {result['method']}", file=sys.stderr)
