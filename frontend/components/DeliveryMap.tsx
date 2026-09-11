import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Leaflet's default marker icon is loaded via a relative path baked into its own CSS, which
// breaks once bundled - this points it at the actual asset URLs Vite resolves instead.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export interface MapPoint {
  lat: number;
  lng: number;
}

interface DeliveryMapProps {
  /** The moving marker - a rider's own position, on either the customer's or the rider's map. */
  livePosition: MapPoint;
  /** Fades the live marker when the position is stale/not currently being shared. */
  isLive: boolean;
  /** Optional static reference points - shown once on mount, with a dashed line between them if
   * both are present ("the way he's going to pass on"). Neither is geocoded here; callers pass
   * already-resolved coordinates or omit them. */
  store?: MapPoint | null;
  destination?: MapPoint | null;
  className?: string;
}

const DeliveryMap: React.FC<DeliveryMapProps> = ({ livePosition, isLive, store, destination, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const liveMarkerRef = useRef<L.Marker | null>(null);

  // The map itself, and the store/destination markers + route line, are created once on mount -
  // recreating a Leaflet map (or re-adding static markers) on every live-position update would
  // both flicker and leak the previous instances. Only the live marker moves after that.
  useEffect(() => {
    if (!containerRef.current) return;
    const livePos: L.LatLngExpression = [livePosition.lat, livePosition.lng];

    if (!mapRef.current) {
      const map = L.map(containerRef.current).setView(livePos, 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      liveMarkerRef.current = L.marker(livePos).addTo(map);
      mapRef.current = map;

      const bounds: L.LatLngExpression[] = [livePos];
      if (store) {
        L.circleMarker([store.lat, store.lng], { radius: 8, color: '#065f46', fillColor: '#10b981', fillOpacity: 1, weight: 2 })
          .addTo(map)
          .bindTooltip('Store');
        bounds.push([store.lat, store.lng]);
      }
      if (destination) {
        L.circleMarker([destination.lat, destination.lng], { radius: 8, color: '#9a3412', fillColor: '#f97316', fillOpacity: 1, weight: 2 })
          .addTo(map)
          .bindTooltip('Delivery Address');
        bounds.push([destination.lat, destination.lng]);
      }
      if (store && destination) {
        L.polyline([[store.lat, store.lng], [destination.lat, destination.lng]], {
          color: '#2563eb',
          weight: 3,
          dashArray: '8, 6',
          opacity: 0.7,
        }).addTo(map);
      }
      if (bounds.length > 1) {
        map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [30, 30] });
      }
    } else {
      liveMarkerRef.current?.setLatLng(livePos);
      mapRef.current.panTo(livePos);
    }
    // Faded marker = last known spot, not a live position.
    liveMarkerRef.current?.setOpacity(isLive ? 1 : 0.55);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePosition.lat, livePosition.lng, isLive]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className={className ?? 'w-full h-64 sm:h-80 rounded-xl overflow-hidden'} />;
};

export default DeliveryMap;
