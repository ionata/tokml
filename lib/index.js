// @ts-check

/**
 * Convert a GeoJSON object into a KML string
 *
 * ```js
 * import tokml from '@ionata/tokml';
 *
 * const output = tokml(geojson, {
 *   documentName: 'My KML',
 *   documentDescription: 'The best KML',
 *   name: 'title',
 *   description: 'subtitle',
 *   timestamp: 'created_at,
 *   simplestyle: true,
 * });
 * ```
 *
 * The `documentName` and `documentDescription` values are added to the root
 * `<Document>` XML element, while `name`, `description` and `timestamp`
 * point to the keys within each GeoJSON Feature's properties to be
 * used for every `<Placemark>` in the generated KML.
 *
 * When [simplestyle][1] is enabled data is extracted from the Feature's
 * properties and used to produce a `<Style>` element for each `<Placemark>`.
 *
 * For `Point` and `MultiPoint`:
 *
 * ```
 *  * 'marker-symbol': ''
 *  * 'marker-color': '7e7e7e'
 *  * 'marker-size': 'medium'
 * ```
 *
 * NOTE: The defaults are only used if at least one of the style keys is
 * non-falsy. The now-obsolete `'marker-shape'` will be stripped, but
 * otherwise be always `'pin'`.
 *
 * For `Polygon`, `MultiPolygon`, `LineString` and `MultiLineString`:
 *
 * ```
 *  * 'stroke': '555'
 *  * 'stroke-width': 2
 *  * 'stroke-opacity': 1
 *  * 'fill': '555'
 *  * 'fill-opacity': 0.534 // (if 'fill' is unset/falsy, otherwise - 1)
 * ```
 *
 * NOTE: The defaults are only used if at least one of the style keys is
 * non-falsy. Each color+opacity pair requires a valid hex color (in short
 * or long form) and color names like 'red', 'orange', etc. are not supported.
 *
 * [1]: https://github.com/mapbox/simplestyle-spec/tree/master/1.1.0 "Simplestyle specification v1.1.0"
 */

/**
 * @typedef Options
 * @type {object}
 * @property {string} [documentName] - Document's <name>
 * @property {string} [documentDescription] - Document's <description>
 * @property {string} [name=name] - Placemark's <name> key within each Feature's properties
 * @property {string} [description=description] - Placemark's <description> key within each Feature's properties
 * @property {string} [timestamp=timestamp] - Placemark's <timestamp> key within each Feature's properties
 * @property {boolean} [simplestyle=false] - Flag to enable `simplestyle` processing (and removal) from each Feature
 */

/**
 * Convert given GeoJSON into KML
 *
 * @param {import('geojson').GeoJSON} geojson
 * @param {Options} options
 * @returns {string}  KML string
 */
export default function tokml(geojson, options) {
  options = {
    documentName: undefined,
    documentDescription: undefined,
    name: 'name',
    description: 'description',
    simplestyle: false,
    timestamp: 'timestamp',
    ...options,
  };

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    tag(
      'kml',
      { xmlns: 'http://www.opengis.net/kml/2.2' },
      tag('Document', documentName(options) + documentDescription(options) + root(geojson, options))
    )
  );
}

/**
 * @callback featureBuilder
 * @param {import('geojson').Feature} _
 * @returns {string}
 */

/**
 * @param {Options} options
 * @param {string[]} styleHashesArray
 * @returns {featureBuilder}  A Feature to string builder
 */
function feature(options, styleHashesArray) {
  return (_) => {
    let { properties } = _;
    if (!properties || !validators.isValid(_.geometry)) return '';
    const geometryString = anyGeometry(_.geometry);
    if (!geometryString) return '';

    let styleDefinition = '';
    let styleReference = '';
    if (options.simplestyle) {
      const styleHash = hashStyle(properties);
      if (styleHash) {
        if (validators.isPoint(_.geometry) && hasMarkerStyle(properties)) {
          if (styleHashesArray.indexOf(styleHash) === -1) {
            styleDefinition = markerStyle(properties, styleHash);
            styleHashesArray.push(styleHash);
          }
          styleReference = tag('styleUrl', '#' + styleHash);
          properties = removeMarkerStyles({ ...properties });
        } else if ((validators.isPolygon(_.geometry) || validators.isLine(_.geometry)) && hasPolygonAndLineStyle(properties)) {
          if (styleHashesArray.indexOf(styleHash) === -1) {
            styleDefinition = polygonAndLineStyle(properties, styleHash);
            styleHashesArray.push(styleHash);
          }
          styleReference = tag('styleUrl', '#' + styleHash);
          properties = removePolygonAndLineStyles({ ...properties });
        }
        // Note that style of GeometryCollection / MultiGeometry is not supported
      }
    }

    /** @type {Object.<string, *>} */
    const attributes = {};
    if (_.id) attributes.id = _.id.toString();

    return (
      styleDefinition +
      tag(
        'Placemark',
        attributes,
        name(properties, options) +
          description(properties, options) +
          extendedData(properties) +
          timestamp(properties, options) +
          geometryString +
          styleReference
      )
    );
  };
}

