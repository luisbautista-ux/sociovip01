"use client";

import React, { useEffect, useState } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import type { Business } from "@/lib/types";

const API_KEY = "AIzaSyBZKUT5tCbpDDZsxGSiz-_SC3HmafgKbh4";

const mapStyles = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
];

// Componente para manejar la ruta y los marcadores
function Directions({ businesses }: { businesses: Business[] }) {
  const map = useMap();
  const routesLibrary = useMapsLibrary("routes");
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);

  useEffect(() => {
    if (!routesLibrary || !map) return;
    const renderer = new routesLibrary.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: "#8b5cf6",
        strokeWeight: 5,
        strokeOpacity: 0.8
      }
    });
    setDirectionsRenderer(renderer);
    return () => renderer.setMap(null);
  }, [routesLibrary, map]);

  useEffect(() => {
    if (!directionsRenderer || !routesLibrary || businesses.length < 2) {
      if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
      return;
    }

    const directionsService = new routesLibrary.DirectionsService();
    const waypoints = businesses.slice(1, -1).map(b => ({
      location: b.publicAddress + ", Peru",
      stopover: true
    }));

    directionsService.route(
      {
        origin: businesses[0].publicAddress + ", Peru",
        destination: businesses[businesses.length - 1].publicAddress + ", Peru",
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          directionsRenderer.setDirections(result);
        }
      }
    );
  }, [directionsRenderer, routesLibrary, businesses]);

  return null;
}

// Componente para un marcador personalizado con logo
function CustomBusinessMarker({ business, panToMarker = false }: { business: Business; panToMarker?: boolean }) {
  const map = useMap();
  const geocodingLib = useMapsLibrary("geocoding");
  const [coords, setCoords] = useState<google.maps.LatLngLiteral | null>(null);

  useEffect(() => {
    const address = business.publicAddress || business.address;
    if (!geocodingLib || !address) return;
    const geocoder = new geocodingLib.Geocoder();
    geocoder.geocode({ address: address + ", Peru" }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        const loc = results[0].geometry.location;
        const newCoords = { lat: loc.lat(), lng: loc.lng() };
        setCoords(newCoords);
        if (panToMarker && map) {
          map.panTo(newCoords);
          map.setZoom(16);
        }
      }
    });
  }, [geocodingLib, business, map, panToMarker]);

  return coords ? (
    <AdvancedMarker position={coords} title={business.name}>
      <div className="relative group flex flex-col items-center select-none cursor-pointer">
        {/* Contenedor del Logo */}
        <div className="w-10 h-10 rounded-full bg-white border-2 border-primary/80 shadow-[0_4px_12px_rgba(5,50,100,0.3)] flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:scale-110 group-hover:border-secondary">
          {business.logoUrl ? (
            <img 
              src={business.logoUrl} 
              alt={business.name} 
              className="w-full h-full object-contain p-0.5"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white text-[10px] font-black">
              {business.name?.substring(0, 2).toUpperCase() || "SV"}
            </div>
          )}
        </div>
        {/* Puntero */}
        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-primary/80 -mt-[1px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)] group-hover:border-t-secondary transition-colors" />
        
        {/* Etiqueta flotante con nombre */}
        <div className="absolute top-11 whitespace-nowrap bg-slate-950/90 text-white text-[8px] font-black uppercase tracking-wider py-1 px-2.5 rounded-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-xl pointer-events-none">
          {business.name}
        </div>
      </div>
    </AdvancedMarker>
  ) : null;
}

export function BusinessMapGoogle({ businesses, primaryAddress }: { businesses: Business[]; primaryAddress?: string }) {
  const defaultCenter = { lat: -12.046374, lng: -77.042793 };

  const handleStartTrip = () => {
    if (businesses.length === 0) return;
    
    const origin = "My+Location";
    const destination = encodeURIComponent(businesses[businesses.length - 1].publicAddress + ", Peru");
    
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    
    if (businesses.length > 1) {
      // Si hay más de un negocio, el último es el destino y los anteriores son waypoints
      // Pero si queremos que el primero sea la primera parada, los incluimos todos como waypoints
      const waypoints = businesses.slice(0, -1).map(b => encodeURIComponent(b.publicAddress + ", Peru")).join('|');
      url += `&waypoints=${waypoints}`;
    }
    
    window.open(url, '_blank');
  };

  return (
    <div className="w-full h-full relative">
      {/* Header Info */}
      <div className="absolute top-6 left-6 z-10 p-4 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-xs">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <h3 className="text-white font-bold text-sm uppercase tracking-wider">Itinerario en Vivo</h3>
        </div>
        <p className="text-white/80 text-[10px] font-medium leading-relaxed">
          {businesses.length > 1 
            ? `${businesses.length} paradas detectadas` 
            : primaryAddress || "Localizando..."}
        </p>
      </div>

      {/* Botón Iniciar Viaje */}
      {businesses.length > 0 && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 w-[80%] max-w-xs">
          <button 
            onClick={handleStartTrip}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-[0_20px_40px_rgba(37,99,235,0.3)] transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 border border-white/10 backdrop-blur-md"
          >
            <div className="p-1.5 bg-white/20 rounded-lg">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z"/></svg>
            </div>
            INICIAR VIAJE AHORA
          </button>
        </div>
      )}

      <APIProvider apiKey={API_KEY}>
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={13}
          styles={mapStyles}
          disableDefaultUI={true}
          mapId={"bf50a87347b749ee"}
        >
          {businesses.length > 1 ? (
            <>
              <Directions businesses={businesses} />
              {businesses.map((b, idx) => (
                <CustomBusinessMarker key={b.id || idx} business={b} panToMarker={false} />
              ))}
            </>
          ) : (
            businesses[0] && <CustomBusinessMarker business={businesses[0]} panToMarker={true} />
          )}
        </Map>
      </APIProvider>

      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_80px_rgba(0,0,0,0.6)]" />
      <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-[#050510] to-transparent pointer-events-none" />
    </div>
  );
}
