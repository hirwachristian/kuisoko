
import React from 'react';
import { X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  confirmButtonClass?: string;
  cancelButtonClass?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel',
  confirmButtonClass = 'bg-rose-500 text-white hover:bg-rose-600',
  cancelButtonClass = 'text-slate-600 hover:bg-slate-100',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-[2.5rem] p-5 sm:p-8 w-full max-w-md shadow-xl border border-slate-100 relative">
        <h3 className="text-2xl font-black text-slate-900 mb-6">{title}</h3>
        <p className="text-slate-600 text-base mb-8">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className={`px-6 py-3 rounded-xl font-bold transition-colors ${cancelButtonClass}`}
          >
            {cancelButtonText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-6 py-3 rounded-xl font-bold transition-colors shadow-lg active:scale-95 ${confirmButtonClass}`}
          >
            {confirmButtonText}
          </button>
        </div>
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          title="Close"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

export default ConfirmationModal;