/**
 * @param {import('geojson').GeoJSON} _
 * @param {Options} options
 * @returns {string}
 */
function root(_, options) {
  if (!_.type) return '';

  /** @type {string[]} */
  const styleHashesArray = [];

  switch (_.type) {
    case 'FeatureCollection':
      if (!_.features) return '';
      return _.features.map(feature(options, styleHashesArray)).join('');
    case 'Feature':
      return feature(options, styleHashesArray)(_);
    default:
      return feature(options, styleHashesArray)({ type: 'Feature', geometry: _, properties: {} });
  }
}

/**
 * @param {Options} options
 * @returns {string}
 */
function documentName(options) {
  return options.documentName != null ? tag('name', options.documentName) : '';
}

/**
 * @param {Options} options
 * @returns {string}
 */
function documentDescription(options) {
  return options.documentDescription != null ? tag('description', options.documentDescription) : '';
}

/**
 * @param {import('geojson').GeoJsonProperties} _
 * @param {Options} options
 * @returns {string}
 */
function name(_, options) {
  if (!_ || !options.name) return '';
  return _[options.name] ? tag('name', encode(_[options.name])) : '';
}

/**
 * @param {import('geojson').GeoJsonProperties} _
 * @param {Options} options
 * @returns {string}
 */
function description(_, options) {
  if (!_ || !options.description) return '';
  return _[options.description] ? tag('description', encode(_[options.description])) : '';
}

/**
 * @param {import('geojson').GeoJsonProperties} _
 * @param {Options} options
 * @returns {string}
 */
function timestamp(_, options) {
  if (!_ || !options.timestamp) return '';
  return _[options.timestamp] ? tag('TimeStamp', tag('when', encode(_[options.timestamp]))) : '';
}

// ## Geometry Types

// https://developers.google.com/kml/documentation/kmlreference#geometry
const geometry = {
  /**
   * @param {import('geojson').Point} _
   * @returns {string}
   */
  Point: (_) => tag('Point', tag('coordinates', _.coordinates.join(','))),

  /**
   * @param {import('geojson').LineString} _
   * @returns {string}
   */
  LineString: (_) => tag('LineString', tag('coordinates', linearRing(_.coordinates))),

  /**
   * @param {import('geojson').Polygon} _
   * @returns {string}
   */
  Polygon: (_) => {
    if (!_.coordinates.length) return '';
    const outer = _.coordinates[0];
    const inner = _.coordinates.slice(1);
    const outerRing = tag('outerBoundaryIs', tag('LinearRing', tag('coordinates', linearRing(outer))));
    const innerRings = inner.map((i) => tag('innerBoundaryIs', tag('LinearRing', tag('coordinates', linearRing(i)))));
    return tag('Polygon', outerRing + innerRings.join(''));
  },

  /**
   * @param {import('geojson').MultiPoint} _
   * @returns {string}
   */
  MultiPoint: (_) => {
    if (!_.coordinates.length) return '';
    return tag('MultiGeometry', _.coordinates.map((c) => geometry.Point({ type: 'Point', coordinates: c })).join(''));
  },

  /**
   * @param {import('geojson').MultiPolygon} _
   * @returns {string}
   */
  MultiPolygon: (_) => {
    if (!_.coordinates.length) return '';
    return tag('MultiGeometry', _.coordinates.map((c) => geometry.Polygon({ type: 'Polygon', coordinates: c })).join(''));
  },

  /**
   * @param {import('geojson').MultiLineString} _
   * @returns {string}
   */
  MultiLineString: (_) => {
    if (!_.coordinates.length) return '';
    return tag('MultiGeometry', _.coordinates.map((c) => geometry.LineString({ type: 'LineString', coordinates: c })).join(''));
  },

  /**
   * @param {import('geojson').GeometryCollection} _
   * @returns {string}
   */
  GeometryCollection: (_) => tag('MultiGeometry', _.geometries.map(anyGeometry).join('')),
};

