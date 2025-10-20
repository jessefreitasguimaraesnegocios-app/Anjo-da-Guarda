import React from 'react';
import { Evidence, EvidenceType } from '../types';
import { VideoIcon, AudioIcon, LocationIcon, ClockIcon, HashIcon, DownloadIcon, TrashIcon, AlertIcon } from './Icons';
import { DOWNLOAD_PRICES } from '../constants';

interface EvidenceItemProps {
  evidence: Evidence;
  onDownload: (evidence: Evidence) => void;
  onDelete: (id: string) => void;
}

const EvidenceItem: React.FC<EvidenceItemProps> = ({ evidence, onDownload, onDelete }) => {

  const getIcon = () => {
    switch (evidence.type) {
      case EvidenceType.Video:
        return <VideoIcon className="w-5 h-5 text-slate-400" />;
      case EvidenceType.Audio:
        return <AudioIcon className="w-5 h-5 text-slate-400" />;
      case EvidenceType.Location:
        return <LocationIcon className="w-5 h-5 text-slate-400" />;
      case EvidenceType.Panic:
        return <AlertIcon className="w-5 h-5 text-red-400" />;
      default:
        return null;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).replace(',', '');
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          {getIcon()}
          <h3 className="text-white font-bold text-lg">{evidence.type} - {formatDate(evidence.timestamp)}</h3>
        </div>
        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${evidence.type === EvidenceType.Panic ? 'bg-red-500/20 text-red-300' : 'bg-slate-700 text-slate-300'}`}>
          {evidence.type}
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-slate-300 text-sm mb-6">
        <div className="flex items-center gap-2">
            <ClockIcon className="w-4 h-4 text-slate-500"/>
            <span>Duração: <span className="font-medium text-white">{formatDuration(evidence.duration)}</span></span>
        </div>
        <div className="flex items-center gap-2">
            <span className="font-medium text-slate-500">Tamanho:</span>
            <span className="font-medium text-white">{evidence.size.toFixed(2)} MB</span>
        </div>
        {evidence.location && (
            <div className="flex items-start col-span-1 md:col-span-2 gap-2">
                <LocationIcon className="w-4 h-4 text-slate-500 mt-1 flex-shrink-0"/>
                <div>
                    <span>Localização:</span>
                    <p className="font-mono text-white">{evidence.location.latitude.toFixed(6)}, {evidence.location.longitude.toFixed(6)}</p>
                    <p className="text-xs text-slate-400">Precisão: {evidence.location.accuracy.toFixed(1)}m</p>
                </div>
            </div>
        )}
        <div className="flex items-start col-span-1 md:col-span-2 gap-2">
            <HashIcon className="w-4 h-4 text-slate-500 mt-1 flex-shrink-0"/>
            <div>
                <span>Hash de Integridade:</span>
                <p className="font-mono text-white break-all text-xs">{evidence.hash}</p>
            </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <button onClick={() => onDownload(evidence)} className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors">
            <DownloadIcon className="w-5 h-5"/>
            Baixar Evidência (R$ {DOWNLOAD_PRICES[evidence.type]})
        </button>
        <button onClick={() => onDelete(evidence.id)} className="p-3 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors">
            <TrashIcon className="w-5 h-5"/>
        </button>
      </div>
    </div>
  );
};

export default EvidenceItem;