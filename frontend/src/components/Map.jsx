// Import necessary libraries and components from React and Leaflet.
import React from 'react';
import { MapContainer, TileLayer, Circle, Popup, Marker } from 'react-leaflet';
import { useMapEvents } from 'react-leaflet/hooks';
import L from 'leaflet';

/**
 * The map component for displaying zones and selecting locations.
 * It uses React-Leaflet to render a map and handle user interactions.
 * 
 * @param {object} props - The component's props.
 * @param {Array} props.zones - A list of authorized zones to display on the map.
 * @param {object} props.selectedPosition - The currently selected position on the map.
 * @param {Function} props.setSelectedPosition - A function to update the selected position.
 * @returns {JSX.Element} The map component.
 */
// Fix for a common issue with Leaflet's default icon when using webpack.
delete L.Icon.Default.prototype._getIconUrl;

// Merge options to ensure Leaflet's default icon assets are loaded correctly.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

/**
 * A component that marks a location on the map when clicked.
 * It uses the `useMapEvents` hook to handle map click events.
 * 
 * @param {object} props - The component's props.
 * @param {object} props.selectedPosition - The currently selected position.
 * @param {Function} props.setSelectedPosition - A function to set the selected position.
 * @returns {JSX.Element|null} A marker at the selected position, or null if no position is selected.
 */
function LocationMarker({ selectedPosition, setSelectedPosition }) {
  const map = useMapEvents({
    click(e) {
      // When the map is clicked, update the selected position with the click coordinates.
      setSelectedPosition(e.latlng);
      // Fly to the new position on the map.
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  // Render a marker at the selected position if it exists, otherwise render nothing.
  return selectedPosition === null ? null : (
    <Marker position={selectedPosition}></Marker>
  );
}
/**
 * The main map component that displays zones and allows location selection.
 * 
 * @param {object} props - The component's props.
 * @param {Array} props.zones - A list of authorized zones to display.
 * @param {object} props.selectedPosition - The currently selected map position.
 * @param {Function} props.setSelectedPosition - A function to update the selected position.
 * @returns {JSX.Element} The map container with all its layers.
 */
function Map({ zones, selectedPosition, setSelectedPosition }) {
  return (
    // The main container for the map, centered on a default location.
    <MapContainer center={[51.505, -0.09]} zoom={13} style={{ height: '400px', width: '100%' }}>
      {/* The tile layer providing the map imagery from OpenStreetMap. */}
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {/* The location marker component for handling map clicks. */}
      <LocationMarker selectedPosition={selectedPosition} setSelectedPosition={setSelectedPosition} />
      {/* Map over the zones array to create a circle and popup for each zone. */}
      {zones.map((zone) => (
        <Circle
          key={zone.id}
          center={[zone.latitude, zone.longitude]}
          radius={zone.radius}
        >
          <Popup>
            <b>{zone.name}</b>
            <br />
            Radius: {zone.radius}m
            <br />
            {/* Buttons for editing and deleting zones. */}
            <button className="edit-btn" data-id={zone.id}>Edit</button>
            <button className="delete-btn" data-id={zone.id}>Delete</button>
          </Popup>
        </Circle>
      ))}
    </MapContainer>
  );
}

export default Map;
