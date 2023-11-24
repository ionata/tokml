import { GeoJSON } from 'geojson';
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
 *
 * @param {GeoJSON} geojson
 * @param {Options} options
 */
export default function tokml(geojson: GeoJSON, options: Options): string;
export {};