/**
 * @callback validator
 * @param {import('geojson').Geometry} _
 * @returns {boolean}
 */

const validators = {
  /** @type {validator} */
  isValid: (_) =>
    Boolean(_ && _.type && (_.type === 'GeometryCollection' ? _.geometries && _.geometries.every(validators.isValid) : _.coordinates)),
  /** @type {validator} */
  isPoint: (_) => _.type === 'Point' || _.type === 'MultiPoint',
  /** @type {validator} */
  isPolygon: (_) => _.type === 'Polygon' || _.type === 'MultiPolygon',
  /** @type {validator} */
  isLine: (_) => _.type === 'LineString' || _.type === 'MultiLineString',
};

/**
 * @callback geometryConverter
 * @param {*} geometry
 * @returns {string}
 */

/**
 * @param {import('geojson').Geometry} _
 * @returns {string}
 */
function anyGeometry(_) {
  if (typeof geometry[_.type] !== 'function') return '';
  /** @type {geometryConverter} */
  const fn = geometry[_.type];
  return fn(_);
}

/**
 * @param {import('geojson').Position[]} _
 * @returns {string}
 */
function linearRing(_) {
  return _.map((cds) => cds.join(',')).join(' ');
}

// ## Data

/**
 * @param {import('geojson').GeoJsonProperties} _
 * @returns {string}
 */
function extendedData(_) {
  if (!_) return '';
  return tag(
    'ExtendedData',
    Object.keys(_)
      .map((name) => data(name, _[name]))
      .join('')
  );
}

/**
 * @param {string} name
 * @param {string | number | boolean} value
 * @returns
 */
function data(name, value) {
  return tag('Data', { name }, tag('value', encode(value)));
}

// ## Marker style

/**
 * @param {import('geojson').GeoJsonProperties} _
 * @returns {boolean}
 */
function hasMarkerStyle(_) {
  if (!_) return false;
  return !!(_['marker-size'] || _['marker-symbol'] || _['marker-color']);
}

/**
 * @param {Object.<string, *>} _
 * @returns {Object.<string, *>}
 */
function removeMarkerStyles(_) {
  delete _['marker-shape'];
  delete _['marker-symbol'];
  delete _['marker-color'];
  delete _['marker-size'];
  return _;
}

/**
 * @param {Object.<string, *>} _
 * @param {string} styleHash
 * @returns {string}
 */
function markerStyle(_, styleHash) {
  return tag('Style', { id: styleHash }, tag('IconStyle', tag('Icon', tag('href', iconUrl(_)))) + iconSize(_));
}

/**
 * @param {Object.<string, *>} _
 * @returns {string}
 */
function iconUrl(_) {
  const size = _['marker-size'] || 'medium';
  const symbol = _['marker-symbol'] ? '-' + _['marker-symbol'] : '';
  const color = (_['marker-color'] || '7e7e7e').replace('#', '');

  return 'https://api.tiles.mapbox.com/v3/marker/' + 'pin-' + size.charAt(0) + symbol + '+' + color + '.png';
}

/**
 * @param {Object.<string, *>} _
 * @returns {string}
 */
function iconSize(_) {
  return tag('hotSpot', { xunits: 'fraction', yunits: 'fraction', x: 0.5, y: 0.5 }, '');
}

// ## Polygon and Line style

/**
 * Check if some stroke and fill properties are set
 *
 * @param {import('geojson').GeoJsonProperties} _
 * @returns {boolean}
 */
function hasPolygonAndLineStyle(_) {
  if (!_) return false;
  return !!(_['stroke'] || _['stroke-opacity'] || _['stroke-width'] || _['fill'] || _['fill-opacity']);
}

/**
 * Remove PolyStyle and LineStyle values from the Feature's properties
 *
 * @param {Object.<string, *>} _
 * @returns {Object.<string, *>}
 */
function removePolygonAndLineStyles(_) {
  delete _['stroke'];
  delete _['stroke-width'];
  delete _['stroke-opacity'];
  delete _['fill'];
  delete _['fill-opacity'];
  return _;
}

/**
 * Generate a Style XML Element with LineStyle and PolyStyle
 *
 * @param {Object.<string, *>} _
 * @param {string} styleHash
 * @returns {string}
 */
