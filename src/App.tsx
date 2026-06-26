import { useEffect, useRef, useState } from 'react';
import { useStore } from './store/useStore';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ToolPanel } from './components/ToolPanel';
import { CanvasArea } from './components/CanvasArea';
import * as fabric from 'fabric';
import { jsPDF } from 'jspdf';
import { gsap } from 'gsap';
import { Key, Check, X, AlertCircle } from 'lucide-react';

function App() {
  const { 
    fabricCanvas, 
    hfToken, 
    groqKey, 
    falKey, 
    runwareKey, 
    inpaintingProvider, 
    photoroomKey,
    setHfToken, 
    setGroqKey, 
    setFalKey, 
    setRunwareKey, 
    setPhotoroomKey,
    setInpaintingProvider 
  } = useStore();
  const [showSettings, setShowSettings] = useState(false);
  const [tempHfToken, setTempHfToken] = useState(hfToken);
  const [tempGroqKey, setTempGroqKey] = useState(groqKey);
  const [tempFalKey, setTempFalKey] = useState(falKey);
  const [tempRunwareKey, setTempRunwareKey] = useState(runwareKey);
  const [tempPhotoroomKey, setTempPhotoroomKey] = useState(photoroomKey);
  const [tempInpaintingProvider, setTempInpaintingProvider] = useState(inpaintingProvider);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Element references for animations
  const headerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Elegant entrance animation sequence using GSAP
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.fromTo(headerRef.current, 
      { y: -50, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 0.8 }
    );
    tl.fromTo(sidebarRef.current, 
      { x: -70, opacity: 0 }, 
      { x: 0, opacity: 1, duration: 0.6 },
      '-=0.5'
    );
    tl.fromTo(panelRef.current, 
      { x: -50, opacity: 0 }, 
      { x: 0, opacity: 1, duration: 0.6 },
      '-=0.4'
    );
    tl.fromTo(canvasAreaRef.current, 
      { scale: 0.95, opacity: 0 }, 
      { scale: 1, opacity: 1, duration: 0.8 },
      '-=0.4'
    );
  }, []);

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const url = event.target?.result as string;
      if (!fabricCanvas) return;
      
      try {
        const img = await fabric.Image.fromURL(url, { crossOrigin: 'anonymous' });
        const imgW = img.width || 800;
        const imgH = img.height || 600;

        const canvasW = fabricCanvas.width || 800;
        const canvasH = fabricCanvas.height || 600;
        
        let scale = 1;
        if (imgW > canvasW || imgH > canvasH) {
          const scaleX = canvasW / imgW;
          const scaleY = canvasH / imgH;
          scale = Math.min(scaleX, scaleY) * 0.8;
        }

        img.set({
          scaleX: scale,
          scaleY: scale,
          selectable: true,
          hasControls: true,
          cornerColor: '#c084fc',
          cornerSize: 8,
          transparentCorners: false,
        });
        
        fabricCanvas.add(img);
        fabricCanvas.centerObject(img);
        fabricCanvas.setActiveObject(img);
        
        // Dynamic pop entrance for newly uploaded image
        gsap.fromTo(img, 
          { scaleX: scale * 0.1, scaleY: scale * 0.1, opacity: 0 },
          { 
            scaleX: scale, 
            scaleY: scale, 
            opacity: 1, 
            duration: 0.5, 
            ease: 'back.out(1.2)', 
            onUpdate: () => fabricCanvas.renderAll(),
            onComplete: () => useStore.getState().saveHistoryState()
          }
        );
      } catch (err) {
        console.error('Failed to load image', err);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExportPNG = (fileName: string) => {
    if (!fabricCanvas) return;
    const dataUrl = fabricCanvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 1,
    });
    
    const name = (fileName || 'magic-design').trim().replace(/[/\\?%*:|"<>\s]+/g, '_');
    const link = document.createElement('a');
    link.download = `${name}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handleExportPDF = (fileName: string) => {
    if (!fabricCanvas) return;
    const dataUrl = fabricCanvas.toDataURL({
      format: 'png',
      quality: 1.0,
      multiplier: 1,
    });

    const pdf = new jsPDF({
      orientation: fabricCanvas.width! > fabricCanvas.height! ? 'landscape' : 'portrait',
      unit: 'px',
      format: [fabricCanvas.width!, fabricCanvas.height!],
    });

    pdf.addImage(dataUrl, 'PNG', 0, 0, fabricCanvas.width!, fabricCanvas.height!);
    const name = (fileName || 'magic-design').trim().replace(/[/\\?%*:|"<>\s]+/g, '_');
    pdf.save(`${name}.pdf`);
  };

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    setHfToken(tempHfToken);
    setGroqKey(tempGroqKey);
    setFalKey(tempFalKey);
    setRunwareKey(tempRunwareKey);
    setPhotoroomKey(tempPhotoroomKey);
    setInpaintingProvider(tempInpaintingProvider);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setShowSettings(false);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b0d10] text-[#f1f5f9] overflow-hidden select-none relative mesh-gradient">
      {/* Dynamic ambient glowing spheres in background */}
      <div className="absolute top-[20%] left-[25%] w-[350px] h-[350px] bg-violet-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[25%] w-[400px] h-[400px] bg-fuchsia-600/800 bg-opacity-[0.05] rounded-full blur-[120px] pointer-events-none"></div>
      
      {/* Top Header - Rendered inside GSAP opacity-0 wrapper */}
      <div ref={headerRef} className="opacity-0">
        <Header 
          onImageUpload={handleImageUpload} 
          onExportPNG={handleExportPNG} 
          onExportPDF={handleExportPDF} 
          onOpenSettings={() => {
            setTempHfToken(hfToken);
            setTempGroqKey(groqKey);
            setTempFalKey(falKey);
            setTempRunwareKey(runwareKey);
            setTempInpaintingProvider(inpaintingProvider);
            setShowSettings(true);
          }}
        />
      </div>

      {/* Main workspace layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Leftmost compact sidebar */}
        <div ref={sidebarRef} className="opacity-0 h-full flex flex-col">
          <Sidebar />
        </div>

        {/* Dynamic Tool Settings Panel */}
        <div ref={panelRef} className="opacity-0 h-full flex flex-col">
          <ToolPanel />
        </div>

        {/* Fabric.js editing canvas area */}
        <div ref={canvasAreaRef} className="flex-1 h-full opacity-0 flex flex-col">
          <CanvasArea />
        </div>
      </div>

      {/* Settings Modal - Rendered outside transformed wrapper to prevent cut-off bugs */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[100] flex items-center justify-center">
          <div className="bg-[#11141a]/90 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <Key className="h-4 w-4 text-[#00f2fe]" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Configure API Credentials</h3>
              </div>
              <button 
                onClick={() => setShowSettings(false)} 
                className="text-zinc-400 hover:text-white cursor-pointer p-1.5 rounded-lg hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleSaveKeys} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Hugging Face Access Token
                </label>
                <input
                  type="password"
                  value={tempHfToken}
                  onChange={(e) => setTempHfToken(e.target.value)}
                  placeholder="hf_..."
                  className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-violet-500/80 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Groq Cloud API Key
                </label>
                <input
                  type="password"
                  value={tempGroqKey}
                  onChange={(e) => setTempGroqKey(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-violet-500/80 transition-all"
                />
              </div>

               <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Inpainting & Outpainting Provider
                </label>
                <select
                  value={tempInpaintingProvider}
                  onChange={(e) => setTempInpaintingProvider(e.target.value as 'fal' | 'runware' | 'huggingface')}
                  className="w-full bg-[#16161a] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-violet-500/80 cursor-pointer"
                >
                  <option value="fal">Fal.ai (Direct Inpainting)</option>
                  <option value="runware">Runware (FLUX Fill - Free Trial Friendly)</option>
                  <option value="huggingface">Hugging Face Serverless (100% Free)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Photoroom API Key
                </label>
                <input
                  type="password"
                  value={tempPhotoroomKey}
                  onChange={(e) => setTempPhotoroomKey(e.target.value)}
                  placeholder="sk_pr_..."
                  className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-violet-500/80 transition-all"
                />
              </div>

              {tempInpaintingProvider === 'fal' && (
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Fal.ai API Key
                  </label>
                  <input
                    type="password"
                    value={tempFalKey}
                    onChange={(e) => setTempFalKey(e.target.value)}
                    placeholder="Key ..."
                    className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-violet-500/80 transition-all"
                  />
                </div>
              )}

              {tempInpaintingProvider === 'runware' && (
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Runware API Key
                  </label>
                  <input
                    type="password"
                    value={tempRunwareKey}
                    onChange={(e) => setTempRunwareKey(e.target.value)}
                    placeholder="Runware API Key..."
                    className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-violet-500/80 transition-all"
                  />
                </div>
              )}

              {tempInpaintingProvider === 'huggingface' && (
                <div className="text-[10px] text-zinc-400 bg-white/[0.02] border border-white/5 rounded-xl p-3 leading-relaxed">
                  <span>Hugging Face model <strong>stabilityai/stable-diffusion-2-inpainting</strong> will be used. It runs 100% free using your Hugging Face Access Token set above.</span>
                </div>
              )}

              {(!tempHfToken || !tempGroqKey) && (
                <div className="flex items-start gap-2 bg-red-500/5 border border-red-500/10 p-3 rounded-xl text-red-400 text-[10px] leading-relaxed">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Some features will be locked until both API keys are configured correctly.</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="submit"
                  className="flex items-center justify-center w-full gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors shadow-lg shadow-violet-500/25"
                >
                  {saveSuccess ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Credentials Saved!</span>
                    </>
                  ) : (
                    <span>Save Configuration</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
