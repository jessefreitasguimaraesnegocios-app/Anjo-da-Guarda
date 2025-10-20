import React from 'react';
import { Evidence } from '../types';
import EvidenceItem from './EvidenceItem';
import { ShieldIcon } from './Icons';

interface EvidenceListProps {
  evidenceList: Evidence[];
  onDownload: (evidence: Evidence) => void;
  onDelete: (id: string) => void;
}

const EvidenceList: React.FC<EvidenceListProps> = ({ evidenceList, onDownload, onDelete }) => {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <ShieldIcon className="w-6 h-6 text-slate-400" />
        <h2 className="text-xl font-bold text-white">Minhas Evidências</h2>
      </div>
      
      {evidenceList.length > 0 ? (
        <div className="space-y-4">
          {evidenceList.map(evidence => (
            <EvidenceItem key={evidence.id} evidence={evidence} onDownload={onDownload} onDelete={onDelete} />
          ))}
        </div>
      ) : (
        <div className="text-center py-10">
          <p className="text-slate-400">Nenhuma evidência gravada ainda.</p>
        </div>
      )}
    </div>
  );
};

export default EvidenceList;