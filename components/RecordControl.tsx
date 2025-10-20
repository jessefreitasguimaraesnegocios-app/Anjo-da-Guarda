import React from 'react';
import { ShieldIcon, AlertIcon, VideoIcon, AudioIcon, LocationIcon, LiveIcon } from './Icons';
import { ViewMode } from '../types';

interface RecordControlProps {
  onSetViewMode: (mode: ViewMode) => void;
  duration: number;
  onDurationChange: (duration: number) => void;
}

const RecordControl: React.FC<RecordControlProps> = ({ onSetViewMode, duration, onDurationChange }) => {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <ShieldIcon className="w-6 h-6 text-slate-400" />
        <h2 className="text-xl font-bold text-white">Help</h2>
      </div>
      
      <div className="flex justify-around items-center text-center mb-6 text-slate-300 border-y border-slate-700 py-3">
        <div>
          <p className="font-semibold text-white text-sm">PM</p>
          <p className="text-lg font-mono tracking-widest">190</p>
        </div>
        <div>
          <p className="font-semibold text-white text-sm">Bombeiros</p>
          <p className="text-lg font-mono tracking-widest">193</p>
        </div>
        <div>
          <p className="font-semibold text-white text-sm">SAMU</p>
          <p className="text-lg font-mono tracking-widest">192</p>
        </div>
      </div>


      <button
        onClick={() => onSetViewMode(ViewMode.RecordingPanic)}
        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-6 rounded-lg flex items-center justify-center gap-3 text-xl transition-transform transform hover:scale-105"
      >
        <AlertIcon className="w-7 h-7" />
        BOTÃO DE PÂNICO
      </button>
      
      <div className="my-6">
        <label htmlFor="duration-slider" className="flex justify-between items-center text-sm font-medium text-slate-300 mb-2">
            <span>Duração da Gravação Automática</span>
            <span className="font-bold text-white bg-slate-700 px-2 py-1 rounded">{duration} min</span>
        </label>
        <input
            id="duration-slider"
            type="range"
            min="1"
            max="60"
            step="1"
            value={duration}
            onChange={(e) => onDurationChange(Number(e.target.value))}
            className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-slate-500"
            aria-label="Duração da gravação em minutos"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ControlButton icon={<VideoIcon className="w-6 h-6" />} label="Gravar Vídeo" onClick={() => onSetViewMode(ViewMode.RecordingVideo)} />
        <ControlButton icon={<AudioIcon className="w-6 h-6" />} label="Gravar Áudio" onClick={() => onSetViewMode(ViewMode.RecordingAudio)} />
        <ControlButton icon={<LocationIcon className="w-6 h-6" />} label="Localização" onClick={() => onSetViewMode(ViewMode.Location)} />
        <ControlButton icon={<LiveIcon className="w-6 h-6" />} label="Modo Live" onClick={() => onSetViewMode(ViewMode.Live)} />
      </div>
    </div>
  );
};

interface ControlButtonProps {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
}

const ControlButton: React.FC<ControlButtonProps> = ({ icon, label, onClick }) => (
    <button
        onClick={onClick}
        className="bg-slate-700 border border-slate-600 hover:bg-slate-600 text-white rounded-lg p-4 flex flex-col items-center justify-center gap-2 transition-colors h-28"
    >
        {icon}
        <span className="text-sm text-center">{label}</span>
    </button>
)

export default RecordControl;