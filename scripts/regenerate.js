import fs from 'node:fs';
import glob from 'glob';
import tokml from '../lib/index.js';

glob.sync('test/data/*.geojson').forEach(function (g) {
  fs.writeFileSync(g.replace('.geojson', '.kml'), tokml(JSON.parse(fs.readFileSync(g))));
});
