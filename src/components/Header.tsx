import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { 
  Undo2, 
  Redo2, 
  Eye, 
  Info, 
  Download, 
  Plus, 
  Check, 
  X, 
  Settings
} from 'lucide-react';

interface HeaderProps {
  onImageUpload: (file: File) => void;
  onExportPNG: (fileName: string) => void;
  onExportPDF: (fileName: string) => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  onImageUpload, 
  onExportPNG, 
  onExportPDF,
  onOpenSettings
}) => {
  const { hfToken, groqKey, undo, redo, setActiveTool } = useStore();
  const [docName, setDocName] = useState('Magic Design - ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));

  const handleUndo = () => {
    undo();
  };

  const handleRedo = () => {
    redo();
  };

  return (
    <header className="h-[56px] border-b border-white/5 bg-[#11141a]/95 backdrop-blur-md flex items-center justify-between px-4.5 z-20 shrink-0 select-none">
      {/* Left side actions */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setActiveTool('select')}
          className="text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-all px-3.5 py-2 rounded-lg hover:bg-white/5 cursor-pointer border border-white/5 bg-white/[0.01]"
        >
          Cancel
        </button>
        
        <div className="flex items-center gap-1.5 border-l border-white/5 pl-3.5">
          <button 
            onClick={handleUndo}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer border border-transparent hover:border-white/5"
            title="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button 
            onClick={handleRedo}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer border border-transparent hover:border-white/5"
            title="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </button>
        </div>

        <button className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-white px-3.5 py-2 rounded-lg hover:bg-white/5 transition-all border border-white/5 cursor-pointer">
          <Eye className="h-4 w-4 text-[#c084fc]" />
          <span>Compare</span>
        </button>
      </div>

      {/* Center Doc Name */}
      <div className="flex items-center gap-2 max-w-sm">
        <input
          type="text"
          value={docName}
          onChange={(e) => setDocName(e.target.value)}
          className="bg-transparent border border-transparent hover:border-white/5 focus:border-white/10 text-xs text-zinc-300 hover:text-white focus:text-white text-center font-bold tracking-wide py-1.5 px-3.5 rounded-lg w-76 focus:outline-none transition-all truncate"
        />
        <Info className="h-4 w-4 text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors" />
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2.5">
        {/* Settings / API Key Button */}
        <button
          onClick={onOpenSettings}
          className={`p-2 rounded-lg hover:bg-white/5 transition-all cursor-pointer border border-white/5 relative ${
            !hfToken || !groqKey ? 'text-red-400 bg-red-950/10 border-red-500/20' : 'text-zinc-400 hover:text-white bg-white/[0.01]'
          }`}
          title="Configure API Keys"
        >
          <Settings className="h-4 w-4 animate-spin-slow" />
          {(!hfToken || !groqKey) && (
            <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500 animate-ping"></span>
          )}
        </button>

        {/* Upload Custom Image */}
        <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-850 text-xs font-bold uppercase tracking-wider text-white transition-all cursor-pointer border border-white/5 shadow-md">
          <Plus className="h-4 w-4 text-[#c084fc]" />
          <span>Upload</span>
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImageUpload(file);
            }} 
          />
        </label>

        {/* Save/Export PNG Button */}
        <button
          onClick={() => onExportPNG(docName)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-850 text-xs font-bold uppercase tracking-wider text-white transition-all cursor-pointer border border-white/5 shadow-md"
          title="Export PNG"
        >
          <Download className="h-4 w-4 text-zinc-450" />
          <span>Export PNG</span>
        </button>

        {/* Save/Export PDF Button */}
        <button
          onClick={() => onExportPDF(docName)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-xs font-bold uppercase tracking-wider text-white transition-all cursor-pointer shadow-lg shadow-violet-500/20"
        >
          <Check className="h-4 w-4" />
          <span>Save PDF</span>
        </button>

        <div className="h-5 w-[1px] bg-white/5 mx-1" />

        {/* Close Button */}
        <button className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-450 hover:text-red-400 border border-transparent hover:border-red-500/10 transition-all cursor-pointer">
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};
