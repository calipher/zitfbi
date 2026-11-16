import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  CollisionBehavior,
  InfoWindow,
  Map as GoogleMap,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { useBI } from '../../context/BIContext';
import { formatUsdCompact } from '../../utils/formatters';
import { Globe, Layers, MapPin, RotateCcw, X } from 'lucide-react';

interface CountryAggregate {
  country: string;
  exhibitors: number;
  visitors: number;
  tradeDeals: number;
  tradeValueUsd: number;
  revenueUsd: number;
  sectors: string[];
  lat: number;
  lng: number;
}

type RegionPreset = 'world' | 'africa' | 'europe_mena' | 'asia' | 'americas';
type GoogleMapTypeId = 'roadmap' | 'hybrid' | 'terrain';

const REGION_CAMERA: Record<
  RegionPreset,
  { label: string; center: { lat: number; lng: number }; zoom: number }
> = {
  world: { label: 'Global', center: { lat: 14, lng: 24 }, zoom: 2 },
  africa: { label: 'Africa', center: { lat: -8, lng: 25 }, zoom: 4 },
  europe_mena: { label: 'Europe & MENA', center: { lat: 40, lng: 24 }, zoom: 4 },
  asia: { label: 'Asia-Pacific', center: { lat: 24, lng: 96 }, zoom: 4 },
  americas: { label: 'Americas', center: { lat: 16, lng: -80 }, zoom: 3 },
};

// ZITF Showgrounds HQ coordinates (Bulawayo, Zimbabwe)
const ZITF_BULAWAYO_HQ = { lat: -20.1578, lng: 28.5806 };

// Geographic coordinates (lat, lng) for participating ZITF partner nations
const COUNTRY_COORDS: Record<string, { lat: number; lng: number }> = {
  zimbabwe: ZITF_BULAWAYO_HQ,
  'south africa': { lat: -30.5595, lng: 22.9375 },
  zambia: { lat: -13.1339, lng: 27.8493 },
  botswana: { lat: -22.3285, lng: 24.6849 },
  namibia: { lat: -22.9576, lng: 18.4904 },
  mozambique: { lat: -18.6657, lng: 35.5296 },
  malawi: { lat: -13.2543, lng: 34.3015 },
  tanzania: { lat: -6.369, lng: 34.8888 },
  kenya: { lat: -0.0236, lng: 37.9062 },
  uganda: { lat: 1.3733, lng: 32.2903 },
  rwanda: { lat: -1.9403, lng: 29.8739 },
  ethiopia: { lat: 9.145, lng: 40.4897 },
  nigeria: { lat: 9.082, lng: 8.6753 },
  ghana: { lat: 7.9465, lng: -1.0232 },
  egypt: { lat: 26.8206, lng: 30.8025 },
  morocco: { lat: 31.7917, lng: -7.0926 },
  algeria: { lat: 28.0339, lng: 1.6596 },
  angola: { lat: -11.2027, lng: 17.8739 },
  drc: { lat: -4.0383, lng: 21.7587 },
  'democratic republic of the congo': { lat: -4.0383, lng: 21.7587 },
  china: { lat: 35.8617, lng: 104.1954 },
  india: { lat: 20.5937, lng: 78.9629 },
  japan: { lat: 36.2048, lng: 138.2529 },
  'south korea': { lat: 35.9078, lng: 127.7669 },
  singapore: { lat: 1.3521, lng: 103.8198 },
  malaysia: { lat: 4.2105, lng: 101.9758 },
  indonesia: { lat: -0.7893, lng: 113.9213 },
  thailand: { lat: 15.87, lng: 100.9925 },
  vietnam: { lat: 14.0583, lng: 108.2772 },
  pakistan: { lat: 30.3753, lng: 69.3451 },
  'united arab emirates': { lat: 23.4241, lng: 53.8478 },
  uae: { lat: 23.4241, lng: 53.8478 },
  'saudi arabia': { lat: 23.8859, lng: 45.0792 },
  qatar: { lat: 25.3548, lng: 51.1839 },
  turkey: { lat: 38.9637, lng: 35.2433 },
  iran: { lat: 32.4279, lng: 53.688 },
  germany: { lat: 51.1657, lng: 10.4515 },
  'united kingdom': { lat: 55.3781, lng: -3.436 },
  uk: { lat: 55.3781, lng: -3.436 },
  france: { lat: 46.2276, lng: 2.2137 },
  italy: { lat: 41.8719, lng: 12.5674 },
  spain: { lat: 40.4637, lng: -3.7492 },
  netherlands: { lat: 52.1326, lng: 5.2913 },
  belgium: { lat: 50.5039, lng: 4.4699 },
  switzerland: { lat: 46.8182, lng: 8.2275 },
  sweden: { lat: 60.1282, lng: 18.6435 },
  poland: { lat: 51.9194, lng: 19.1451 },
  russia: { lat: 61.524, lng: 105.3188 },
  belarus: { lat: 53.7098, lng: 27.9534 },
  'united states': { lat: 37.0902, lng: -95.7129 },
  usa: { lat: 37.0902, lng: -95.7129 },
  canada: { lat: 56.1304, lng: -106.3468 },
  mexico: { lat: 23.6345, lng: -102.5528 },
  brazil: { lat: -14.235, lng: -51.9253 },
  argentina: { lat: -38.4161, lng: -63.6167 },
  chile: { lat: -35.6751, lng: -71.543 },
  australia: { lat: -25.2744, lng: 133.7751 },
  'new zealand': { lat: -40.9006, lng: 174.886 },
};

