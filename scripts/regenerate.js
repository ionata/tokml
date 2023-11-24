import fs from 'node:fs';
import path from 'node:path';
import glob from 'glob';
import tokml from '../lib/index.js';

glob.sync('test/data/*.geojson').forEach((geoFile) => {
  const kmlFile = geoFile.replace('.geojson', '.kml');
  const optionsFile = geoFile.replace('.geojson', '.options.json');
  let options;
  try {
    options = JSON.parse(fs.readFileSync(optionsFile));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    if (path.basename(geoFile).startsWith('simplestyle_')) options = { simplestyle: true };
  }
  const output = tokml(JSON.parse(fs.readFileSync(geoFile)), options);
  fs.writeFileSync(kmlFile, output);
});
