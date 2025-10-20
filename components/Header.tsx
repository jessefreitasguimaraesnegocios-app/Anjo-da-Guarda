import React from 'react';
import { UserIcon, LogoutIcon } from './Icons';

const Header: React.FC = () => {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex justify-between items-center">
      <div className="flex items-center gap-4">
        <div className="bg-slate-600 p-2 rounded-full">
          <UserIcon className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-white font-bold text-lg">Anjo da Guarda</h1>
      </div>
      
      <button className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors">
        <LogoutIcon className="w-5 h-5" />
        Sair
      </button>
    </div>
  );
};

export default Header;