function getCountryCoords(countryName: string): { lat: number; lng: number } {
  const key = countryName.trim().toLowerCase();
  if (COUNTRY_COORDS[key]) return COUNTRY_COORDS[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) % 10000;
  }
  return {
    lat: (hash % 80) - 30,
    lng: ((hash * 7) % 240) - 90,
  };
}

/** Smoothly synchronizes Google Map camera with region presets and selectedCountry */
const MapCameraController: React.FC<{
  region: RegionPreset;
  selectedCountry: string;
  countryStats: CountryAggregate[];
}> = ({ region, selectedCountry, countryStats }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const preset = REGION_CAMERA[region];
    map.panTo(preset.center);
    map.setZoom(preset.zoom);
  }, [map, region]);

  useEffect(() => {
    if (!map) return;
    if (selectedCountry === 'all') {
      const preset = REGION_CAMERA[region];
      map.panTo(preset.center);
      map.setZoom(preset.zoom);
      return;
    }
    const target = countryStats.find(
      (c) => c.country.toLowerCase() === selectedCountry.trim().toLowerCase()
    );
    if (target) {
      map.panTo({ lat: target.lat, lng: target.lng });
      const currentZoom = map.getZoom() ?? 2;
      if (currentZoom < 4) {
        map.setZoom(4);
      }
    }
  }, [map, selectedCountry, countryStats, region]);

  return null;
};

/** Renders geodesic bilateral trade corridor arcs connecting each country to ZITF Bulawayo HQ */
const TradeCorridorsOverlay: React.FC<{
  countryStats: CountryAggregate[];
  selectedCountry: string;
  hoveredCountry: string | null;
}> = ({ countryStats, selectedCountry, hoveredCountry }) => {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');

  useEffect(() => {
    if (!map || !mapsLib) return;

    const polylines: InstanceType<typeof mapsLib.Polyline>[] = [];
    countryStats.forEach((c) => {
      if (c.country.trim().toLowerCase() === 'zimbabwe') return;
      const isSelected = selectedCountry.toLowerCase() === c.country.toLowerCase();
      const isHovered = hoveredCountry?.toLowerCase() === c.country.toLowerCase();
      const active = isSelected || isHovered;

      const line = new mapsLib.Polyline({
        path: [
          { lat: c.lat, lng: c.lng },
          ZITF_BULAWAYO_HQ,
        ],
        geodesic: true,
        strokeColor: active ? '#f59e0b' : '#0284c7',
        strokeOpacity: active ? 0.92 : 0.42,
        strokeWeight: active ? 3 : 1.5,
        map,
        zIndex: active ? 20 : 5,
      });
      polylines.push(line);
    });

    return () => {
      polylines.forEach((p) => p.setMap(null));
    };
  }, [map, mapsLib, countryStats, selectedCountry, hoveredCountry]);

  return null;
};

