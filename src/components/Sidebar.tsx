import React from 'react';
import { useStore } from '../store/useStore';
import type { ToolType } from '../store/useStore';
import { 
  MousePointer, 
  Sparkles, 
  Image, 
  PenTool, 
  Eraser, 
  Maximize2,
  Hand
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeTool, setActiveTool } = useStore();

  const menuItems = [
    {
      id: 'select' as ToolType,
      label: 'Select',
      icon: MousePointer,
      description: 'Interact with objects',
    },
    {
      id: 'bg-remover' as ToolType,
      label: 'BG Remover',
      icon: Sparkles,
      description: 'Remove background instantly',
    },
    {
      id: 'text-to-image' as ToolType,
      label: 'Magic Media',
      icon: Image,
      description: 'Generate art from text',
    },
    {
      id: 'magic-write' as ToolType,
      label: 'Magic Write',
      icon: PenTool,
      description: 'AI content generator',
    },
    {
      id: 'eraser' as ToolType,
      label: 'Magic Eraser',
      icon: Eraser,
      description: 'Erase unwanted objects',
    },
    {
      id: 'expand' as ToolType,
      label: 'Magic Expand',
      icon: Maximize2,
      description: 'Extend image borders',
    },
    {
      id: 'magic-grab' as ToolType,
      label: 'Magic Grab',
      icon: Hand,
      description: 'Make images editable',
    },
  ];

  return (
    <aside className="w-[76px] bg-[#12112d]/95 backdrop-blur-md flex flex-col items-center py-4 gap-2 border-r border-white/5 z-20 shrink-0 select-none h-full">
      {/* Brand Logo */}
      <div className="w-12 h-12 mb-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-center p-1.5 shadow-inner hover:scale-105 hover:bg-white/[0.04] transition-all duration-300 group cursor-pointer" title="Canva Magic Tool">
        <img src="/favicon.svg" alt="Magic Logo" className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(192,132,252,0.4)] group-hover:rotate-12 transition-all duration-500" />
      </div>

      <div className="flex flex-col gap-1.5 w-full px-1.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTool === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTool(item.id)}
              className={`flex flex-col items-center justify-center w-full py-3.5 rounded-lg transition-all duration-300 gap-1.5 cursor-pointer relative group ${
                isActive
                  ? 'bg-white/5 text-white border border-white/10 shadow-[0_0_15px_rgba(139,92,246,0.1)]'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.02]'
              }`}
            >
              {/* Highlight bar like Canva */}
              {isActive && (
                <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-gradient-to-b from-violet-500 to-fuchsia-500 shadow-[0_0_8px_#8b5cf6]"></span>
              )}
              
              <Icon className={`h-4.5 w-4.5 transition-all duration-300 ${
                isActive ? 'text-[#c084fc] scale-110 drop-shadow-[0_0_5px_rgba(167,139,250,0.5)]' : 'text-zinc-400 group-hover:scale-105'
              }`} />
              <span className="text-[9px] font-semibold tracking-tight text-center leading-tight">{item.label}</span>
              
              {/* Tooltip */}
              <div className="absolute left-[82px] px-3 py-2 rounded-lg bg-[#1a183d] border border-white/10 text-[10px] text-white font-medium opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 shadow-2xl whitespace-nowrap z-50 transform translate-x-2 group-hover:translate-x-0">
                <p className="font-bold text-[#c084fc]">{item.label}</p>
                <p className="text-[9px] text-zinc-400 font-normal">{item.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
