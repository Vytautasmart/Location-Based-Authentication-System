import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Circle, Popup, Marker, Rectangle, useMap } from 'react-leaflet';
import { useMapEvents } from 'react-leaflet/hooks';
import L from 'leaflet';

// Fix for Leaflet's default icon when using webpack.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Minimum zoom level at which the 3m grid becomes visible
const MIN_GRID_ZOOM = 18;

// --- Client-side grid math (mirrors backend w3wService.js) ---
const METERS_PER_DEG_LAT = 111320;
const CELL_SIZE = 3;
const LAT_STEP = CELL_SIZE / METERS_PER_DEG_LAT;

function lngStepAtRow(rowBaseLat) {
  const cosLat = Math.cos(rowBaseLat * Math.PI / 180);
  if (cosLat < 0.0001) return LAT_STEP;
  return CELL_SIZE / (METERS_PER_DEG_LAT * cosLat);
}

function coordsToGridCell(lat, lng) {
  const row = Math.floor(lat / LAT_STEP);
  const rowBaseLat = row * LAT_STEP;
  const lngStep = lngStepAtRow(rowBaseLat);
  const col = Math.floor(lng / lngStep);
  const south = row * LAT_STEP;
  const north = (row + 1) * LAT_STEP;
  const west = col * lngStep;
  const east = (col + 1) * lngStep;
  return {
    words: `${row}.${col}`,
    latitude: (south + north) / 2,
    longitude: (west + east) / 2,
    square: { southwest: { lat: south, lng: west }, northeast: { lat: north, lng: east } },
  };
}

function getAllCellsInBounds(south, west, north, east) {
  const rowStart = Math.floor(south / LAT_STEP);
  const rowEnd = Math.floor(north / LAT_STEP);
  const cells = [];
  const maxCells = 5000;
  for (let r = rowStart; r <= rowEnd && cells.length < maxCells; r++) {
    const rowBaseLat = r * LAT_STEP;
    const lngStep = lngStepAtRow(rowBaseLat);
    const colStart = Math.floor(west / lngStep);
    const colEnd = Math.floor(east / lngStep);
    for (let c = colStart; c <= colEnd && cells.length < maxCells; c++) {
      const s = r * LAT_STEP;
      const n = (r + 1) * LAT_STEP;
      const w = c * lngStep;
      const e = (c + 1) * lngStep;
      cells.push({
        words: `${r}.${c}`,
        latitude: (s + n) / 2,
        longitude: (w + e) / 2,
        square: { southwest: { lat: s, lng: w }, northeast: { lat: n, lng: e } },
      });
    }
  }
  return cells;
}

/**
 * Marks a location on the map when clicked (for circular zone mode).
 */
function LocationMarker({ selectedPosition, setSelectedPosition, gridActive }) {
  const map = useMapEvents({
    click(e) {
      // When grid is active and zoomed in enough, clicks select grid squares instead
      if (gridActive && map.getZoom() >= MIN_GRID_ZOOM) return;
      setSelectedPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  return selectedPosition === null ? null : (
    <Marker position={selectedPosition}></Marker>
  );
}

/**
 * Handles shift+drag box selection for grid squares.
 */
function DragSelectHandler({ onDragSelect }) {
  const map = useMap();
  const dragStart = useRef(null);
  const selectionRect = useRef(null);

  useEffect(() => {
    const container = map.getContainer();

    const onMouseDown = (e) => {
      if (!e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      map.dragging.disable();
      dragStart.current = map.mouseEventToLatLng(e);
      selectionRect.current = L.rectangle(
        [dragStart.current, dragStart.current],
        { color: '#e74c3c', weight: 2, fillOpacity: 0.15, dashArray: '6 3' }
      ).addTo(map);
    };

    const onMouseMove = (e) => {
      if (!dragStart.current) return;
      const current = map.mouseEventToLatLng(e);
      selectionRect.current.setBounds(L.latLngBounds(dragStart.current, current));
    };

    const onMouseUp = (e) => {
      if (!dragStart.current) return;
      map.dragging.enable();
      const end = map.mouseEventToLatLng(e);
      const bounds = L.latLngBounds(dragStart.current, end);
      if (selectionRect.current) {
        map.removeLayer(selectionRect.current);
        selectionRect.current = null;
      }
      dragStart.current = null;

      // Only treat as drag if the area is meaningful (> ~2px movement)
      const startPx = map.latLngToContainerPoint(bounds.getSouthWest());
      const endPx = map.latLngToContainerPoint(bounds.getNorthEast());
      if (Math.abs(startPx.x - endPx.x) < 3 && Math.abs(startPx.y - endPx.y) < 3) return;

      onDragSelect(bounds);
    };

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseup', onMouseUp);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseup', onMouseUp);
    };
  }, [map, onDragSelect]);

  return null;
}

/**
 * Renders the 3m grid overlay at high zoom levels.
 * Handles click-to-select and shift+drag-to-select squares.
 */
function W3WGridOverlay({ selectedSquares, onSquareClick, onBulkSelect }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });

  // Handle single click to select/deselect one square
  useMapEvents({
    click(e) {
      if (zoom < MIN_GRID_ZOOM) return;
      if (e.originalEvent.shiftKey) return;
      const { lat, lng } = e.latlng;
      const cell = coordsToGridCell(lat, lng);
      onSquareClick(cell);
    },
  });

  // Handle shift+drag box selection
  const handleDragSelect = useCallback((bounds) => {
    if (zoom < MIN_GRID_ZOOM) return;
    const cells = getAllCellsInBounds(
      bounds.getSouth(), bounds.getWest(),
      bounds.getNorth(), bounds.getEast()
    );
    if (cells.length > 0) onBulkSelect(cells);
  }, [zoom, onBulkSelect]);

  return (
    <>
      <DragSelectHandler onDragSelect={handleDragSelect} />
      {zoom < MIN_GRID_ZOOM && (
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: 'rgba(0,0,0,0.7)', color: '#fff',
          padding: '6px 14px', borderRadius: 6, fontSize: '0.85rem', pointerEvents: 'none',
        }}>
          Zoom in more to select grid squares (current: {zoom}, need: {MIN_GRID_ZOOM}+)
        </div>
      )}
      {selectedSquares.map((sq) => {
        const bounds = sq.square
          ? [[sq.square.southwest.lat, sq.square.southwest.lng], [sq.square.northeast.lat, sq.square.northeast.lng]]
          : [[sq.latitude - 0.0000135, sq.longitude - 0.0000135], [sq.latitude + 0.0000135, sq.longitude + 0.0000135]];
        return (
          <Rectangle
            key={sq.words}
            bounds={bounds}
            pathOptions={{ color: '#e74c3c', fillColor: '#e74c3c', fillOpacity: 0.4, weight: 2 }}
          >
            <Popup><b>{sq.words}</b></Popup>
          </Rectangle>
        );
      })}
    </>
  );
}

