"use client";

import React, { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { NEXT_PUBLIC_GOOGLE_MAPS_API_KEY } from "@repo/config/config";

interface RegionMapEditorProps {
  initialGeometry?: {
    type: string;
    coordinates: number[][][];
  } | null;
  onChange: (geometry: any) => void;
}

export default function RegionMapEditor({ initialGeometry, onChange }: RegionMapEditorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const listenerRefs = useRef<google.maps.MapsEventListener[]>([]);

  const [isLoaded, setIsLoaded] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pointsCount, setPointsCount] = useState(0);
  const [errorDetails, setErrorDetails] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showResults, setShowResults] = useState(false);

  const finishDrawingRef = useRef<(() => void) | null>(null);
  const cancelDrawingRef = useRef<(() => void) | null>(null);

  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const apiKey = NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  // Debug: Log API key info (first/last 4 chars only for security)
  useEffect(() => {
    if (apiKey) {
      const keyPreview = `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`;

    }
  }, [apiKey]);

  // 1. Script Loading - Using modern loader
  useEffect(() => {
    // Aggressively clean the API key: trim, remove quotes, and handle possible whitespace
    const cleanApiKey = apiKey?.toString().trim().replace(/['"“”]/g, '');

    if (!cleanApiKey || cleanApiKey === "undefined" || cleanApiKey === "null") {
      console.error("Google Maps API Key is missing or invalid string");
      setAuthError(true);
      setErrorDetails("API Key is missing or 'undefined'. Please check your .env file.");
      return;
    }

    // Suppress IntersectionObserver errors from Google Maps internals
    const originalError = console.error;
    console.error = (...args) => {
      if (
        typeof args[0] === 'string' &&
        (args[0].includes('IntersectionObserver') || args[0].includes('invalid-key-map-error'))
      ) {
        // Suppress these specific Google Maps internal errors if they are noise
        // But keep them for debugging if needed
        return;
      }
      originalError.apply(console, args);
    };

    // Handle Auth Failure BEFORE anything else
    (window as any).gm_authFailure = () => {
      const errorMsg = "Google Maps Authentication Failure - API Key Issue Detected";
      console.error(errorMsg);
      setErrorDetails(`InvalidKeyMapError - Your API key [${cleanApiKey.substring(0, 4)}...${cleanApiKey.substring(cleanApiKey.length - 4)}] is rejected. Check restrictions and Billing.`);
      setAuthError(true);
      setIsLoaded(false);
    };

    // Check if already loaded and working
    if ((window as any).google?.maps?.Map) {
      setIsLoaded(true);
      return;
    }

    const scriptId = "google-maps-native-script";
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement;

    // If script exists but API not ready, we might need to wait or it might be a failed load
    if (existingScript) {
      if ((window as any).google?.maps?.Map) {
        setIsLoaded(true);
      } else {
        // Script is there but maps isn't. Could be a race.
        const checkInterval = setInterval(() => {
          if ((window as any).google?.maps?.Map) {
            setIsLoaded(true);
            clearInterval(checkInterval);
          }
        }, 500);
        setTimeout(() => clearInterval(checkInterval), 5000);
      }
      return;
    }

    // Create the script element
    const loader = document.createElement("script");
    loader.id = scriptId;
    // Standard URL without redundant loading=async (handled by .async property)
    loader.src = `https://maps.googleapis.com/maps/api/js?key=${cleanApiKey}&libraries=places,drawing,geometry&v=weekly`;
    loader.async = true;
    loader.defer = true;

    loader.onload = () => {
      // Check for the Map object explicitly
      let retryCount = 0;
      const checkAvailability = () => {
        if ((window as any).google?.maps?.Map) {
          setIsLoaded(true);
        } else if (retryCount < 10) {
          retryCount++;
          setTimeout(checkAvailability, 200);
        } else {
          console.error("Google Maps script loaded but 'google.maps.Map' not found after retries");
          setAuthError(true);
          setErrorDetails("API loaded but Map objects not found. Check if another script is conflicting.");
        }
      };
      checkAvailability();
    };

    loader.onerror = (error) => {
      console.error("Failed to load Google Maps script tag:", error);
      setAuthError(true);
      setErrorDetails("Failed to fetch Google Maps script. Check your internet connection or DNS.");
      setIsLoaded(false);
    };

    document.head.appendChild(loader);

    return () => {
      // Don't remove script strictly to avoid re-loading on every render
      delete (window as any).gm_authFailure;
      console.error = originalError;
    };
  }, [apiKey]);

  // 2. Map Initialization with custom polygon drawing
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || authError) return;
    if (mapRef.current) return;

    const container = mapContainerRef.current;

    const initMap = () => {
      if (!container || mapRef.current) return;

      // Double check container has dimensions
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        console.warn("Container has no dimensions, retrying...");
        setTimeout(initMap, 100);
        return;
      }

      try {
        const center = { lat: 18.5204, lng: 73.8567 }; // Pune default

        const map = new google.maps.Map(container, {
          center,
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
          disableDefaultUI: false,
          zoomControl: true,
          // Disable features that might cause IntersectionObserver issues
          controlSize: 28,
        });

        mapRef.current = map;

        // Wait for idle event before proceeding
        google.maps.event.addListenerOnce(map, 'idle', () => {

          geocoderRef.current = new google.maps.Geocoder();
          placesServiceRef.current = new google.maps.places.PlacesService(map);
          autocompleteServiceRef.current = new google.maps.places.AutocompleteService();

          // Load initial geometry if present
          if (initialGeometry?.coordinates?.[0]) {
            loadInitialPolygon(map, initialGeometry.coordinates[0]);
          }
        });

      } catch (error) {
        console.error("Error initializing map:", error);
        setAuthError(true);
      }
    };

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      setTimeout(initMap, 50);
    });

    return () => {
      // Cleanup listeners
      listenerRefs.current.forEach(listener => {
        try {
          google.maps.event.removeListener(listener);
        } catch (e) {
          console.warn("Error removing listener:", e);
        }
      });
      listenerRefs.current = [];
    };
  }, [isLoaded, authError]);

  const loadInitialPolygon = (map: google.maps.Map, coordinates: number[][]) => {
    const path = coordinates.map(coord => ({
      lng: coord[0],
      lat: coord[1]
    }));

    // Remove closing coordinate if present
    if (path.length > 0 &&
      path[0].lat === path[path.length - 1].lat &&
      path[0].lng === path[path.length - 1].lng) {
      path.pop();
    }

    const polygon = new google.maps.Polygon({
      paths: path,
      fillColor: "#4CAF50",
      fillOpacity: 0.4,
      strokeColor: "#4CAF50",
      strokeWeight: 2,
      editable: true,
      draggable: true,
      map: map
    });

    polygonRef.current = polygon;

    // Re-center map
    if (path.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      path.forEach(point => bounds.extend(point));
      map.fitBounds(bounds);
    }

    // Add edit listeners
    addPolygonListeners(polygon);
  };

  const startDrawing = () => {
    if (!mapRef.current) return;

    setIsDrawing(true);
    setPointsCount(0);

    // Clear existing polygon
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }

    const map = mapRef.current;
    // Disable double-click zoom while drawing so double click finishes shape cleanly
    map.setOptions({ disableDoubleClickZoom: true });

    const path: google.maps.LatLng[] = [];
    let polygon: google.maps.Polygon | null = null;
    let activePolyline: google.maps.Polyline | null = null;

    // Temporary markers for vertices
    const markers: google.maps.Marker[] = [];

    const clickListener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;

      path.push(e.latLng);
      setPointsCount(path.length);

      const isFirstPoint = markers.length === 0;

      // Add marker
      const marker = new google.maps.Marker({
        position: e.latLng,
        map: map,
        draggable: false,
        zIndex: isFirstPoint ? 9999 : 100,
        title: isFirstPoint ? "Starting point — click here to close boundary" : undefined,
        cursor: isFirstPoint ? "pointer" : "default",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isFirstPoint ? 8 : 6,
          fillColor: isFirstPoint ? "#10B981" : "#2196F3",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        }
      });

      // Clicking first marker closes the polygon loop (standard GIS UX)
      if (isFirstPoint) {
        marker.addListener('click', (ev: any) => {
          if (ev?.stop) ev.stop();
          if (path.length >= 3) {
            finishDrawing();
          }
        });
      }

      markers.push(marker);

      if (path.length === 1) {
        // First point - show preview line
        activePolyline = new google.maps.Polyline({
          path: path,
          strokeColor: "#2196F3",
          strokeWeight: 2,
          strokeOpacity: 0.7,
          clickable: false, // Must not block map clicks
          map: map,
        });
      } else if (path.length === 2) {
        // Second point - create polygon preview
        if (activePolyline) {
          activePolyline.setMap(null);
          activePolyline = null;
        }

        polygon = new google.maps.Polygon({
          paths: path,
          fillColor: "#2196F3",
          fillOpacity: 0.3,
          strokeColor: "#2196F3",
          strokeWeight: 2,
          clickable: false, // Must not block map clicks
          editable: false,
          draggable: false,
          map: map,
        });
      } else {
        // Update polygon
        if (polygon) {
          polygon.setPath(path);
        }
      }
    });

    const dblClickListener = map.addListener('dblclick', (e: google.maps.MapMouseEvent) => {
      if (e?.stop) e.stop();
      // Remove duplicate point often introduced by the two clicks of dblclick
      if (path.length > 3) {
        const last = path[path.length - 1];
        const prev = path[path.length - 2];
        if (last && prev) {
          const latDiff = Math.abs(last.lat() - prev.lat());
          const lngDiff = Math.abs(last.lng() - prev.lng());
          if (latDiff < 0.0001 && lngDiff < 0.0001) {
            path.pop();
            const lastMarker = markers.pop();
            if (lastMarker) lastMarker.setMap(null);
            setPointsCount(path.length);
          }
        }
      }
      finishDrawing();
    });

    const mouseMoveListener = map.addListener('mousemove', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng || path.length === 0) return;

      if (activePolyline) {
        activePolyline.setPath([...path, e.latLng]);
      } else if (polygon) {
        polygon.setPath([...path, e.latLng]);
      }
    });

    const finishDrawing = () => {
      map.setOptions({ disableDoubleClickZoom: false });
      setIsDrawing(false);
      setPointsCount(0);
      finishDrawingRef.current = null;
      cancelDrawingRef.current = null;

      // Remove listeners
      google.maps.event.removeListener(clickListener);
      google.maps.event.removeListener(dblClickListener);
      google.maps.event.removeListener(mouseMoveListener);
      document.removeEventListener('keydown', escapeHandler);

      // Clean up temporary elements
      if (activePolyline) {
        activePolyline.setMap(null);
        activePolyline = null;
      }
      markers.forEach(m => m.setMap(null));
      markers.length = 0;

      if (path.length >= 3) {
        if (polygon) {
          polygon.setMap(null);
          polygon = null;
        }

        const finalPolygon = new google.maps.Polygon({
          paths: path,
          fillColor: "#4CAF50",
          fillOpacity: 0.4,
          strokeColor: "#4CAF50",
          strokeWeight: 2,
          editable: true,
          draggable: true,
          map: map,
        });

        polygonRef.current = finalPolygon;
        addPolygonListeners(finalPolygon);
        handlePolygonUpdate(finalPolygon);
      } else if (polygon) {
        polygon.setMap(null);
        polygonRef.current = null;
      }
    };

    const cancelDrawing = () => {
      map.setOptions({ disableDoubleClickZoom: false });
      setIsDrawing(false);
      setPointsCount(0);
      finishDrawingRef.current = null;
      cancelDrawingRef.current = null;

      google.maps.event.removeListener(clickListener);
      google.maps.event.removeListener(dblClickListener);
      google.maps.event.removeListener(mouseMoveListener);
      document.removeEventListener('keydown', escapeHandler);

      if (activePolyline) {
        activePolyline.setMap(null);
        activePolyline = null;
      }
      if (polygon) {
        polygon.setMap(null);
        polygon = null;
      }
      markers.forEach(m => m.setMap(null));
      markers.length = 0;
    };

    finishDrawingRef.current = finishDrawing;
    cancelDrawingRef.current = cancelDrawing;

    // Store escape key handler
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelDrawing();
      }
    };
    document.addEventListener('keydown', escapeHandler);
  };

  const addPolygonListeners = (polygon: google.maps.Polygon) => {
    // Clear old listeners
    listenerRefs.current.forEach(listener => {
      try {
        google.maps.event.removeListener(listener);
      } catch (e) {
        console.warn("Error removing listener:", e);
      }
    });
    listenerRefs.current = [];

    // Add new listeners
    const pathListener1 = google.maps.event.addListener(polygon.getPath(), 'insert_at', () => handlePolygonUpdate(polygon));
    const pathListener2 = google.maps.event.addListener(polygon.getPath(), 'remove_at', () => handlePolygonUpdate(polygon));
    const pathListener3 = google.maps.event.addListener(polygon.getPath(), 'set_at', () => handlePolygonUpdate(polygon));
    const dragListener = google.maps.event.addListener(polygon, 'dragend', () => handlePolygonUpdate(polygon));

    listenerRefs.current = [pathListener1, pathListener2, pathListener3, dragListener];
  };

  const handlePolygonUpdate = (polygon: google.maps.Polygon) => {
    const path = polygon.getPath();
    const coords: number[][] = [];

    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i);
      coords.push([point.lng(), point.lat()]);
    }

    if (coords.length < 3) return;

    // Close the polygon for GeoJSON
    coords.push([coords[0][0], coords[0][1]]);

    const geoJson = {
      type: "Polygon",
      coordinates: [coords]
    };
    onChange(geoJson);
  };

  const clearMap = () => {
    mapRef.current?.setOptions({ disableDoubleClickZoom: false });
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }

    // Clear listeners
    listenerRefs.current.forEach(listener => {
      try {
        google.maps.event.removeListener(listener);
      } catch (e) {
        console.warn("Error removing listener:", e);
      }
    });
    listenerRefs.current = [];

    onChange(null);
    setIsDrawing(false);
    setPointsCount(0);
  };

  if (!apiKey) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-amber-50 rounded-lg text-amber-700 p-4 border border-amber-200">
        <p className="font-semibold text-sm mb-1">API Key Missing</p>
        <p className="text-xs text-center">Please configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</p>
      </div>
    );
  }

  if (authError) {
    const keyPreview = apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : "Not found";

    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-red-50 text-red-600 p-6 rounded-lg border-2 border-red-200">
        <div className="text-6xl mb-4">🔑</div>
        <p className="font-bold text-lg mb-2 text-center">Google Maps API Key Error</p>
        <p className="text-sm mb-4 text-center max-w-md text-red-700">
          {errorDetails || "Authentication failed - Please check your configuration"}
        </p>

        {/* Diagnostic Info */}
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4 w-full max-w-2xl">
          <p className="text-xs font-bold text-yellow-800 mb-2">🔍 Diagnostic Information:</p>
          <div className="text-xs text-yellow-900 space-y-1 font-mono">
            <div>• API Key: {keyPreview}</div>
            <div>• Raw Length: {apiKey.length} chars</div>
            <div>• Cleaned Length: {apiKey?.toString().trim().replace(/['"“”]/g, '').length} chars {apiKey?.toString().trim().replace(/['"“”]/g, '').length === 39 ? "✓" : "⚠️ (Expected 39)"}</div>
            <div>• Detected Quotes: {(/['"“”]/.test(apiKey?.toString() || "")) ? "YES ⚠️ (Remove from .env)" : "No"}</div>
            <div>• Current Domain: {window.location.origin}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-red-200 w-full max-w-2xl mb-4">
          <p className="font-bold text-sm mb-3 text-red-800">⚠️ Common Issues & Solutions:</p>

          <div className="space-y-3 text-xs text-left">
            <div className="bg-red-50 p-3 rounded">
              <p className="font-bold text-red-700 mb-1">Issue #1: Billing Not Enabled</p>
              <p className="text-slate-700">Google Maps requires billing even for free tier.</p>
              <p className="text-blue-600 mt-1">
                → Go to: <a href="https://console.cloud.google.com/billing" target="_blank" className="underline">Billing Settings</a>
              </p>
            </div>

            <div className="bg-red-50 p-3 rounded">
              <p className="font-bold text-red-700 mb-1">Issue #2: Changes Not Propagated</p>
              <p className="text-slate-700">API key changes can take 5-10 minutes to take effect.</p>
              <p className="text-blue-600 mt-1">→ Wait 5-10 minutes after saving changes</p>
            </div>

            <div className="bg-red-50 p-3 rounded">
              <p className="font-bold text-red-700 mb-1">Issue #3: Wrong Domain Restriction</p>
              <p className="text-slate-700">Your API key must allow this domain:</p>
              <div className="bg-white p-2 mt-1 rounded border font-mono text-[10px]">
                {window.location.origin}/*
              </div>
              <p className="text-blue-600 mt-1">
                → Go to: <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="underline">API Credentials</a>
              </p>
            </div>

            <div className="bg-red-50 p-3 rounded">
              <p className="font-bold text-red-700 mb-1">Issue #4: API Not Enabled</p>
              <p className="text-slate-700">Maps JavaScript API must be explicitly enabled.</p>
              <p className="text-blue-600 mt-1">
                → Go to: <a href="https://console.cloud.google.com/apis/library/maps-backend.googleapis.com" target="_blank" className="underline">Enable Maps API</a>
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 w-full max-w-2xl mb-4">
          <p className="font-bold text-sm mb-2 text-blue-800">✅ Quick Fix Checklist:</p>
          <ol className="text-xs space-y-2 text-left text-blue-900">
            <li className="flex items-start gap-2">
              <span className="font-bold min-w-[20px]">1.</span>
              <span>Verify billing is enabled at <a href="https://console.cloud.google.com/billing" target="_blank" className="underline">console.cloud.google.com/billing</a></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold min-w-[20px]">2.</span>
              <span>Enable Maps JavaScript API at <a href="https://console.cloud.google.com/apis/library/maps-backend.googleapis.com" target="_blank" className="underline">APIs Library</a></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold min-w-[20px]">3.</span>
              <span>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="underline">API Credentials</a></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold min-w-[20px]">4.</span>
              <span>Click your API key → Set "Application restrictions" to <strong>"HTTP referrers"</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold min-w-[20px]">5.</span>
              <span>Add these referrers:</span>
            </li>
            <div className="ml-6 bg-white p-2 rounded border font-mono text-[10px] space-y-1">
              <div>http://localhost:*/*</div>
              <div>{window.location.origin}/*</div>
            </div>
            <li className="flex items-start gap-2">
              <span className="font-bold min-w-[20px]">6.</span>
              <span>Set "API restrictions" to <strong>"Don't restrict key"</strong> (for testing)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold min-w-[20px]">7.</span>
              <span>Click <strong>SAVE</strong> and wait 5-10 minutes</span>
            </li>
          </ol>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              window.location.reload();
            }}
            className="text-sm bg-red-600 text-white px-6 py-2.5 rounded-lg hover:bg-red-700 transition-colors font-semibold shadow-md"
          >
            🔄 Reload Page
          </button>
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-md"
          >
            ⚙️ Open Google Console
          </a>
          <a
            href="https://console.cloud.google.com/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-md"
          >
            💳 Check Billing
          </a>
        </div>
      </div>
    );
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query || !autocompleteServiceRef.current) {
      setSearchResults([]);
      return;
    }

    autocompleteServiceRef.current.getPlacePredictions(
      { input: query, componentRestrictions: { country: 'IN' } },
      (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSearchResults(predictions);
          setShowResults(true);
        } else {
          setSearchResults([]);
        }
      }
    );
  };

  const selectPlace = (place: google.maps.places.AutocompletePrediction) => {
    if (!placesServiceRef.current || !mapRef.current) return;

    setSearchQuery(place.description);
    setShowResults(false);

    placesServiceRef.current.getDetails(
      { placeId: place.place_id, fields: ['geometry'] },
      (details, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && details?.geometry?.location) {
          mapRef.current?.setCenter(details.geometry.location);
          mapRef.current?.setZoom(15);
        }
      }
    );
  };

  return (
    <div className="h-full w-full relative group flex flex-col" style={{ height: '500px', width: '100%' }}>
      {/* Search Overlay */}
      {isLoaded && !authError && (
        <div className="absolute top-3 left-3 z-[110] w-[300px]">
          <div className="relative">
            <input
              type="text"
              className="w-full px-4 py-2 text-sm border-2 border-primary/20 rounded-lg shadow-xl focus:outline-none focus:border-primary bg-white/95 backdrop-blur-sm transition-all"
              placeholder="🔍 Search for a city or area..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => searchQuery && setShowResults(true)}
            />
            {showResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-2xl max-h-60 overflow-y-auto z-[200]">
                {searchResults.map((result) => (
                  <div
                    key={result.place_id}
                    className="p-3 hover:bg-slate-50 cursor-pointer border-b last:border-0 transition-colors"
                    onClick={() => selectPlace(result)}
                  >
                    <p className="text-sm font-medium text-slate-700 truncate">{result.structured_formatting.main_text}</p>
                    <p className="text-[10px] text-slate-400 truncate">{result.structured_formatting.secondary_text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 z-[1000] rounded-lg">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
            <p className="text-sm text-slate-600 font-medium">Loading Google Maps...</p>
            <p className="text-xs text-slate-400">This may take a few seconds</p>
          </div>
        </div>
      )}

      <div
        ref={mapContainerRef}
        className="flex-1 w-full rounded-lg bg-slate-200"
        id="native-map-container"
        style={{
          width: '100%',
          position: 'relative',
          overflow: 'hidden'
        }}
      />

      {/* Control Buttons */}
      {isLoaded && !authError && (
        <div className="absolute top-3 right-3 flex items-center gap-2 z-[100]">
          {!polygonRef.current && !isDrawing && (
            <button
              type="button"
              onClick={startDrawing}
              className="bg-primary text-primary-foreground px-4 py-2.5 rounded-lg shadow-lg text-sm font-semibold hover:opacity-90 transition-all hover:shadow-xl cursor-pointer"
            >
              ✏️ Draw Boundary
            </button>
          )}

          {isDrawing && (
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg text-xs font-semibold">
                {pointsCount === 0
                  ? "Click map to start"
                  : `${pointsCount} point${pointsCount > 1 ? "s" : ""} added`}
              </div>
              <button
                type="button"
                onClick={() => finishDrawingRef.current?.()}
                disabled={pointsCount < 3}
                className={`px-3 py-2 rounded-lg shadow-lg text-xs font-bold transition-all ${
                  pointsCount >= 3
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
                title={pointsCount < 3 ? "Click at least 3 points on map" : "Click to finish boundary"}
              >
                ✓ Finish Boundary
              </button>
              <button
                type="button"
                onClick={() => cancelDrawingRef.current?.()}
                className="bg-white text-destructive hover:bg-red-50 border border-destructive/30 px-3 py-2 rounded-lg shadow-lg text-xs font-bold transition-all cursor-pointer"
              >
                ✕ Cancel
              </button>
            </div>
          )}

          {polygonRef.current && !isDrawing && (
            <>
              <button
                type="button"
                onClick={startDrawing}
                className="bg-primary text-primary-foreground px-3 py-2 rounded-lg shadow-lg text-sm font-semibold hover:opacity-90 transition-all cursor-pointer"
              >
                ↻ Redraw
              </button>
              <button
                type="button"
                onClick={clearMap}
                className="bg-white text-destructive px-3 py-2 rounded-lg shadow-lg text-sm font-semibold border-2 border-destructive/20 hover:bg-destructive/5 transition-all cursor-pointer"
              >
                🗑️ Clear
              </button>
            </>
          )}
        </div>
      )}

      {/* Help Text */}
      {isLoaded && !authError && (
        <div className="absolute bottom-3 left-3 bg-slate-900/90 text-white px-3 py-2 rounded-lg text-xs pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity max-w-sm backdrop-blur-sm border border-white/10 shadow-2xl">
          {!polygonRef.current && !isDrawing && "💡 Click 'Draw Boundary' to start defining your region"}
          {isDrawing && "🖱️ Click to add points. Click the first green point, double-click, or click 'Finish Boundary' when done."}
          {polygonRef.current && !isDrawing && "✨ Drag vertices to adjust boundaries or click 'Redraw' to start over"}
        </div>
      )}
    </div>
  );
}