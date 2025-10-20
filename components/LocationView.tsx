import React, { useState, useEffect } from 'react';
import { LocationData } from '../types';
import { LocationIcon } from './Icons';

interface LocationViewProps {
  onClose: () => void;
}

const LocationView: React.FC<LocationViewProps> = ({ onClose }) => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocalização não é suportada pelo seu navegador.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
        setError(null);
      },
      (err) => {
        setError(`Erro ao obter localização: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const handleShowRoute = () => {
    if (location) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;
      window.open(url, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-800 border border-slate-700 rounded-xl p-6 text-white animate-fade-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold flex items-center gap-2"><LocationIcon className="w-6 h-6 text-slate-400" /> Visualizador de Localização</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
        </div>
        
        <div className="my-6 p-4 bg-slate-900 rounded-lg">
          {error && <p className="text-red-400">{error}</p>}
          {location ? (
            <div>
              <p className="text-slate-300">Latitude: <span className="font-mono text-white">{location.latitude.toFixed(6)}</span></p>
              <p className="text-slate-300">Longitude: <span className="font-mono text-white">{location.longitude.toFixed(6)}</span></p>
              <p className="text-slate-300">Precisão: <span className="font-mono text-white">{location.accuracy.toFixed(1)} metros</span></p>
            </div>
          ) : (
            <p className="text-slate-400">Obtendo localização em tempo real...</p>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleShowRoute}
            disabled={!location}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg transition-colors disabled:bg-slate-700/50 disabled:cursor-not-allowed"
          >
            Mostrar Trajeto
          </button>
          <button
            onClick={onClose}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationView;