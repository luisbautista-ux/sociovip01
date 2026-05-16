"use client";

import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix para los iconos de Leaflet en Next.js
const customIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Componente para animar el cambio de vista
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 15, { duration: 2 });
  }, [center, map]);
  return null;
}

export function BusinessMapLeaflet({ address, businessName }: { address?: string; businessName: string }) {
  const [coords, setCoords] = useState<[number, number]>([-12.046374, -77.042793]); // Lima por defecto
  
  // Geocodificación gratuita usando Nominatim (OpenStreetMap)
  useEffect(() => {
    if (!address || address.length < 5) return;
    
    const fetchCoords = async () => {
      try {
        // Quitamos el hardcode de "Lima" para que busque en Chincha o cualquier otra ciudad
        const query = encodeURIComponent(address + ", Peru");
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
        const data = await res.json();
        
        if (data && data[0]) {
          setCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        }
      } catch (error) {
        console.error("Geocoding error:", error);
      }
    };
    
    fetchCoords();
  }, [address]);

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-6 left-6 z-[1000] p-4 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-xs">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <h3 className="text-white font-bold text-sm uppercase tracking-wider">Ubicación en vivo</h3>
        </div>
        <p className="text-white/80 text-xs font-medium leading-relaxed truncate">{address || "Buscando dirección..."}</p>
      </div>

      <MapContainer 
        center={coords} 
        zoom={13} 
        style={{ height: "100%", width: "100%", background: "#050510" }}
        zoomControl={false}
      >
        <ChangeView center={coords} />
        
        {/* Capa Dark Matter de CartoDB (Gratis y Premium look) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <Marker position={coords} icon={customIcon}>
          <Popup className="custom-popup">
            <div className="p-1">
              <h4 className="font-bold text-gray-900">{businessName}</h4>
              <p className="text-xs text-gray-600 mt-1">{address}</p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      {/* Overlays para integrar con el diseño */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]" />
      <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[#050510] to-transparent pointer-events-none" />
    </div>
  );
}
