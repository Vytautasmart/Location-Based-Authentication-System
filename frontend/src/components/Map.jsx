import React from 'react';
import { MapContainer, TileLayer, Circle, Popup, Marker } from 'react-leaflet';
import { useMapEvents } from 'react-leaflet/hooks';
import L from 'leaflet';

// Fix for default icon issue with webpack
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});


function LocationMarker({ selectedPosition, setSelectedPosition }) {
  const map = useMapEvents({
    click(e) {
      setSelectedPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  return selectedPosition === null ? null : (
    <Marker position={selectedPosition}></Marker>
  );
}

function Map({ zones, selectedPosition, setSelectedPosition }) {
  return (
    <MapContainer center={[51.505, -0.09]} zoom={13} style={{ height: '400px', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <LocationMarker selectedPosition={selectedPosition} setSelectedPosition={setSelectedPosition} />
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
            <button className="edit-btn" data-id={zone.id}>Edit</button>
            <button className="delete-btn" data-id={zone.id}>Delete</button>
          </Popup>
        </Circle>
      ))}
    </MapContainer>
  );
}

export default Map;
