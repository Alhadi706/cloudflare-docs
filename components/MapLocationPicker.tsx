// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Map Location Picker Component
// Interactive map for selecting coordinates
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, X, Navigation } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapLocationPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationSelect: (latitude: number, longitude: number, locationLabel?: string) => void;
  initialLatitude?: number;
  initialLongitude?: number;
  title?: string;
}

export default function MapLocationPicker({
  isOpen,
  onClose,
  onLocationSelect,
  initialLatitude = 32.89,
  initialLongitude = 13.18,
  title = 'اختر الموقع على الخريطة'
}: MapLocationPickerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodedLabel, setGeocodedLabel] = useState<string | null>(null);

  // Reverse geocode whenever selectedLocation changes
  useEffect(() => {
    if (!selectedLocation) { setGeocodedLabel(null); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${selectedLocation.lat}&lon=${selectedLocation.lng}&format=json&accept-language=ar`,
          { headers: { 'Accept-Language': 'ar' } }
        );
        if (!cancelled && res.ok) {
          const geo = await res.json();
          if (!cancelled) setGeocodedLabel(geo.display_name || null);
        }
      } catch { /* ignore network errors */ }
    }, 600); // debounce 600ms
    return () => { cancelled = true; clearTimeout(timer); };
  }, [selectedLocation]);

  // Ensure component is mounted before rendering portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!isOpen || !mapContainer.current || map.current) return;

    // Initialize map
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          satellite: {
            type: 'raster',
            tiles: ['/tiles/satellite/{z}/{x}/{y}'],
            tileSize: 256,
            attribution: 'Digital Dashboard',
          },
        },
        layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
      },
      center: [initialLongitude, initialLatitude],
      zoom: 7
    });

    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Initialize marker if initial coordinates provided
    if (initialLatitude !== 32.89 || initialLongitude !== 13.18) {
      marker.current = new maplibregl.Marker({
        color: '#10b981',
        draggable: true
      })
        .setLngLat([initialLongitude, initialLatitude])
        .addTo(map.current);

      setSelectedLocation({ lat: initialLatitude, lng: initialLongitude });

      // Update location on drag
      marker.current.on('dragend', () => {
        if (marker.current) {
          const lngLat = marker.current.getLngLat();
          setSelectedLocation({ lat: lngLat.lat, lng: lngLat.lng });
        }
      });
    }

    // Click to add/move marker
    map.current.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      
      if (marker.current) {
        marker.current.setLngLat([lng, lat]);
      } else {
        marker.current = new maplibregl.Marker({
          color: '#10b981',
          draggable: true
        })
          .setLngLat([lng, lat])
          .addTo(map.current!);

        // Update location on drag
        marker.current.on('dragend', () => {
          if (marker.current) {
            const lngLat = marker.current.getLngLat();
            setSelectedLocation({ lat: lngLat.lat, lng: lngLat.lng });
          }
        });
      }

      setSelectedLocation({ lat, lng });
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      if (marker.current) {
        marker.current = null;
      }
    };
  }, [isOpen, initialLatitude, initialLongitude]);

  const handleConfirm = () => {
    if (selectedLocation) {
      onLocationSelect(selectedLocation.lat, selectedLocation.lng, geocodedLabel || undefined);
      onClose();
    }
  };

  const handleUseCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        
        if (map.current) {
          map.current.flyTo({ center: [longitude, latitude], zoom: 14 });
          
          if (marker.current) {
            marker.current.setLngLat([longitude, latitude]);
          } else {
            marker.current = new maplibregl.Marker({
              color: '#10b981',
              draggable: true
            })
              .setLngLat([longitude, latitude])
              .addTo(map.current);

            marker.current.on('dragend', () => {
              if (marker.current) {
                const lngLat = marker.current.getLngLat();
                setSelectedLocation({ lat: lngLat.lat, lng: lngLat.lng });
              }
            });
          }
          
          setSelectedLocation({ lat: latitude, lng: longitude });
        }
      }, (error) => {
        console.error('Error getting location:', error);
        alert('فشل الحصول على موقعك الحالي');
      });
    } else {
      alert('المتصفح لا يدعم تحديد الموقع الجغرافي');
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      
      {/* Modal Content */}
      <div className="relative bg-slate-900 rounded-2xl border border-slate-800 w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600/20 p-2 rounded-lg border border-emerald-500/50">
              <MapPin className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-100">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative bg-slate-950 min-h-[400px] overflow-hidden">
          <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
          
          {/* Location Info Overlay */}
          {selectedLocation && (
            <div className="absolute top-4 left-4 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-xl p-4 space-y-2 shadow-xl z-10">
              <div className="flex items-center gap-2 text-slate-300">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium">الموقع المحدد:</span>
              </div>
              <div className="space-y-1 text-xs font-mono">
                <div className="text-slate-400">
                  <span className="text-slate-500">خط العرض:</span>{' '}
                  <span className="text-emerald-400">{selectedLocation.lat.toFixed(6)}</span>
                </div>
                <div className="text-slate-400">
                  <span className="text-slate-500">خط الطول:</span>{' '}
                  <span className="text-emerald-400">{selectedLocation.lng.toFixed(6)}</span>
                </div>
              </div>
              {geocodedLabel && (
                <div className="mt-2 text-xs text-amber-300 max-w-[220px] leading-snug border-t border-slate-700 pt-2">
                  <span className="text-slate-500">العنوان: </span>{geocodedLabel.split(',').slice(0, 3).join(',')}
                </div>
              )}
            </div>
          )}

          {/* Current Location Button */}
          <button
            onClick={handleUseCurrentLocation}
            className="absolute bottom-4 right-4 bg-slate-900/95 backdrop-blur-sm border border-slate-700 hover:border-emerald-500/50 rounded-xl p-3 transition-colors shadow-xl z-10"
            title="استخدم موقعي الحالي"
          >
            <Navigation className="w-5 h-5 text-emerald-400" />
          </button>
        </div>

        {/* Instructions & Actions */}
        <div className="p-6 border-t border-slate-800 space-y-4 shrink-0">
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
            <p className="text-blue-200 text-sm">
              💡 انقر على الخريطة لتحديد الموقع، أو اسحب العلامة لتغيير الموقع
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleConfirm}
              disabled={!selectedLocation}
              className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
            >
              {geocodedLabel ? 'تأكيد الموقع (مع العنوان)' : 'تأكيد الموقع'}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
