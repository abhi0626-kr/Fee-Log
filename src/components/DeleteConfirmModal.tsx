'use client';

import React from 'react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title = 'Delete Log Entry',
  message = 'Are you sure you want to delete this log entry? This action cannot be undone.',
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  const handleClose = () => {
    if (onCancel) onCancel();
    else if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="bg-surface-container/95 border border-white/10 text-on-surface w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 rounded-full bg-error-container/20 text-error border border-error/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">delete</span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            ✕
          </button>
        </div>

        <h3 className="text-base font-bold text-on-surface mb-1">
          {title}
        </h3>
        <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
          {message}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-full border border-white/10 bg-surface-container-low text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              handleClose();
            }}
            className="flex-1 py-2.5 rounded-full bg-error-container text-on-error-container font-bold text-xs shadow-md hover:bg-error transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
