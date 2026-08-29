import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import { Check, X, Maximize2, Loader2 } from 'lucide-react';
import { getCroppedImg, compressOriginalImage } from '../lib/cropUtils';

interface ImageCropperModalProps {
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (base64: string) => void;
  aspect?: number;
  cropShape?: "rect" | "round";
  allowUseOriginal?: boolean;
}

export default function ImageCropperModal({ 
  imageSrc, 
  onClose, 
  onCropComplete, 
  aspect = 1, 
  cropShape = "rect",
  allowUseOriginal = true 
}: ImageCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropCompleteEvent = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      if (croppedAreaPixels) {
        const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, 1200, 0.82);
        onCropComplete(croppedImage);
      } else {
        const compressed = await compressOriginalImage(imageSrc, 1200, 0.82);
        onCropComplete(compressed);
      }
    } catch (e) {
      console.error(e);
      // Fallback
      onCropComplete(imageSrc);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUseOriginal = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const compressed = await compressOriginalImage(imageSrc, 1200, 0.82);
      onCropComplete(compressed);
    } catch (e) {
      console.error(e);
      onCropComplete(imageSrc);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[250] bg-black/90 flex flex-col items-center justify-center p-4 animated-fade-in">
      <div className="relative w-full max-w-lg h-[50vh] sm:h-[55vh] bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onCropComplete={onCropCompleteEvent}
          onZoomChange={setZoom}
          cropShape={cropShape}
          showGrid={true}
        />
      </div>
      
      <div className="mt-4 flex flex-col items-center w-full max-w-lg">
        <div className="flex items-center justify-between w-full mb-2">
          <label className="text-white text-xs font-semibold uppercase tracking-wider">Ajustar Zoom / Enquadramento</label>
          <span className="text-xs text-slate-400 font-mono">{zoom.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          value={zoom}
          min={1}
          max={3}
          step={0.1}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full mb-5 accent-sky-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
        />
        
        {allowUseOriginal && (
          <button
            type="button"
            onClick={handleUseOriginal}
            disabled={isProcessing}
            className="w-full mb-3 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-sky-400 hover:text-sky-300 border border-slate-700 hover:border-sky-500/50 rounded-xl flex justify-center items-center gap-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
            ) : (
              <Maximize2 className="w-4 h-4 text-sky-400" />
            )}
            <span>{isProcessing ? "Otimizando Imagem..." : "Usar Foto Inteira Original (Sem Cortar)"}</span>
          </button>
        )}

        <div className="flex justify-between w-full gap-3">
          <button 
            type="button"
            onClick={onClose} 
            disabled={isProcessing}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl flex justify-center items-center gap-2 text-sm font-semibold transition-colors cursor-pointer"
          >
            <X className="w-4 h-4"/> Cancelar
          </button>
          <button 
            type="button"
            onClick={handleConfirm} 
            disabled={isProcessing}
            className="flex-1 py-3 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white rounded-xl flex justify-center items-center gap-2 text-sm font-bold transition-colors shadow-lg shadow-sky-500/20 cursor-pointer"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Check className="w-4 h-4"/>
            )}
            <span>{isProcessing ? "Processando..." : "Aplicar Corte"}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
