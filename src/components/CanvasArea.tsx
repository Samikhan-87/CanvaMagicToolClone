import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { useStore } from '../store/useStore';
import { Move } from 'lucide-react';

export const CanvasArea: React.FC = () => {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(50); // Default to 50% for standard view fit
  
  const { 
    fabricCanvas, 
    setFabricCanvas, 
    activeTool, 
    brushSize,
    canvasWidth,
    canvasHeight,
  } = useStore();

  // Initialize Fabric Canvas
  useEffect(() => {
    if (!canvasElRef.current) return;

    const canvas = new fabric.Canvas(canvasElRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: 'transparent', // Transparent to allow checkered pattern underneath
      preserveObjectStacking: true,
    });

    setFabricCanvas(canvas);

    // Apply default zoom
    canvas.setZoom(zoom / 100);
    canvas.renderAll();

    // Listen for user modifications to auto-save history
    canvas.on('object:modified', () => {
      useStore.getState().saveHistoryState();
    });

    return () => {
      canvas.dispose();
      setFabricCanvas(null);
    };
  }, [canvasWidth, canvasHeight, setFabricCanvas]);

  // Handle Zoom change
  useEffect(() => {
    if (!fabricCanvas) return;
    fabricCanvas.setZoom(zoom / 100);
    fabricCanvas.renderAll();
  }, [zoom, fabricCanvas]);

  // Handle Keyboard Shortcuts (Delete/Backspace, Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcut key triggers if user is typing in text areas or settings inputs
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (!fabricCanvas) return;

      const activeObject = fabricCanvas.getActiveObject();

      // 1. Delete / Backspace key to remove selected element
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeObject) {
          // If typing inside Fabric IText editing wrapper, do not delete the element itself
          if (activeObject.type === 'i-text' && (activeObject as any).isEditing) {
            return;
          }
          fabricCanvas.remove(activeObject);
          fabricCanvas.discardActiveObject();
          fabricCanvas.renderAll();
          useStore.getState().saveHistoryState();
        }
      }

      // 2. Ctrl + Z (Undo)
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        useStore.getState().undo();
      }

      // 3. Ctrl + Shift + Z or Ctrl + Y (Redo)
      if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') || (e.ctrlKey && e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        useStore.getState().redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fabricCanvas]);

  // Handle Tool Changes (Select Mode vs Drawing/Eraser Mode)
  useEffect(() => {
    if (!fabricCanvas) return;

    if (activeTool === 'eraser') {
      fabricCanvas.isDrawingMode = true;
      
      // Initialize free drawing brush if not present
      if (!fabricCanvas.freeDrawingBrush) {
        fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(fabricCanvas);
      }
      
      fabricCanvas.freeDrawingBrush.width = brushSize;
      fabricCanvas.freeDrawingBrush.color = 'rgba(167, 139, 250, 0.4)'; // Canva translucent violet brush
      
      // Prevent selection of elements while drawing
      fabricCanvas.forEachObject((obj: fabric.Object) => {
        obj.selectable = false;
        obj.evented = false;
      });
    } else {
      fabricCanvas.isDrawingMode = false;
      
      // Enable selection/interaction in other modes
      fabricCanvas.forEachObject((obj: fabric.Object) => {
        if (obj.type === 'path') {
          obj.selectable = false;
          obj.evented = false;
        } else {
          obj.selectable = true;
          obj.evented = true;
        }
      });
    }
    
    fabricCanvas.renderAll();
  }, [activeTool, brushSize, fabricCanvas]);

  return (
    <div 
      ref={containerRef}
      className="flex-1 bg-[#121315] flex items-center justify-center p-8 overflow-auto relative"
    >
      {/* Canvas wrapper with checkered pattern underneath for transparent images */}
      <div className="relative shadow-2xl rounded overflow-hidden checkered-pattern border border-zinc-800/80">
        <canvas ref={canvasElRef} />
        
        {/* Active Tool Indicator Badge */}
        <div className="absolute top-2.5 left-2.5 bg-[#1e1f20]/90 backdrop-blur border border-zinc-800/80 rounded px-2.5 py-0.5 text-[9px] font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-1.5 pointer-events-none">
          <Move className="h-3 w-3 text-violet-400" />
          <span>Tool: {activeTool}</span>
        </div>
      </div>

      {/* Bottom Center Zoom Controller */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-[#1e1f20] border border-zinc-800/80 rounded-md px-3.5 py-1.5 flex items-center gap-3 text-xs select-none shadow-xl z-20">
        <input 
          type="range" 
          min="10" 
          max="200" 
          value={zoom} 
          onChange={(e) => setZoom(Number(e.target.value))} 
          className="w-24 cursor-pointer" 
        />
        <span className="text-zinc-300 font-bold w-8 text-right">{zoom}%</span>
      </div>
    </div>
  );
};