function polygonAndLineStyle(_, styleHash) {
  const lineStyle = tag(
    'LineStyle',
    tag('color', hexToKmlColor(_['stroke'], _['stroke-opacity']) || 'ff555555') +
      tag('width', _['stroke-width'] == null ? 2 : _['stroke-width'])
  );

  let polyStyle = '';
  if (_['fill'] || _['fill-opacity']) {
    polyStyle = tag('PolyStyle', tag('color', hexToKmlColor(_['fill'], _['fill-opacity']) || '88555555'));
  }

  return tag('Style', { id: styleHash }, lineStyle + polyStyle);
}

// ## Style helpers

/**
 * Build a hash of given GeoJSON properties styles
 *
 * @param {import('geojson').GeoJsonProperties} _
 * @returns {string}
 */
function hashStyle(_) {
  if (!_) return '';

  let hash = '';

  if (_['marker-symbol']) hash += 'ms' + _['marker-symbol'];
  if (_['marker-color']) hash += 'mc' + _['marker-color'].replace('#', '');
  if (_['marker-size']) hash += 'ms' + _['marker-size'];
  if (_['stroke']) hash += 's' + _['stroke'].replace('#', '');
  if (_['stroke-width']) hash += 'sw' + _['stroke-width'].toString().replace('.', '');
  if (_['stroke-opacity']) hash += 'mo' + _['stroke-opacity'].toString().replace('.', '');
  if (_['fill']) hash += 'f' + _['fill'].replace('#', '');
  if (_['fill-opacity']) hash += 'fo' + _['fill-opacity'].toString().replace('.', '');

  return hash;
}

/**
 * Convert given HEX color to safe KML color
 *
 * @param {string} hexColor
 * @param {number} opacity
 * @returns {string}
 */
function hexToKmlColor(hexColor, opacity) {
  if (typeof hexColor !== 'string') return '';

  hexColor = hexColor.replace('#', '').toLowerCase();

  let r = '';
  let g = '';
  let b = '';

  if (hexColor.length === 3) {
    [r, g, b] = hexColor.split('');
    r += r;
    g += g;
    b += b;
  } else if (hexColor.length === 6) {
    r = hexColor[0] + hexColor[1];
    g = hexColor[2] + hexColor[3];
    b = hexColor[4] + hexColor[5];
  } else {
    return '';
  }

  if (Number.isNaN(Number(`0x${r}`))) return '';
  if (Number.isNaN(Number(`0x${g}`))) return '';
  if (Number.isNaN(Number(`0x${b}`))) return '';

  let o = 'ff';
  if (typeof opacity === 'number' && opacity >= 0.0 && opacity <= 1.0) {
    o = ('0' + Math.floor(opacity * 255).toString(16)).slice(-2);
  }

  return o + b + g + r;
}

// ## General helpers

/**
 * Convert a set of attributes into XML Element attributes string
 *
 * @param {Object.<string, string | number | undefined>} [attributes]
 * @returns {string}
 */
function attr(attributes) {
  if (!attributes) return '';
  const keys = Object.keys(attributes);
  if (!keys.length) return '';
  return ` ${keys.map((key) => `${key}="${encode(attributes[key])}"`).join(' ')}`;
}

/**
 * Create an XML Element string
 *
 * @param {string} el - Element's name
 * @param {Object.<string, string | number> | string} attributes - Attributes map (or contents)
 * @param {string | number} [contents] - Contents of `innerXML`
 * @returns {string}
 */
function tag(el, attributes, contents) {
  /** @type {Object.<string, string | number>} */
  let attrs = {};
  if (typeof attributes === 'string' || typeof attributes === 'number') {
    contents = attributes;
  } else if (typeof attributes === 'object') {
    attrs = attributes;
  }
  contents = contents == null ? '' : `${contents}`;
  return `<${el}${attr(attrs)}>${contents}</${el}>`;
}

const encodePattern = /([&"<>'])/g;
const escapeMap = {
  '>': '&gt;',
  '<': '&lt;',
  "'": '&apos;',
  '"': '&quot;',
  '&': '&amp;',
};

/**
 * Sanitize given value to a safe XML Element attribute's value
 *
 * @param {string | number | boolean} [value]
 * @returns {string}
 */
function encode(value) {
  if (value == null) return '';
  return `${value}`.replace(encodePattern, (_, item) => escapeMap[item]);
}