/** Individual interactive AdvancedMarker anchored to country InfoWindow */
const CountryMapMarker: React.FC<{
  stats: CountryAggregate;
  isSelected: boolean;
  isHovered: boolean;
  isInfoOpen: boolean;
  onSelect: (country: string) => void;
  onHover: (country: string | null) => void;
  onCloseInfo: () => void;
}> = ({
  stats,
  isSelected,
  isHovered,
  isInfoOpen,
  onSelect,
  onHover,
  onCloseInfo,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const isZim = stats.country.trim().toLowerCase() === 'zimbabwe';

  const bgClass = isSelected
    ? 'bg-amber-500 text-slate-950 border-white ring-2 ring-amber-300'
    : isZim
    ? 'bg-emerald-600 text-white border-white'
    : 'bg-[#0d6efd] text-white border-white';

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: stats.lat, lng: stats.lng }}
        title={`${stats.country}: ${stats.exhibitors} Exhibitors, ${stats.visitors} Visitors`}
        zIndex={isSelected ? 100 : isHovered ? 80 : isZim ? 50 : 20}
        collisionBehavior={CollisionBehavior.REQUIRED}
        onClick={() => onSelect(stats.country)}
      >
        <div
          onMouseEnter={() => onHover(stats.country)}
          onMouseLeave={() => onHover(null)}
          className={`px-2 py-0.5 rounded-full border shadow-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-transform ${bgClass} ${
            isSelected || isHovered ? 'scale-110' : ''
          }`}
        >
          <span className="truncate max-w-[110px]">{stats.country}</span>
          <span className="font-mono text-[10px] opacity-90 tabular-nums">
            ({stats.exhibitors + stats.visitors})
          </span>
        </div>
      </AdvancedMarker>

      {isInfoOpen && marker && (
        <InfoWindow
          anchor={marker}
          onCloseClick={onCloseInfo}
          maxWidth={270}
        >
          <div className="p-1 text-slate-800 font-sans text-xs min-w-[215px]">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5 mb-2">
              <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#0d6efd] shrink-0" />
                <span>{stats.country}</span>
              </div>
              {isZim && (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                  Host HQ
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] mb-2">
              <div>
                <div className="text-slate-500">Exhibitors</div>
                <div className="font-bold text-slate-900 tabular-nums">{stats.exhibitors}</div>
              </div>
              <div>
                <div className="text-slate-500">Visitors</div>
                <div className="font-bold text-slate-900 tabular-nums">{stats.visitors}</div>
              </div>
              <div>
                <div className="text-slate-500">Commercial Rev</div>
                <div className="font-bold text-slate-900 tabular-nums">
                  {formatUsdCompact(stats.revenueUsd)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">B2B Trade</div>
                <div className="font-bold text-emerald-700 tabular-nums">
                  {formatUsdCompact(stats.tradeValueUsd)}
                </div>
              </div>
            </div>

            {stats.sectors.length > 0 && (
              <div className="text-[10px] text-slate-500 border-t border-slate-100 pt-1.5 mb-2">
                <span className="font-semibold text-slate-700">Sectors: </span>
                {stats.sectors.slice(0, 3).join(', ')}
              </div>
            )}

            <button
              type="button"
              onClick={() => onSelect(stats.country)}
              className={`w-full py-1 px-2 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                  : 'bg-[#0d6efd] hover:bg-blue-700 text-white'
              }`}
            >
              {isSelected ? `Clear ${stats.country} Filter` : `Filter All 6 Pillars by ${stats.country}`}
            </button>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

/** Monitors Google Maps JS loading status inside <APIProvider> */
const GoogleMapCanvas: React.FC<{
  region: RegionPreset;
  mapTypeId: GoogleMapTypeId;
  countryStats: CountryAggregate[];
  selectedCountry: string;
  hoveredCountry: string | null;
  infoCountry: string | null;
  onSelectCountry: (country: string) => void;
  onHoverCountry: (country: string | null) => void;
  onCloseInfo: () => void;
}> = ({
  region,
  mapTypeId,
  countryStats,
  selectedCountry,
  hoveredCountry,
  infoCountry,
  onSelectCountry,
  onHoverCountry,
  onCloseInfo,
}) => {
  const status = useApiLoadingStatus();

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-600 p-6 text-center text-xs gap-2">
        <Globe className="w-6 h-6 text-slate-400" />
        <div className="font-semibold text-slate-800">
          Unable to load interactive Google Maps view
        </div>
        <p className="max-w-md text-slate-500">
          Select any participating country from the panel on the right or from the Country Filter dropdown above to filter all six strategic pillars.
        </p>
      </div>
    );
  }

  return (
    <GoogleMap
      mapId="DEMO_MAP_ID"
      defaultCenter={REGION_CAMERA.world.center}
      defaultZoom={REGION_CAMERA.world.zoom}
      mapTypeId={mapTypeId}
      gestureHandling="greedy"
      streetViewControl={false}
      fullscreenControl={true}
      mapTypeControl={false}
      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
      style={{ width: '100%', height: '100%' }}
    >
      <MapCameraController
        region={region}
        selectedCountry={selectedCountry}
        countryStats={countryStats}
      />
      <TradeCorridorsOverlay
        countryStats={countryStats}
        selectedCountry={selectedCountry}
        hoveredCountry={hoveredCountry}
      />
      {countryStats.map((stats) => {
        const isSelected = selectedCountry.toLowerCase() === stats.country.toLowerCase();
        const isHovered = hoveredCountry?.toLowerCase() === stats.country.toLowerCase();
        const isInfoOpen =
          (infoCountry?.toLowerCase() === stats.country.toLowerCase()) ||
          (infoCountry === null && isSelected);
        return (
          <CountryMapMarker
            key={stats.country}
            stats={stats}
            isSelected={isSelected}
            isHovered={isHovered}
            isInfoOpen={isInfoOpen}
            onSelect={onSelectCountry}
            onHover={onHoverCountry}
            onCloseInfo={onCloseInfo}
          />
        );
      })}
    </GoogleMap>
  );
};

export const GlobalParticipationMap: React.FC<{
  onClose?: () => void;
}> = ({ onClose }) => {
  const {
    exhibitors,
    visitors,
    transactions,
    tradeEngagements,
    selectedEditionId,
    selectedSector,
    geographicFilter,
    selectedCountry,
    setSelectedCountry,
    editions,
    authFetch,
  } = useBI();

  const [region, setRegion] = useState<RegionPreset>('world');
  const [mapTypeId, setMapTypeId] = useState<GoogleMapTypeId>('roadmap');
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [infoCountry, setInfoCountry] = useState<string | null>(null);
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    () => (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim()
  );
  const [keyChecked, setKeyChecked] = useState<boolean>(
    () => Boolean((import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim())
  );

  // Resolve runtime provisioned Maps API key from authenticated backend config when Vite build env is empty
  useEffect(() => {
    if (mapsApiKey) return;
    let active = true;
    authFetch('/api/maps/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.apiKey && typeof data.apiKey === 'string') {
          setMapsApiKey(data.apiKey.trim());
        }
      })
      .catch(() => {
        // graceful fallback handled below
      })
      .finally(() => {
        if (active) setKeyChecked(true);
      });
    return () => {
      active = false;
    };
  }, [mapsApiKey, authFetch]);

  const currentEdition = editions.find((e) => e.id === selectedEditionId);
  const editionTitle = currentEdition ? currentEdition.name : 'All Editions';

  // Aggregate live participation across Exhibitors, Visitors, Commercial & Trade Impact by Country
  // Using plain Record<string, ...> objects (avoiding JS Map constructor shadowing by @vis.gl Map)
  const countryStats = useMemo<CountryAggregate[]>(() => {
    const buckets: Record<
      string,
      {
        country: string;
        exhibitors: number;
        visitors: number;
        tradeDeals: number;
        tradeValueUsd: number;
        revenueUsd: number;
        sectors: Record<string, true>;
      }
    > = {};

    const matchesScope = (countryName: string) => {
      const clean = countryName.trim().toLowerCase();
      if (geographicFilter === 'local') return clean === 'zimbabwe';
      if (geographicFilter === 'international') return clean !== 'zimbabwe';
      return true;
    };

    const getBucket = (rawCountry: string) => {
      const clean = (rawCountry || '').trim();
      const key = clean.toLowerCase();
      if (!buckets[key]) {
        buckets[key] = {
          country: clean,
          exhibitors: 0,
          visitors: 0,
          tradeDeals: 0,
          tradeValueUsd: 0,
          revenueUsd: 0,
          sectors: {},
        };
      }
      return buckets[key];
    };

    const exhibitorCountryById: Record<string, string> = {};
    const exhibitorCountryByName: Record<string, string> = {};

    exhibitors.forEach((e) => {
      if (e.country) {
        exhibitorCountryById[e.id] = e.country.trim();
        exhibitorCountryByName[e.companyName.trim().toLowerCase()] = e.country.trim();
      }
      if (selectedEditionId !== 'all' && e.editionId !== selectedEditionId) return;
      if (selectedSector !== 'all' && e.sector !== selectedSector && e.industry !== selectedSector) return;
      if (!e.country?.trim() || !matchesScope(e.country)) return;
      const b = getBucket(e.country);
      b.exhibitors += 1;
      if (e.sector) b.sectors[e.sector] = true;
    });

    visitors.forEach((v) => {
      if (selectedEditionId !== 'all' && v.editionId !== selectedEditionId) return;
      if (!v.country?.trim() || !matchesScope(v.country)) return;
      if (selectedSector !== 'all' && v.industry !== selectedSector) return;
      const b = getBucket(v.country);
      b.visitors += 1;
      if (v.industry) b.sectors[v.industry] = true;
    });

    transactions.forEach((tx) => {
      if (selectedEditionId !== 'all' && tx.editionId !== selectedEditionId) return;
      if (selectedSector !== 'all' && tx.sector !== selectedSector) return;
      const country =
        (tx.exhibitorId && exhibitorCountryById[tx.exhibitorId]) ||
        exhibitorCountryByName[tx.clientName.trim().toLowerCase()] ||
        'Zimbabwe';
      if (!matchesScope(country)) return;
      const b = getBucket(country);
      b.revenueUsd += Number(tx.amountUsd) || 0;
    });

    tradeEngagements.forEach((te) => {
      if (selectedEditionId !== 'all' && te.editionId !== selectedEditionId) return;
      if (selectedSector !== 'all' && te.industry !== selectedSector) return;
      const val = Number(te.estimatedValueUsd) || 0;
      const buyer = te.buyerCountry?.trim();
      const supplier = te.supplierCountry?.trim();

      if (buyer && matchesScope(buyer)) {
        const bb = getBucket(buyer);
        bb.tradeDeals += 1;
        bb.tradeValueUsd += val;
      }
      if (supplier && supplier.toLowerCase() !== buyer?.toLowerCase() && matchesScope(supplier)) {
        const sb = getBucket(supplier);
        sb.tradeDeals += 1;
        sb.tradeValueUsd += val;
      }
    });

    return Object.values(buckets)
      .map((entry) => {
        const coords = getCountryCoords(entry.country);
        return {
          country: entry.country,
          exhibitors: entry.exhibitors,
          visitors: entry.visitors,
          tradeDeals: entry.tradeDeals,
          tradeValueUsd: entry.tradeValueUsd,
          revenueUsd: entry.revenueUsd,
          sectors: Object.keys(entry.sectors),
          lat: coords.lat,
          lng: coords.lng,
        };
      })
      .sort(
        (a, b) =>
          b.exhibitors + b.visitors - (a.exhibitors + a.visitors) ||
          b.tradeValueUsd - a.tradeValueUsd
      );
  }, [
    exhibitors,
    visitors,
    transactions,
    tradeEngagements,
    selectedEditionId,
    selectedSector,
    geographicFilter,
  ]);

  const focusedStats = useMemo(() => {
    const target = hoveredCountry || (selectedCountry !== 'all' ? selectedCountry : null);
    if (!target) return null;
    return countryStats.find((c) => c.country.toLowerCase() === target.toLowerCase()) || null;
  }, [hoveredCountry, selectedCountry, countryStats]);

  const handleToggleCountry = useCallback(
    (country: string) => {
      if (selectedCountry.toLowerCase() === country.toLowerCase()) {
        setSelectedCountry('all');
        setInfoCountry(null);
      } else {
        setSelectedCountry(country);
        setInfoCountry(country);
      }
    },
    [selectedCountry, setSelectedCountry]
  );

  return (
    <section
      aria-label="Global Country Participation Map"
      className="bg-white border border-slate-200 rounded-md overflow-hidden mb-5"
    >
      {/* AdminLTE Card Header */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="w-4 h-4 text-[#0d6efd] shrink-0" />
          <h2 className="text-sm font-semibold text-slate-800 truncate">
            Global Participation &amp; Country Filter Map ({editionTitle})
          </h2>
          <span className="text-xs font-mono text-slate-500 hidden sm:inline tabular-nums">
            · {countryStats.length} Countries
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Map Type Toggle */}
          <div className="inline-flex border border-slate-200 rounded overflow-hidden text-[11px]">
            {(
              [
                { id: 'roadmap', label: 'Map' },
                { id: 'hybrid', label: 'Satellite' },
                { id: 'terrain', label: 'Terrain' },
              ] as { id: GoogleMapTypeId; label: string }[]
            ).map((opt, idx) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMapTypeId(opt.id)}
                className={`px-2 py-1 font-medium cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  idx > 0 ? 'border-l border-slate-200' : ''
                } ${
                  mapTypeId === opt.id
                    ? 'bg-[#343a40] text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {idx === 0 && <Layers className="w-3 h-3" />}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Region Camera Presets */}
          <div className="inline-flex border border-slate-200 rounded overflow-hidden text-[11px]">
            {(Object.keys(REGION_CAMERA) as RegionPreset[]).map((key, idx) => (
              <button
                key={key}
                type="button"
                onClick={() => setRegion(key)}
                className={`px-2 py-1 font-medium cursor-pointer whitespace-nowrap ${
                  idx > 0 ? 'border-l border-slate-200' : ''
                } ${
                  region === key
                    ? 'bg-[#0d6efd] text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {REGION_CAMERA[key].label}
              </button>
            ))}
          </div>

          {selectedCountry !== 'all' && (
            <button
              type="button"
              onClick={() => {
                setSelectedCountry('all');
                setInfoCountry(null);
              }}
              className="flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[11px] font-semibold cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear: {selectedCountry}</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              title="Hide Global Map"
              aria-label="Hide Global Map"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* AdminLTE Card Body: 8-Col Live Google Map + 4-Col Participating Countries Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left 8 Cols: Interactive Google Maps Canvas */}
        <div className="lg:col-span-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-200">
          <div className="h-[340px] sm:h-[380px] w-full relative bg-slate-100">
            {!keyChecked ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                Loading Google Maps Platform...
              </div>
            ) : !mapsApiKey ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-600 p-6 text-center text-xs gap-2">
                <Globe className="w-6 h-6 text-slate-400" />
                <div className="font-semibold text-slate-800">
                  Google Maps API key not detected in environment
                </div>
                <p className="max-w-md text-slate-500">
                  Configure <code>VITE_GOOGLE_MAPS_API_KEY</code> or restart the preview server after provisioning to enable live Google Maps tiles. Meanwhile, click any country on the right to filter all six strategic pillars.
                </p>
              </div>
            ) : (
              <APIProvider
                apiKey={mapsApiKey}
                libraries={['marker', 'maps']}
                language="en"
                region="ZW"
              >
                <GoogleMapCanvas
                  region={region}
                  mapTypeId={mapTypeId}
                  countryStats={countryStats}
                  selectedCountry={selectedCountry}
                  hoveredCountry={hoveredCountry}
                  infoCountry={infoCountry}
                  onSelectCountry={handleToggleCountry}
                  onHoverCountry={setHoveredCountry}
                  onCloseInfo={() => setInfoCountry(null)}
                />
              </APIProvider>
            )}
          </div>

          {/* Bottom Map Telemetry Strip */}
          <div className="px-4 py-2 bg-[#343a40] border-t border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200">
            {focusedStats ? (
              <>
                <div className="flex items-center gap-2 font-semibold text-amber-300">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>{focusedStats.country}</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums flex-wrap">
                  <span>{focusedStats.exhibitors} Exhibitors</span>
                  <span className="text-slate-500">·</span>
                  <span>{focusedStats.visitors} Visitors</span>
                  <span className="text-slate-500">·</span>
                  <span>{formatUsdCompact(focusedStats.revenueUsd)} Commercial</span>
                  <span className="text-slate-500">·</span>
                  <span>{formatUsdCompact(focusedStats.tradeValueUsd)} B2B Trade</span>
                </div>
              </>
            ) : (
              <>
                <span className="text-slate-300">
                  ZITF HQ: Bulawayo, Zimbabwe · Click any country marker to filter all six pillars
                </span>
                <span className="font-mono text-[11px] text-sky-300 tabular-nums">
                  {countryStats.reduce((s, c) => s + c.exhibitors, 0)} Exhibitors ·{' '}
                  {countryStats.reduce((s, c) => s + c.visitors, 0)} Visitors
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right 4 Cols: Interactive Country Breakdown List */}
        <div className="lg:col-span-4 flex flex-col bg-white max-h-[416px]">
          <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Participating Countries</span>
            <span>Exh · Vis · Trade</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {countryStats.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No country participation records match the current filters.
              </div>
            ) : (
              countryStats.map((c) => {
                const isSelected = selectedCountry.toLowerCase() === c.country.toLowerCase();
                return (
                  <button
                    key={c.country}
                    type="button"
                    onClick={() => handleToggleCountry(c.country)}
                    onMouseEnter={() => setHoveredCountry(c.country)}
                    onMouseLeave={() => setHoveredCountry(null)}
                    className={`w-full px-3.5 py-2 flex items-center justify-between text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-sky-50 text-[#0d6efd] font-semibold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="truncate">{c.country}</div>
                      {c.sectors.length > 0 && (
                        <div className="text-[10px] text-slate-400 truncate">
                          {c.sectors.slice(0, 2).join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="font-mono text-[11px] tabular-nums shrink-0 text-right">
                      <span className="font-semibold text-slate-900">{c.exhibitors}</span>
                      <span className="text-slate-300 mx-1">/</span>
                      <span>{c.visitors}</span>
                      <span className="text-slate-300 mx-1">/</span>
                      <span className="text-emerald-700">{formatUsdCompact(c.tradeValueUsd)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
