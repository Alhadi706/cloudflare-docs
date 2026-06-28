const fs = require('fs');
let code = fs.readFileSync('MapCanvas.tsx', 'utf8');

const targetWMS = `    case 'satellite':
      return new TileWMS({
        url: 'https://tiles.maps.eox.at/wms',
        params: { 'LAYERS': 's2cloudless-2020_3857', 'TILED': true },
        attributions: 'Copernicus Sentinel Data, EOX IT Services'
      });`;

const replacedWMS = `    case 'satellite':
      const instanceId = process.env.NEXT_PUBLIC_COPERNICUS_INSTANCE_ID || process.env.VITE_COPERNICUS_INSTANCE_ID;
      if (instanceId && instanceId !== 'your_copernicus_wms_config_id_here') {
        return new TileWMS({
          url: \`https://services.sentinel-hub.com/ogc/wms/\${instanceId}\`,
          params: { 'LAYERS': 'SENTINEL-2-L2A-TRUE-COLOR', 'TILED': true },
          attributions: 'Copernicus Sentinel Data'
        });
      }
      return new TileWMS({
        url: 'https://tiles.maps.eox.at/wms',
        params: { 'LAYERS': 's2cloudless-2020_3857', 'TILED': true },
        attributions: 'Copernicus Sentinel Data, EOX IT Services'
      });`;

code = code.replace(targetWMS, replacedWMS);
fs.writeFileSync('MapCanvas.tsx', code);
