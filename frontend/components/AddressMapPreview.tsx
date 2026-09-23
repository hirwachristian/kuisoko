import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface AddressMapPreviewProps {
  lat: number;
  lng: number;
  label: string;
  className?: string;
}

// A small, honest "here's where this is" map - one static pin, no live tracking. DeliveryMap.tsx
// (this app's other Leaflet wrapper) always renders a moving bike-emoji marker since it's built
// for tracking a rider in transit, which is the wrong metaphor for a saved address, so this is its
// own much simpler mount instead of stretching that component to cover both.
const AddressMapPreview: React.FC<AddressMapPreviewProps> = ({ lat, lng, label, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false }).setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    L.circleMarker([lat, lng], { radius: 9, color: '#065f46', fillColor: '#10b981', fillOpacity: 1, weight: 2 })
      .addTo(map)
      .bindTooltip(label);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Only the initial coordinates matter - a different address entirely gets a fresh component
    // instance (keyed by address id where this is rendered), not a live-updating one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className={className ?? 'w-full h-56 sm:h-64 rounded-xl overflow-hidden'} />;
};

export default AddressMapPreview;
