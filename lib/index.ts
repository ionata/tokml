// @ts-check

import {
  Feature,
  GeoJSON,
  GeoJsonProperties,
  Geometry,
  GeometryCollection,
  LineString,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
  Point,
  Polygon,
  Position,
} from 'geojson';

type Options = {
  /**
   * Document's <name>
   */
  documentName?: string;

  /**
   * Document's <description>
   */
  documentDescription?: string;

  /**
   * Placemark's <name> key within each Feature's properties
   */
  name?: string;

  /**
   * Placemark's <description> key within each Feature's properties
   */
  description?: string;

  /**
   * Placemark's <TimeStamp><when> key within each Feature's properties
   */
  timestamp?: string;

  /**
   * Flag to enable [simplestyle][1] processing (and removal) from each Feature
   *
   * Data is extracted from the Feature's properties:
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
  simplestyle?: boolean;
};

type ConvertersMap = {
  Point: (_: Point) => string;
  LineString: (_: LineString) => string;
  Polygon: (_: Polygon) => string;
  MultiPoint: (_: MultiPoint) => string;
  MultiPolygon: (_: MultiPolygon) => string;
  MultiLineString: (_: MultiLineString) => string;
  GeometryCollection: (_: GeometryCollection) => string;
};

export default function tokml(geojson: GeoJSON, options: Options) {
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

function feature(options: Options, styleHashesArray: string[]) {
  return (_: Feature) => {
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

    const attributes: Record<string, string> = {};
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

function root(_: GeoJSON, options: Options): string {
  if (!_.type) return '';

  const styleHashesArray: string[] = [];

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

function documentName(options: Options) {
  return options.documentName != null ? tag('name', options.documentName) : '';
}

function documentDescription(options: Options) {
  return options.documentDescription != null ? tag('description', options.documentDescription) : '';
}

function name(_: GeoJsonProperties, options: Options) {
  if (!_ || !options.name) return '';
  return _[options.name] ? tag('name', encode(_[options.name])) : '';
}

function description(_: GeoJsonProperties, options: Options) {
  if (!_ || !options.description) return '';
  return _[options.description] ? tag('description', encode(_[options.description])) : '';
}

function timestamp(_: GeoJsonProperties, options: Options) {
  if (!_ || !options.timestamp) return '';
  return _[options.timestamp] ? tag('TimeStamp', tag('when', encode(_[options.timestamp]))) : '';
}

// ## Geometry Types

// https://developers.google.com/kml/documentation/kmlreference#geometry
const geometry: ConvertersMap = {
  Point: (_: Point) => tag('Point', tag('coordinates', _.coordinates.join(','))),
  LineString: (_: LineString) => tag('LineString', tag('coordinates', linearRing(_.coordinates))),
  Polygon: (_: Polygon) => {
    if (!_.coordinates.length) return '';
    const outer = _.coordinates[0];
    const inner = _.coordinates.slice(1);
    const outerRing = tag('outerBoundaryIs', tag('LinearRing', tag('coordinates', linearRing(outer))));
    const innerRings = inner.map((i) => tag('innerBoundaryIs', tag('LinearRing', tag('coordinates', linearRing(i)))));
    return tag('Polygon', outerRing + innerRings.join(''));
  },
  MultiPoint: (_: MultiPoint) => {
    if (!_.coordinates.length) return '';
    return tag('MultiGeometry', _.coordinates.map((c) => geometry.Point({ type: 'Point', coordinates: c })).join(''));
  },
  MultiPolygon: (_: MultiPolygon) => {
    if (!_.coordinates.length) return '';
    return tag('MultiGeometry', _.coordinates.map((c) => geometry.Polygon({ type: 'Polygon', coordinates: c })).join(''));
  },
  MultiLineString: (_: MultiLineString) => {
    if (!_.coordinates.length) return '';
    return tag('MultiGeometry', _.coordinates.map((c) => geometry.LineString({ type: 'LineString', coordinates: c })).join(''));
  },
  GeometryCollection: (_: GeometryCollection) => tag('MultiGeometry', _.geometries.map(anyGeometry).join('')),
};

const validators = {
  isValid: (_: Geometry): boolean =>
    Boolean(_ && _.type && (_.type === 'GeometryCollection' ? _.geometries && _.geometries.every(validators.isValid) : _.coordinates)),
  isPoint: (_: Geometry) => _.type === 'Point' || _.type === 'MultiPoint',
  isPolygon: (_: Geometry) => _.type === 'Polygon' || _.type === 'MultiPolygon',
  isLine: (_: Geometry) => _.type === 'LineString' || _.type === 'MultiLineString',
};

function anyGeometry(_: Geometry): string {
  if (typeof geometry[_.type] !== 'function') return '';
  const fn = geometry[_.type];
  return fn(_ as any);
}

function linearRing(_: Position[]) {
  return _.map((cds) => cds.join(',')).join(' ');
}

// ## Data
function extendedData(_: GeoJsonProperties) {
  if (!_) return '';
  return tag(
    'ExtendedData',
    Object.keys(_)
      .map((name) => data(name, _[name]))
      .join('')
  );
}

function data(name: string, value: string) {
  return tag('Data', { name }, tag('value', encode(value)));
}

// ## Marker style

function hasMarkerStyle(_: GeoJsonProperties) {
  if (!_) return false;
  return !!(_['marker-size'] || _['marker-symbol'] || _['marker-color']);
}

function removeMarkerStyles(_: NonNullable<GeoJsonProperties>) {
  delete _['marker-shape'];
  delete _['marker-symbol'];
  delete _['marker-color'];
  delete _['marker-size'];
  return _;
}

function markerStyle(_: NonNullable<GeoJsonProperties>, styleHash: string) {
  return tag('Style', { id: styleHash }, tag('IconStyle', tag('Icon', tag('href', iconUrl(_)))) + iconSize(_));
}

function iconUrl(_: NonNullable<GeoJsonProperties>) {
  const size = _['marker-size'] || 'medium';
  const symbol = _['marker-symbol'] ? '-' + _['marker-symbol'] : '';
  const color = (_['marker-color'] || '7e7e7e').replace('#', '');

  return 'https://api.tiles.mapbox.com/v3/marker/' + 'pin-' + size.charAt(0) + symbol + '+' + color + '.png';
}

function iconSize(_: NonNullable<GeoJsonProperties>) {
  return tag('hotSpot', { xunits: 'fraction', yunits: 'fraction', x: 0.5, y: 0.5 }, '');
}

// ## Polygon and Line style

function hasPolygonAndLineStyle(_: GeoJsonProperties) {
  if (!_) return false;
  return !!(_['stroke'] || _['stroke-opacity'] || _['stroke-width'] || _['fill'] || _['fill-opacity']);
}

function removePolygonAndLineStyles(_: NonNullable<GeoJsonProperties>) {
  delete _['stroke'];
  delete _['stroke-width'];
  delete _['stroke-opacity'];
  delete _['fill'];
  delete _['fill-opacity'];
  return _;
}

function polygonAndLineStyle(_: NonNullable<GeoJsonProperties>, styleHash: string) {
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

function hashStyle(_: GeoJsonProperties) {
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

function hexToKmlColor(hexColor: string, opacity: number) {
  if (typeof hexColor !== 'string') return '';

  hexColor = hexColor.replace('#', '').toLowerCase();

  let r: string, g: string, b: string;

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

function attr(attributes?: Record<string, string | number | undefined | null>): string {
  if (!attributes) return '';
  const keys = Object.keys(attributes);
  if (!keys.length) return '';
  return ` ${keys.map((key) => `${key}="${encode(attributes[key])}"`).join(' ')}`;
}

/**
 * @param {string} el  element's name
 * @param {object} attributes  attributes map
 * @param {string} contents  contents of innerXML
 * @returns {string}
 */
function tag(el: string, attributes: Record<string, string | number>, contents: string | number): string;
function tag(el: string, contents: string | number): string;
function tag(el: string, attributes: any, contents: string | number = ''): string {
  let attrs: Record<string, string | number> = {};
  if (typeof attributes === 'string' || typeof attributes === 'number') {
    contents = attributes;
  } else if (typeof attributes === 'object') {
    attrs = attributes;
  }
  contents = contents == null ? '' : `${contents}`;
  return `<${el}${attr(attrs)}>${contents}</${el}>`;
}

const escapeMap: Record<string, string> = {
  '>': '&gt;',
  '<': '&lt;',
  "'": '&apos;',
  '"': '&quot;',
  '&': '&amp;',
};

function encode(string: string | number | undefined | null): string {
  if (string == null) return '';
  const pattern = /([&"<>'])/g;
  return `${string}`.replace(pattern, (_, item) => escapeMap[item]);
}