/**
 * Main map component that displays zones and allows location selection.
 * Supports both circular zones and microgrid zones.
 */
function Map({ zones, selectedPosition, setSelectedPosition, showZoneActions = true,
               enableGrid = false, selectedSquares = [], onSquareSelect }) {

  const handleSquareClick = (square) => {
    if (!onSquareSelect) return;
    const exists = selectedSquares.find(s => s.words === square.words);
    if (exists) {
      onSquareSelect(selectedSquares.filter(s => s.words !== square.words));
    } else {
      onSquareSelect([...selectedSquares, square]);
    }
  };

  const handleBulkSelect = useCallback((cells) => {
    if (!onSquareSelect) return;
    const existing = new Set(selectedSquares.map(s => s.words));
    const newCells = cells.filter(c => !existing.has(c.words));
    if (newCells.length > 0) {
      onSquareSelect([...selectedSquares, ...newCells]);
    }
  }, [selectedSquares, onSquareSelect]);

  // Filter zones by type for rendering
  const circularZones = zones.filter(z => z.type !== 'w3w' && z.latitude && z.longitude);
  const w3wZones = zones.filter(z => z.type === 'w3w');

  return (
    <MapContainer center={[51.505, -0.09]} zoom={13} style={{ height: '400px', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      {/* Location marker for pin drops (circular zone creation) */}
      <LocationMarker selectedPosition={selectedPosition} setSelectedPosition={setSelectedPosition} gridActive={enableGrid} />

      {/* Render circular zones */}
      {circularZones.map((zone) => (
        <Circle
          key={zone.id}
          center={[zone.latitude, zone.longitude]}
          radius={zone.radius}
          eventHandlers={!showZoneActions ? {
            click: (e) => {
              setSelectedPosition(e.latlng);
              e.originalEvent.stopPropagation();
            },
          } : {}}
        >
          {showZoneActions && (
            <Popup>
              <b>{zone.name}</b>
              <br />
              Radius: {zone.radius}m
              <br />
              <button className="edit-btn" data-id={zone.id}>Edit</button>
              <button className="delete-btn" data-id={zone.id}>Delete</button>
            </Popup>
          )}
        </Circle>
      ))}

      {/* Render existing grid zones as rectangles */}
      {w3wZones.map((zone) =>
        zone.squares?.map((sq) => {
          const bounds = [[sq.latitude - 0.0000135, sq.longitude - 0.0000135],
                          [sq.latitude + 0.0000135, sq.longitude + 0.0000135]];
          return (
            <Rectangle
              key={`${zone.id}-${sq.words}`}
              bounds={bounds}
              pathOptions={{ color: '#3498db', fillColor: '#3498db', fillOpacity: 0.3, weight: 1 }}
            >
              {showZoneActions && (
                <Popup>
                  <b>{zone.name}</b>
                  <br />
                  {sq.words}
                  <br />
                  <button className="delete-btn" data-id={zone.id}>Delete Zone</button>
                </Popup>
              )}
            </Rectangle>
          );
        })
      )}

      {/* Grid overlay for microgrid zone creation */}
      {enableGrid && (
        <W3WGridOverlay
          selectedSquares={selectedSquares}
          onSquareClick={handleSquareClick}
          onBulkSelect={handleBulkSelect}
        />
      )}
    </MapContainer>
  );
}

export default Map;
