import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// The live rider marker is a bike emoji (matches the mobile app's tracking map) rather than
// Leaflet's default pin icon - a delivery rider reads more clearly on the map than a generic
// location pin, and it's what actually moves, unlike the static store/destination markers below.
const bikeIcon = L.divIcon({
  html: '<div style="font-size:28px;line-height:28px;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.45))">\u{1F3CD}\u{FE0F}</div>',
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// Tweens the marker from its current position to the new fix instead of teleporting there
// (matches the mobile app's identical requestAnimationFrame easing), so the bike actually reads
// as "moving" across the map the way a live-navigation app does, rather than popping every poll.
const MOVE_DURATION_MS = 1200;
function animateMarkerTo(marker: L.Marker | null, to: L.LatLngExpression) {
  if (!marker) return;
  const start = marker.getLatLng();
  const end = L.latLng(to);
  if (start.equals(end)) return;
  const startTime = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - startTime) / MOVE_DURATION_MS);
    const eased = 1 - Math.pow(1 - t, 2);
    marker.setLatLng([
      start.lat + (end.lat - start.lat) * eased,
      start.lng + (end.lng - start.lng) * eased,
    ]);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

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
      liveMarkerRef.current = L.marker(livePos, { icon: bikeIcon, zIndexOffset: 1000 }).addTo(map);
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
      animateMarkerTo(liveMarkerRef.current, livePos);
      mapRef.current.panTo(livePos, { animate: true, duration: 1 });
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
