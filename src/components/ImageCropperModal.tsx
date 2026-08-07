import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import { Check, X } from 'lucide-react';
import { getCroppedImg } from '../lib/cropUtils';

interface ImageCropperModalProps {
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (base64: string) => void;
  aspect?: number;
  cropShape?: "rect" | "round";
}

export default function ImageCropperModal({ imageSrc, onClose, onCropComplete, aspect = 1, cropShape = "round" }: ImageCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropCompleteEvent = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(croppedImage);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[110] bg-black/90 flex flex-col items-center justify-center p-4 animated-fade-in">
      <div className="relative w-full max-w-md h-[50vh] sm:h-[60vh] bg-black rounded-2xl overflow-hidden shadow-2xl">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onCropComplete={onCropCompleteEvent}
          onZoomChange={setZoom}
          cropShape={cropShape}
          showGrid={false}
        />
      </div>
      
      <div className="mt-6 flex flex-col items-center w-full max-w-md">
        <label className="text-white text-xs font-semibold uppercase tracking-wider mb-2">Ajustar Zoom</label>
        <input
          type="range"
          value={zoom}
          min={1}
          max={3}
          step={0.1}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full mb-8 accent-sky-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
        />
        
        <div className="flex justify-between w-full gap-4">
          <button 
            onClick={onClose} 
            className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl flex justify-center items-center gap-2 font-semibold transition-colors"
          >
            <X className="w-5 h-5"/> Cancelar
          </button>
          <button 
            onClick={handleConfirm} 
            className="flex-1 py-3.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl flex justify-center items-center gap-2 font-semibold transition-colors"
          >
            <Check className="w-5 h-5"/> Confirmar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
