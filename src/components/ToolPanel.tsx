import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { 
  generateImage, 
  generateText, 
  eraseObject, 
  expandImage,
  localInpaint,
  photoroomEdit
} from '../services/ai';
import { removeBackground } from '@imgly/background-removal';
import * as fabric from 'fabric';
import Tesseract from 'tesseract.js';
import { 
  Sparkles, 
  PenTool, 
  Eraser, 
  Maximize2, 
  Trash2, 
  Loader2, 
  ArrowLeft,
  RotateCcw,
  Sparkle,
  Hand
} from 'lucide-react';

export const ToolPanel: React.FC = () => {
  const { 
    activeTool, 
    setActiveTool,
    fabricCanvas, 
    hfToken, 
    groqKey, 
    falKey,
    runwareKey,
    photoroomKey,
    inpaintingProvider,
    isLoading, 
    setIsLoading, 
    brushSize, 
    setBrushSize,
    setError,
    error,
    saveHistoryState
  } = useStore();

  // Text-to-Image states
  const [imagePrompt, setImagePrompt] = useState('');

  // Magic Write states
  const [writePrompt, setWritePrompt] = useState('');
  const [tone, setTone] = useState('creative');
  const [length, setLength] = useState('medium');

  // Magic Expand states
  const [expandPrompt, setExpandPrompt] = useState('');
  const [expandRatio, setExpandRatio] = useState<'1:1' | '16:9' | '9:16'>('1:1');

  // Eraser states
  const [eraserMode, setEraserMode] = useState<'erase' | 'restore'>('erase');
  const [showOriginal, setShowOriginal] = useState(false);
  const [eraserSubMode, setEraserSubMode] = useState<'brush' | 'prompt' | 'text-auto'>('brush');
  const [eraserPrompt, setEraserPrompt] = useState('');

  const addImageToCanvas = async (url: string) => {
    if (!fabricCanvas) return;
    try {
      const img = await fabric.Image.fromURL(url, { crossOrigin: 'anonymous' });
      const scaleX = (fabricCanvas.width! - 120) / img.width!;
      const scaleY = (fabricCanvas.height! - 120) / img.height!;
      const scale = Math.min(scaleX, scaleY, 1);
      
      img.set({
        scaleX: scale,
        scaleY: scale,
        left: (fabricCanvas.width! - img.width! * scale) / 2,
        top: (fabricCanvas.height! - img.height! * scale) / 2,
        selectable: true,
        hasControls: true,
        cornerColor: '#c084fc',
        cornerSize: 8,
        transparentCorners: false,
      });
      fabricCanvas.add(img);
      fabricCanvas.setActiveObject(img);
      fabricCanvas.renderAll();
      saveHistoryState();
    } catch (err) {
      console.error('Failed to load image to canvas', err);
    }
  };

  // 1. BACKGROUND REMOVER
  const handleRemoveBackground = async () => {
    if (!fabricCanvas) return;
    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject || activeObject.type !== 'image') {
      setError('Please select an image on the canvas first.');
      return;
    }

    setIsLoading(true, 'Removing background locally... (First run may take a minute)');
    setError(null);

    try {
      const imgObj = activeObject as fabric.Image;
      const dataUrl = imgObj.toDataURL({ format: 'png', multiplier: 1 });
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      const processedBlob = await removeBackground(blob);
      const processedUrl = URL.createObjectURL(processedBlob);

      const newImg = await fabric.Image.fromURL(processedUrl, { crossOrigin: 'anonymous' });
      newImg.set({
        left: imgObj.left,
        top: imgObj.top,
        scaleX: imgObj.scaleX,
        scaleY: imgObj.scaleY,
        angle: imgObj.angle,
        selectable: true,
        hasControls: true,
        cornerColor: '#c084fc',
        cornerSize: 8,
        transparentCorners: false,
      });
      
      fabricCanvas.remove(imgObj);
      fabricCanvas.add(newImg);
      fabricCanvas.setActiveObject(newImg);
      fabricCanvas.renderAll();
      saveHistoryState();
      setIsLoading(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to remove background.');
      setIsLoading(false);
    }
  };

  // 2. TEXT TO IMAGE
  const handleTextToImage = async () => {
    if (!imagePrompt.trim()) return;
    setIsLoading(true, 'Generating image via Hugging Face...');
    setError(null);

    try {
      const imageUrl = await generateImage(imagePrompt, hfToken);
      await addImageToCanvas(imageUrl);
      setImagePrompt('');
      setIsLoading(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate image.');
      setIsLoading(false);
    }
  };

  // 3. MAGIC WRITE
  const handleMagicWrite = async () => {
    if (!writePrompt.trim()) return;
    setIsLoading(true, 'Drafting copy with AI...');
    setError(null);

    const systemPrompt = `You are a copywriter. Write a copy based on the prompt. Tone: ${tone}. Length: ${length}. Keep it punchy and engaging. Only return the written text copy.`;

    try {
      const generatedText = await generateText(writePrompt, systemPrompt, groqKey);
      
      if (fabricCanvas) {
        const text = new fabric.IText(generatedText, {
          left: 100,
          top: 100,
          fontFamily: 'Inter, sans-serif',
          fontSize: 22,
          fill: '#ffffff',
          width: 320,
          splitByGrapheme: true,
          selectable: true,
          hasControls: true,
        });
        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
        fabricCanvas.renderAll();
        saveHistoryState();
      }

      setWritePrompt('');
      setIsLoading(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate text.');
      setIsLoading(false);
    }
  };

  // 4. MAGIC ERASER
  const handleMagicEraser = async () => {
    if (!fabricCanvas) return;
    
    const imgObj = fabricCanvas.getObjects().find((o: fabric.Object) => o.type === 'image') as fabric.Image;

    if (!imgObj) {
      setError('No image found on the canvas to erase from.');
      return;
    }

    if (eraserSubMode === 'brush') {
      const paths = fabricCanvas.getObjects().filter((o: fabric.Object) => o.type === 'path') as fabric.Path[];
      if (paths.length === 0) {
        setError('Please draw over the object you want to erase first.');
        return;
      }

      setIsLoading(true, 'Erasing object with AI inpainting...');
      setError(null);

      try {
        const originalVisibility: { [key: number]: boolean } = {};
        
        fabricCanvas.getObjects().forEach((obj: fabric.Object, idx: number) => {
          originalVisibility[idx] = obj.visible || false;
        });

        fabricCanvas.getObjects().forEach((obj: fabric.Object) => {
          if (obj.type === 'path') obj.visible = false;
        });
        fabricCanvas.renderAll();
        
        const imageURL = fabricCanvas.toDataURL({ format: 'png', multiplier: 1 });
        const imageBlob = await (await fetch(imageURL)).blob();

        fabricCanvas.getObjects().forEach((obj: fabric.Object) => {
          if (obj.type === 'path') {
            obj.visible = true;
            (obj as fabric.Path).set({ stroke: '#ffffff', fill: 'transparent' });
          } else {
            obj.visible = false;
          }
        });
        const originalBgColor = fabricCanvas.backgroundColor;
        fabricCanvas.backgroundColor = '#000000';
        fabricCanvas.renderAll();

        const maskURL = fabricCanvas.toDataURL({ format: 'png', multiplier: 1 });
        const maskBlob = await (await fetch(maskURL)).blob();

        fabricCanvas.backgroundColor = originalBgColor || 'transparent';
        fabricCanvas.getObjects().forEach((obj: fabric.Object, idx: number) => {
          obj.visible = originalVisibility[idx];
          if (obj.type === 'path') {
            (obj as fabric.Path).set({ stroke: 'rgba(167, 139, 250, 0.4)' });
          }
        });
        fabricCanvas.renderAll();

        let resultURL: string;
        try {
          resultURL = await eraseObject(imageBlob, maskBlob, hfToken, falKey, runwareKey, inpaintingProvider);
        } catch (err: any) {
          console.warn('Server inpainting failed, attempting local fallback...', err);
          setIsLoading(true, 'Server key failed. Running local fallback (free offline erase)...');
          resultURL = await localInpaint(imageBlob, maskBlob);
        }

        paths.forEach((p: fabric.Path) => fabricCanvas.remove(p));

        const newImg = await fabric.Image.fromURL(resultURL, { crossOrigin: 'anonymous' });
        newImg.set({
          left: imgObj.left,
          top: imgObj.top,
          scaleX: imgObj.scaleX,
          scaleY: imgObj.scaleY,
          angle: imgObj.angle,
          selectable: true,
          hasControls: true,
          cornerColor: '#c084fc',
          cornerSize: 8,
          transparentCorners: false,
        });

        fabricCanvas.remove(imgObj);
        fabricCanvas.add(newImg);
        fabricCanvas.setActiveObject(newImg);
        fabricCanvas.renderAll();
        saveHistoryState();
        setIsLoading(false);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed during object removal.');
        setIsLoading(false);
      }
    } else {
      // Photoroom Sub-Modes
      if (!photoroomKey) {
        setError('Photoroom API Key is required for this operation. Please configure it in settings.');
        return;
      }

      if (eraserSubMode === 'prompt' && !eraserPrompt.trim()) {
        setError('Please describe what you want to erase.');
        return;
      }

      setIsLoading(true, eraserSubMode === 'prompt' ? `Erasing "${eraserPrompt}" via Photoroom AI...` : 'Removing all text via Photoroom AI...');
      setError(null);

      try {
        // Hide paths if any are drawn
        const originalVisibility: { [key: number]: boolean } = {};
        fabricCanvas.getObjects().forEach((obj: fabric.Object, idx: number) => {
          originalVisibility[idx] = obj.visible || false;
          if (obj.type === 'path') obj.visible = false;
        });
        fabricCanvas.renderAll();

        const imageURL = fabricCanvas.toDataURL({ format: 'png', multiplier: 1 });
        const imageBlob = await (await fetch(imageURL)).blob();

        // Restore original visibility for paths
        fabricCanvas.getObjects().forEach((obj: fabric.Object, idx: number) => {
          obj.visible = originalVisibility[idx];
        });
        fabricCanvas.renderAll();

        const resultURL = await photoroomEdit(
          imageBlob,
          eraserSubMode === 'prompt' ? 'object-removal' : 'text-removal',
          eraserSubMode === 'prompt' ? eraserPrompt : '',
          photoroomKey
        );

        // Remove any paths
        const paths = fabricCanvas.getObjects().filter((o: fabric.Object) => o.type === 'path') as fabric.Path[];
        paths.forEach((p: fabric.Path) => fabricCanvas.remove(p));

        const newImg = await fabric.Image.fromURL(resultURL, { crossOrigin: 'anonymous' });
        newImg.set({
          left: imgObj.left,
          top: imgObj.top,
          scaleX: imgObj.scaleX,
          scaleY: imgObj.scaleY,
          angle: imgObj.angle,
          selectable: true,
          hasControls: true,
          cornerColor: '#c084fc',
          cornerSize: 8,
          transparentCorners: false,
        });

        fabricCanvas.remove(imgObj);
        fabricCanvas.add(newImg);
        fabricCanvas.setActiveObject(newImg);
        fabricCanvas.renderAll();
        saveHistoryState();
        setIsLoading(false);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Photoroom operation failed.');
        setIsLoading(false);
      }
    }
  };

  // 5. MAGIC EXPAND
  const handleMagicExpand = async () => {
    if (!fabricCanvas) return;
    const imgObj = fabricCanvas.getObjects().find((o: fabric.Object) => o.type === 'image') as fabric.Image;

    if (!imgObj) {
      setError('Please upload or generate an image to expand.');
      return;
    }

    setIsLoading(true, 'Expanding borders with AI outpainting...');
    setError(null);

    try {
      const canvasW = fabricCanvas.width!;
      const canvasH = fabricCanvas.height!;
      
      let targetW = canvasW;
      let targetH = canvasH;

      if (expandRatio === '1:1') {
        const size = Math.max(canvasW, canvasH);
        targetW = size;
        targetH = size;
      } else if (expandRatio === '16:9') {
        targetW = Math.max(canvasW, canvasH);
        targetH = (targetW * 9) / 16;
      } else if (expandRatio === '9:16') {
        targetH = Math.max(canvasW, canvasH);
        targetW = (targetH * 9) / 16;
      }

      const imgCanvas = document.createElement('canvas');
      imgCanvas.width = targetW;
      imgCanvas.height = targetH;
      const imgCtx = imgCanvas.getContext('2d')!;
      imgCtx.fillStyle = '#000000';
      imgCtx.fillRect(0, 0, targetW, targetH);

      const originalImageEl = imgObj._element as HTMLImageElement;
      
      const imgW = imgObj.width! * imgObj.scaleX!;
      const imgH = imgObj.height! * imgObj.scaleY!;
      const dx = (targetW - imgW) / 2;
      const dy = (targetH - imgH) / 2;
      
      imgCtx.drawImage(originalImageEl, dx, dy, imgW, imgH);
      
      const imageBlob = await new Promise<Blob>((resolve) => 
        imgCanvas.toBlob((b) => resolve(b!), 'image/png')
      );

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = targetW;
      maskCanvas.height = targetH;
      const maskCtx = maskCanvas.getContext('2d')!;
      
      maskCtx.fillStyle = '#ffffff'; 
      maskCtx.fillRect(0, 0, targetW, targetH);
      
      maskCtx.fillStyle = '#000000'; 
      maskCtx.fillRect(dx, dy, imgW, imgH);

      const maskBlob = await new Promise<Blob>((resolve) => 
        maskCanvas.toBlob((b) => resolve(b!), 'image/png')
      );

      let resultURL: string;
      try {
        resultURL = await expandImage(imageBlob, maskBlob, expandPrompt, hfToken, falKey, runwareKey, inpaintingProvider);
      } catch (err: any) {
        console.warn('Server outpainting failed, attempting local fallback...', err);
        setIsLoading(true, 'Server key failed. Running local fallback (free offline expand)...');
        resultURL = await localInpaint(imageBlob, maskBlob);
      }

      const newImg = await fabric.Image.fromURL(resultURL, { crossOrigin: 'anonymous' });
      newImg.set({
        left: (fabricCanvas.width! - targetW) / 2,
        top: (fabricCanvas.height! - targetH) / 2,
        selectable: true,
        hasControls: true,
        cornerColor: '#c084fc',
        cornerSize: 8,
        transparentCorners: false,
      });

      fabricCanvas.remove(imgObj);
      fabricCanvas.add(newImg);
      fabricCanvas.setActiveObject(newImg);
      fabricCanvas.renderAll();
      saveHistoryState();
      setIsLoading(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed during border expansion.');
      setIsLoading(false);
    }
  };

  const handleMagicGrab = async () => {
    if (!fabricCanvas) return;
    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject || activeObject.type !== 'image') {
      setError('Please select an image on the canvas first.');
      return;
    }

    setIsLoading(true, 'Running Magic Grab: Analyzing Text (OCR)...');
    setError(null);

    try {
      const imgObj = activeObject as fabric.Image;
      const originalImageEl = imgObj._element as HTMLImageElement;
      
      const width = originalImageEl.naturalWidth || imgObj.width!;
      const height = originalImageEl.naturalHeight || imgObj.height!;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(originalImageEl, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/png');

      // 1. OCR (Tesseract)
      const ocrResult = await Tesseract.recognize(dataUrl, 'eng');
      const lines: any[] = (ocrResult.data as any).lines || [];
      console.log('Magic Grab - OCR lines found:', lines.length);

      // 2. Segment main subject (Background Remover)
      setIsLoading(true, 'Running Magic Grab: Segmenting main subject...');
      const response = await fetch(dataUrl);
      const imgBlob = await response.blob();
      const subjectBlob = await removeBackground(imgBlob);
      const subjectUrl = URL.createObjectURL(subjectBlob);

      const subjectImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = subjectUrl;
      });

      // 3. Create combined mask canvas for inpainting both Text & Subject
      setIsLoading(true, 'Running Magic Grab: Preparing background mask...');
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = width;
      maskCanvas.height = height;
      const maskCtx = maskCanvas.getContext('2d')!;
      maskCtx.fillStyle = '#000000';
      maskCtx.fillRect(0, 0, width, height);

      // Draw text bounding boxes on mask
      maskCtx.fillStyle = '#ffffff';
      lines.forEach((line: any) => {
        if (!line.bbox) return;
        const { x0, y0, x1, y1 } = line.bbox;
        const padding = 6;
        const bx = Math.max(0, x0 - padding);
        const by = Math.max(0, y0 - padding);
        const bw = Math.min(width - bx, (x1 - x0) + padding * 2);
        const bh = Math.min(height - by, (y1 - y0) + padding * 2);
        maskCtx.fillRect(bx, by, bw, bh);
      });

      // Draw subject transparency mask
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.drawImage(subjectImg, 0, 0, width, height);
      const tempImgData = tempCtx.getImageData(0, 0, width, height);

      const maskImgData = maskCtx.getImageData(0, 0, width, height);
      for (let i = 0; i < tempImgData.data.length; i += 4) {
        const alpha = tempImgData.data[i + 3];
        if (alpha > 30) {
          maskImgData.data[i] = 255;
          maskImgData.data[i + 1] = 255;
          maskImgData.data[i + 2] = 255;
          maskImgData.data[i + 3] = 255;
        }
      }
      maskCtx.putImageData(maskImgData, 0, 0);

      // 4. Inpaint the background
      setIsLoading(true, 'Running Magic Grab: Inpainting background...');
      const maskBlob = await new Promise<Blob>((resolve) => 
        maskCanvas.toBlob((b) => resolve(b!), 'image/png')
      );

      let bgResultUrl: string;
      try {
        bgResultUrl = await eraseObject(imgBlob, maskBlob, hfToken, falKey, runwareKey, inpaintingProvider);
      } catch (err) {
        console.warn('Server inpainting failed during Magic Grab, using local fallback...', err);
        bgResultUrl = await localInpaint(imgBlob, maskBlob);
      }

      // 5. Replace on canvas
      setIsLoading(true, 'Running Magic Grab: Rendering editable components...');
      const bgImg = await fabric.Image.fromURL(bgResultUrl, { crossOrigin: 'anonymous' });
      bgImg.set({
        left: imgObj.left,
        top: imgObj.top,
        scaleX: imgObj.scaleX,
        scaleY: imgObj.scaleY,
        angle: imgObj.angle,
        selectable: true,
        hasControls: true,
        cornerColor: '#c084fc',
        cornerSize: 8,
        transparentCorners: false,
      });

      const fgImg = await fabric.Image.fromURL(subjectUrl, { crossOrigin: 'anonymous' });
      fgImg.set({
        left: imgObj.left,
        top: imgObj.top,
        scaleX: imgObj.scaleX,
        scaleY: imgObj.scaleY,
        angle: imgObj.angle,
        selectable: true,
        hasControls: true,
        cornerColor: '#c084fc',
        cornerSize: 8,
        transparentCorners: false,
      });

      fabricCanvas.remove(imgObj);
      fabricCanvas.add(bgImg);
      fabricCanvas.add(fgImg);

      // Add IText objects
      const scaleX = imgObj.scaleX!;
      const scaleY = imgObj.scaleY!;

      const getSampledColor = (x: number, y: number) => {
        try {
          const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
          return `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
        } catch {
          return '#ffffff';
        }
      };

      for (const line of lines) {
        if (!line.bbox || !line.text.trim()) continue;
        const { x0, y0, x1, y1 } = line.bbox;
        const cx = x0 + (x1 - x0) / 2;
        const cy = y0 + (y1 - y0) / 2;
        const sampledColor = getSampledColor(cx, cy);

        const fabricText = new fabric.IText(line.text.trim(), {
          left: imgObj.left! + x0 * scaleX,
          top: imgObj.top! + y0 * scaleY,
          fontSize: (y1 - y0) * scaleY * 0.85,
          fill: sampledColor,
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          selectable: true,
          hasControls: true,
          cornerColor: '#c084fc',
          cornerSize: 8,
          transparentCorners: false,
        });
        fabricCanvas.add(fabricText);
      }

      fabricCanvas.renderAll();
      saveHistoryState();
      setIsLoading(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Magic Grab failed.');
      setIsLoading(false);
    }
  };

  const handleClearCanvas = () => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = 'transparent';
    fabricCanvas.renderAll();
  };

  const handleResetEraserMasks = () => {
    if (!fabricCanvas) return;
    const paths = fabricCanvas.getObjects().filter((o: fabric.Object) => o.type === 'path');
    paths.forEach(p => fabricCanvas.remove(p));
    fabricCanvas.renderAll();
  };

  return (
    <div className="w-[310px] bg-[#12112d]/80 backdrop-blur-xl flex flex-col h-full border-r border-white/5 z-10 shrink-0 select-none">
      
      {/* Panel Top Title & Back arrow */}
      <div className="p-4.5 border-b border-white/5 flex items-center gap-3 bg-white/[0.01]">
        <button 
          onClick={() => setActiveTool('select')}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer transition-all duration-300"
          title="Back to Select"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-bold text-white tracking-wider uppercase font-sans">
          {activeTool === 'select' && 'Studio Hub'}
          {activeTool === 'bg-remover' && 'BG Remover'}
          {activeTool === 'text-to-image' && 'Magic Media'}
          {activeTool === 'magic-write' && 'Magic Write'}
          {activeTool === 'eraser' && 'Pixel Eraser'}
          {activeTool === 'expand' && 'Magic Expand'}
          {activeTool === 'magic-grab' && 'Magic Grab'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4.5 space-y-6 flex flex-col justify-between">
        <div className="space-y-5">
          {/* Error Alert */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 text-xs flex flex-col gap-1.5 animate-pulse">
              <span className="font-bold uppercase tracking-wider text-[10px]">System Error</span>
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 px-4 bg-white/[0.01] rounded-2xl border border-white/5 space-y-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-violet-600/5 to-fuchsia-600/5 animate-pulse"></div>
              <Loader2 className="h-8 w-8 text-[#d946ef] animate-spin drop-shadow-[0_0_10px_#d946ef]" />
              <p className="text-xs text-zinc-300 text-center leading-relaxed font-semibold">
                {useStore.getState().loadingMessage || 'Initiating magic engine...'}
              </p>
            </div>
          )}

          {!isLoading && (
            <>
              {/* SELECT TOOL PANEL */}
              {activeTool === 'select' && (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Unleash your imagination. Select any AI-powered magic operation from the left sidebar to start editing your elements.
                  </p>
                  
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col gap-3">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Canvas Operations</span>
                    <button 
                      onClick={handleClearCanvas}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 text-xs font-semibold text-red-400 transition-all duration-300 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Purge Board</span>
                    </button>
                  </div>
                </div>
              )}

              {/* BG REMOVER PANEL */}
              {activeTool === 'bg-remover' && (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Cleanly extract subjects by running local client-side background segmentation. No server latency.
                  </p>
                  <button
                    onClick={handleRemoveBackground}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl neon-glow-btn text-white font-bold text-xs cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>REMOVE BACKGROUND</span>
                  </button>
                </div>
              )}

              {/* TEXT TO IMAGE PANEL */}
              {activeTool === 'text-to-image' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Prompt input</label>
                    <textarea
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      placeholder="e.g. A gorgeous futuristic cyberpunk city floating in neon nebula cloud, unreal engine 5, 8k..."
                      rows={5}
                      className="w-full bg-[#16161a] border border-white/5 rounded-xl p-3.5 text-xs text-zinc-150 placeholder-zinc-650 focus:outline-none focus:border-violet-500/80 transition-all resize-none font-sans"
                    />
                  </div>
                  
                  <button
                    onClick={handleTextToImage}
                    disabled={!imagePrompt.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl neon-glow-btn disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs cursor-pointer"
                  >
                    <Sparkle className="h-4 w-4" />
                    <span>GENERATE ARTWORK</span>
                  </button>
                </div>
              )}

              {/* MAGIC WRITE PANEL */}
              {activeTool === 'magic-write' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">What context should the AI generate?</label>
                    <textarea
                      value={writePrompt}
                      onChange={(e) => setWritePrompt(e.target.value)}
                      placeholder="e.g. Write a glowing and mysterious hook for a social media post selling AI generated wallpapers..."
                      rows={5}
                      className="w-full bg-[#16161a] border border-white/5 rounded-xl p-3.5 text-xs text-zinc-150 placeholder-zinc-650 focus:outline-none focus:border-violet-500/80 transition-all resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Tone</label>
                      <select
                        value={tone}
                        onChange={(e) => setTone(e.target.value)}
                        className="w-full bg-[#16161a] border border-white/5 rounded-lg p-2 text-xs text-zinc-300 focus:outline-none focus:border-violet-500/80 cursor-pointer"
                      >
                        <option value="creative">Creative</option>
                        <option value="professional">Professional</option>
                        <option value="playful">Playful</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Length</label>
                      <select
                        value={length}
                        onChange={(e) => setLength(e.target.value)}
                        className="w-full bg-[#16161a] border border-white/5 rounded-lg p-2 text-xs text-zinc-300 focus:outline-none focus:border-violet-500/80 cursor-pointer"
                      >
                        <option value="short">Short</option>
                        <option value="medium">Medium</option>
                        <option value="long">Long</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleMagicWrite}
                    disabled={!writePrompt.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl neon-glow-btn disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs cursor-pointer"
                  >
                    <PenTool className="h-4 w-4" />
                    <span>DRAFT TEXT COPY</span>
                  </button>
                </div>
              )}

              {/* MAGIC ERASER (PIXEL ERASER) PANEL */}
              {activeTool === 'eraser' && (
                <div className="space-y-5">
                  {/* Eraser Method Tabs */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Erase Method</label>
                    <div className="grid grid-cols-3 gap-1 bg-[#16161a] p-1.5 rounded-xl border border-white/5">
                      <button
                        onClick={() => setEraserSubMode('brush')}
                        className={`py-2 rounded-lg text-[10px] font-semibold transition-all duration-300 cursor-pointer ${
                          eraserSubMode === 'brush'
                            ? 'bg-[#7c3aed] text-white shadow-lg'
                            : 'text-zinc-450 hover:text-white'
                        }`}
                      >
                        Brush
                      </button>
                      <button
                        onClick={() => setEraserSubMode('prompt')}
                        className={`py-2 rounded-lg text-[10px] font-semibold transition-all duration-300 cursor-pointer ${
                          eraserSubMode === 'prompt'
                            ? 'bg-[#7c3aed] text-white shadow-lg'
                            : 'text-zinc-450 hover:text-white'
                        }`}
                      >
                        By Prompt
                      </button>
                      <button
                        onClick={() => setEraserSubMode('text-auto')}
                        className={`py-2 rounded-lg text-[10px] font-semibold transition-all duration-300 cursor-pointer ${
                          eraserSubMode === 'text-auto'
                            ? 'bg-[#7c3aed] text-white shadow-lg'
                            : 'text-zinc-450 hover:text-white'
                        }`}
                      >
                        Remove Text
                      </button>
                    </div>
                  </div>

                  {eraserSubMode === 'brush' && (
                    <>
                      {/* Brush Type Tabs */}
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Brush Type</label>
                        <div className="grid grid-cols-2 gap-2 bg-[#16161a] p-1.5 rounded-xl border border-white/5">
                          <button
                            onClick={() => setEraserMode('erase')}
                            className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-300 cursor-pointer ${
                              eraserMode === 'erase'
                                ? 'bg-[#7c3aed] text-white shadow-lg shadow-violet-500/20'
                                : 'text-zinc-450 hover:text-white'
                            }`}
                          >
                            <Eraser className="h-3.5 w-3.5" />
                            <span>Erase</span>
                          </button>
                          <button
                            onClick={() => setEraserMode('restore')}
                            className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-300 cursor-pointer ${
                              eraserMode === 'restore'
                                ? 'bg-[#7c3aed] text-white shadow-lg shadow-violet-500/20'
                                : 'text-zinc-450 hover:text-white'
                            }`}
                          >
                            <PenTool className="h-3.5 w-3.5" />
                            <span>Restore</span>
                          </button>
                        </div>
                      </div>

                      {/* Size slider */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs text-zinc-400 font-semibold mb-1">
                          <span>Brush Size</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="5"
                            max="100"
                            value={brushSize}
                            onChange={(e) => setBrushSize(Number(e.target.value))}
                            className="flex-1 cursor-pointer"
                          />
                          <input
                            type="number"
                            min="5"
                            max="100"
                            value={brushSize}
                            onChange={(e) => setBrushSize(Number(e.target.value))}
                            className="w-12 text-center bg-[#16161a] border border-white/5 rounded-lg text-xs py-1.5 text-zinc-200 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Show Original Toggle */}
                      <div className="flex items-center justify-between py-3 border-t border-b border-white/5">
                        <span className="text-xs text-zinc-400 font-semibold">Show original</span>
                        <button
                          onClick={() => setShowOriginal(!showOriginal)}
                          className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 ${
                            showOriginal ? 'bg-[#7c3aed]' : 'bg-zinc-700'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white transition-all duration-300 transform ${
                            showOriginal ? 'translate-x-4' : 'translate-x-0'
                          }`}></div>
                        </button>
                      </div>
                    </>
                  )}

                  {eraserSubMode === 'prompt' && (
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">What to erase?</label>
                      <textarea
                        value={eraserPrompt}
                        onChange={(e) => setEraserPrompt(e.target.value)}
                        placeholder="e.g. remove yellow car, power lines, scratch on table, person on right..."
                        rows={3}
                        className="w-full bg-[#16161a] border border-white/5 rounded-xl p-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-purple-500 resize-none font-sans"
                      />
                    </div>
                  )}

                  {eraserSubMode === 'text-auto' && (
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Removes all text/writings (signs, logos, watermarks, stickers) present anywhere in the image. Powered by Photoroom AI.
                    </p>
                  )}

                  <button
                    onClick={handleMagicEraser}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl neon-glow-btn text-white font-bold text-xs cursor-pointer"
                  >
                    <Eraser className="h-4 w-4" />
                    <span>
                      {eraserSubMode === 'brush' && 'ERASE OBJECT'}
                      {eraserSubMode === 'prompt' && 'ERASE BY PROMPT'}
                      {eraserSubMode === 'text-auto' && 'REMOVE ALL TEXT'}
                    </span>
                  </button>
                </div>
              )}

              {/* MAGIC EXPAND PANEL */}
              {activeTool === 'expand' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Aspect Ratio</label>
                    <div className="grid grid-cols-3 gap-2 bg-[#16161a] p-1.5 rounded-xl border border-white/5">
                      {(['1:1', '16:9', '9:16'] as const).map((ratio) => (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setExpandRatio(ratio)}
                          className={`py-2 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${
                            expandRatio === ratio
                              ? 'bg-[#7c3aed] text-white shadow-md'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">AI Expansion Context</label>
                    <textarea
                      value={expandPrompt}
                      onChange={(e) => setExpandPrompt(e.target.value)}
                      placeholder="e.g. continuous ocean shore, mountains, clear sunset sky..."
                      rows={3}
                      className="w-full bg-[#16161a] border border-white/5 rounded-xl p-2.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-purple-500 resize-none"
                    />
                  </div>

                  <button
                    onClick={handleMagicExpand}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl neon-glow-btn text-white font-bold text-xs cursor-pointer"
                  >
                    <Maximize2 className="h-4 w-4" />
                    <span>MAGIC EXPAND</span>
                  </button>
                </div>
              )}

              {/* MAGIC GRAB PANEL */}
              {activeTool === 'magic-grab' && (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Transform any flat image on the canvas into fully editable layers. Text will become editable, and the main subject will be separated into a draggable layer.
                  </p>
                  <button
                    onClick={handleMagicGrab}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl neon-glow-btn text-white font-bold text-xs cursor-pointer"
                  >
                    <Hand className="h-4 w-4" />
                    <span>GRAB ELEMENTS</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Reset Edits / Bottom Area */}
        {activeTool === 'eraser' && (
          <button 
            onClick={handleResetEraserMasks}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white px-3 py-2 rounded-lg transition-all duration-300 mt-auto cursor-pointer self-center hover:bg-white/5 border border-white/5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Eraser Stroke</span>
          </button>
        )}
      </div>
    </div>
  );
};
