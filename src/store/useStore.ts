import { create } from 'zustand';
import * as fabric from 'fabric';

export type ToolType = 'select' | 'eraser' | 'expand' | 'bg-remover' | 'text-to-image' | 'magic-write' | 'magic-grab';

interface AppState {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  
  // Fabric canvas reference
  fabricCanvas: fabric.Canvas | null;
  setFabricCanvas: (canvas: fabric.Canvas | null) => void;
  
  // API Keys
  hfToken: string;
  groqKey: string;
  falKey: string;
  runwareKey: string;
  photoroomKey: string;
  inpaintingProvider: 'fal' | 'runware';
  setHfToken: (token: string) => void;
  setGroqKey: (key: string) => void;
  setFalKey: (key: string) => void;
  setRunwareKey: (key: string) => void;
  setPhotoroomKey: (key: string) => void;
  setInpaintingProvider: (provider: 'fal' | 'runware') => void;
  
  // Loading states
  isLoading: boolean;
  loadingMessage: string;
  setIsLoading: (loading: boolean, message?: string) => void;
  
  // Canvas configuration
  canvasWidth: number;
  canvasHeight: number;
  setCanvasSize: (width: number, height: number) => void;
  
  // Eraser / brush settings
  brushSize: number;
  setBrushSize: (size: number) => void;
  
  // Error handling
  error: string | null;
  setError: (error: string | null) => void;

  // History state for undo/redo
  history: any[];
  redoStack: any[];
  saveHistoryState: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  activeTool: 'select',
  setActiveTool: (tool) => set({ activeTool: tool }),
  
  fabricCanvas: null,
  setFabricCanvas: (canvas) => {
    set({ fabricCanvas: canvas });
    if (canvas) {
      // Clear stacks and initialize with the blank canvas state
      const initialState = canvas.toObject();
      set({ history: [initialState], redoStack: [] });
    }
  },
  
  hfToken: (import.meta.env.VITE_HUGGINGFACE_TOKEN || '').trim(),
  groqKey: (import.meta.env.VITE_GROQ_API_KEY || '').trim(),
  falKey: (import.meta.env.VITE_FAL_KEY || '').trim(),
  runwareKey: (import.meta.env.VITE_RUNWARE_KEY || import.meta.env.VITE_Run_KEY || '').trim(),
  photoroomKey: (import.meta.env.VITE_PHOTOROOM_KEY || 'sk_pr_default_bdaf14d9b25943a81cee0f22dac794142088fd39').trim(),
  inpaintingProvider: (import.meta.env.VITE_RUNWARE_KEY || import.meta.env.VITE_Run_KEY) && !import.meta.env.VITE_FAL_KEY ? 'runware' : 'fal',
  setHfToken: (token) => set({ hfToken: token.trim() }),
  setGroqKey: (key) => set({ groqKey: key.trim() }),
  setFalKey: (key) => set({ falKey: key.trim() }),
  setRunwareKey: (key) => set({ runwareKey: key.trim() }),
  setPhotoroomKey: (key) => set({ photoroomKey: key.trim() }),
  setInpaintingProvider: (provider) => set({ inpaintingProvider: provider }),
  
  isLoading: false,
  loadingMessage: '',
  setIsLoading: (loading, message = '') => set({ isLoading: loading, loadingMessage: message }),
  
  canvasWidth: 800,
  canvasHeight: 600,
  setCanvasSize: (width, height) => set({ canvasWidth: width, canvasHeight: height }),
  
  brushSize: 30,
  setBrushSize: (size) => set({ brushSize: size }),
  
  error: null,
  setError: (error) => set({ error }),

  history: [],
  redoStack: [],

  saveHistoryState: () => {
    const { fabricCanvas, history } = get();
    if (!fabricCanvas) return;
    const currentState = fabricCanvas.toObject();
    
    // Prevent double pushing if state hasn't changed
    if (history.length > 0) {
      const lastState = history[history.length - 1];
      if (JSON.stringify(lastState) === JSON.stringify(currentState)) {
        return;
      }
    }

    set({
      history: [...history, currentState],
      redoStack: [] // Clear redo stack on user action
    });
  },

  undo: () => {
    const { fabricCanvas, history, redoStack } = get();
    if (!fabricCanvas || history.length <= 1) return;

    const current = history[history.length - 1];
    const previous = history[history.length - 2];

    fabricCanvas.loadFromJSON(previous).then(() => {
      fabricCanvas.renderAll();
      set({
        history: history.slice(0, -1),
        redoStack: [current, ...redoStack]
      });
    });
  },

  redo: () => {
    const { fabricCanvas, history, redoStack } = get();
    if (!fabricCanvas || redoStack.length === 0) return;

    const next = redoStack[0];

    fabricCanvas.loadFromJSON(next).then(() => {
      fabricCanvas.renderAll();
      set({
        history: [...history, next],
        redoStack: redoStack.slice(1)
      });
    });
  },

  clearHistory: () => set({ history: [], redoStack: [] })
}));
