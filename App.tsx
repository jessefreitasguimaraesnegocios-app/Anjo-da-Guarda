import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import RecordControl from './components/RecordControl';
import EvidenceList from './components/EvidenceList';
import LocationView from './components/LocationView';
import RecordingView from './components/RecordingView';
import { Evidence, EvidenceType, ViewMode, LocationData } from './types';
import { FREE_DOWNLOADS_LIMIT, DOWNLOAD_PRICES } from './constants';

const App: React.FC = () => {
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [downloadsLeft, setDownloadsLeft] = useState<number>(FREE_DOWNLOADS_LIMIT);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.None);
  const [recordingDuration, setRecordingDuration] = useState(1); // in minutes
  
  // Load state from localStorage on initial render
  useEffect(() => {
    try {
      const storedEvidence = localStorage.getItem('secureguard_evidence');
      if (storedEvidence) {
        setEvidenceList(JSON.parse(storedEvidence));
      }
      const storedDownloads = localStorage.getItem('secureguard_downloads');
      if (storedDownloads) {
        setDownloadsLeft(JSON.parse(storedDownloads));
      }
    } catch (error) {
      console.error("Failed to parse from localStorage", error);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('secureguard_evidence', JSON.stringify(evidenceList));
  }, [evidenceList]);

  useEffect(() => {
    localStorage.setItem('secureguard_downloads', JSON.stringify(downloadsLeft));
  }, [downloadsLeft]);
  
  const generateMockHash = () => {
      return [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  const handleSaveEvidence = useCallback((type: EvidenceType, blob: Blob, duration: number, locationHistory: LocationData[]) => {
    const newEvidence: Evidence = {
        id: crypto.randomUUID(),
        type,
        timestamp: Date.now(),
        duration,
        size: blob.size / (1024 * 1024), // MB
        location: locationHistory.length > 0 ? locationHistory[locationHistory.length - 1] : null,
        locationHistory: type === EvidenceType.Location ? locationHistory : undefined,
        hash: generateMockHash(),
        blobUrl: URL.createObjectURL(blob),
        mimeType: blob.type,
    };

    setEvidenceList(prev => [newEvidence, ...prev]);
    setViewMode(ViewMode.None);
  }, []);

  const handleDownload = (evidence: Evidence) => {
    if (downloadsLeft > 0) {
        setDownloadsLeft(prev => prev - 1);
        alert(`Download iniciado! Você tem ${downloadsLeft - 1} downloads gratuitos restantes.`);
    } else {
        const price = DOWNLOAD_PRICES[evidence.type];
        const proceed = window.confirm(`Você não tem mais downloads gratuitos. O custo para este download é de R$${price}. Deseja continuar? (Simulação)`);
        if (!proceed) return;
        alert(`Pagamento de R$${price} simulado com sucesso! Iniciando download.`);
    }

    if (evidence.blobUrl) {
      const a = document.createElement('a');
      a.href = evidence.blobUrl;
      
      let extension = 'webm'; // Default extension
      if (evidence.mimeType) {
        if (evidence.mimeType.includes('mp4')) {
          extension = 'mp4';
        }
      }
      
      a.download = `evidence_${evidence.type}_${evidence.timestamp}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
        alert("Erro: URL da evidência não encontrada.");
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Tem certeza que deseja apagar esta evidência? Esta ação não pode ser desfeita.")) {
      const evidenceToDelete = evidenceList.find(e => e.id === id);
      if(evidenceToDelete && evidenceToDelete.blobUrl) {
          URL.revokeObjectURL(evidenceToDelete.blobUrl);
      }
      setEvidenceList(prev => prev.filter(e => e.id !== id));
    }
  };

  const renderActiveView = () => {
    switch (viewMode) {
      case ViewMode.Location:
        return <LocationView onClose={() => setViewMode(ViewMode.None)} />;
      case ViewMode.Live:
      case ViewMode.RecordingVideo:
      case ViewMode.RecordingAudio:
      case ViewMode.RecordingPanic:
        return <RecordingView 
                  mode={viewMode}
                  maxDuration={recordingDuration}
                  onClose={() => setViewMode(ViewMode.None)} 
                  onSave={handleSaveEvidence} 
                />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-slate-900 text-white min-h-screen p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Header />
        <main className="space-y-6">
          <RecordControl 
            onSetViewMode={setViewMode} 
            duration={recordingDuration} 
            onDurationChange={setRecordingDuration} 
          />
          <EvidenceList evidenceList={evidenceList} onDownload={handleDownload} onDelete={handleDelete} />
        </main>
      </div>
      {renderActiveView()}
    </div>
  );
};

export default App;