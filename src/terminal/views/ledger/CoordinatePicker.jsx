import { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icon (leaflet CSS issue with bundlers)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function ClickHandler({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function CoordinatePicker({ lat, lon, onSelect, onClose }) {
  const center = lat && lon ? [lat, lon] : [48.2, 16.37];
  const hasMarker = lat && lon;

  return (
    <div className="relative border border-teal-900/30 rounded-sm overflow-hidden" style={{ height: 280 }}>
      <MapContainer
        center={center} zoom={hasMarker ? 10 : 3}
        style={{ height: '100%', width: '100%', background: '#0a0a0f' }}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        <ClickHandler onSelect={onSelect} />
        {hasMarker && <Marker position={[lat, lon]} />}
      </MapContainer>
      <button
        onClick={onClose}
        className="absolute top-2 right-2 z-[1000] text-[9px] font-mono text-teal-500 bg-black/80 border border-teal-900/40 px-2 py-1 rounded-sm hover:text-teal-300 transition-colors"
      >
        CLOSE MAP
      </button>
    </div>
  );
}
