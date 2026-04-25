import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[32px] border border-white/10 bg-[#0a0f18] p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-3xl font-romantic italic font-black text-white">{title}</h2>
          <button 
            onClick={onClose}
            className="rounded-full p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="prose prose-invert max-w-none">
          {children}
        </div>
      </div>
    </div>
  );
}
