/**
 * Tile layer configuration for the map styles panel. Defines available
 * raster tile providers (OSM, Carto, Hydda) with URLs and attributions.
 * Exports: TileStyle (interface), TILE_STYLES (array), TILE_MAP (lookup)
 */
export interface TileStyle {
  id: string
  name: string
  tileUrl: string
  attribution: string
}

export const TILE_STYLES: TileStyle[] = [
  {
    id: 'osm',
    name: 'OpenStreetMap',
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  {
    id: 'carto_light',
    name: 'Carto Light',
    tileUrl: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO',
  },
  {
    id: 'carto_dark',
    name: 'Carto Dark',
    tileUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO',
  },
  {
    id: 'hydda_full',
    name: 'Hydda Full',
    tileUrl: 'https://{s}.tile.openstreetmap.se/hydda/full/{z}/{x}/{y}.png',
    attribution: '&copy; OSM Sweden',
  },
]

export const TILE_MAP: Record<string, TileStyle> = Object.fromEntries(
  TILE_STYLES.map((s) => [s.id, s]),
)
