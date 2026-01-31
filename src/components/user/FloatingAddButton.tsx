"use client";

import { useState } from "react";
import { Plus, Camera, Barcode, PenLine } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function FloatingAddButton() {
  const [isOpen, setIsOpen] = useState(false);

  const options = [
    { icon: Barcode, label: "Scan barcode" },
    { icon: Camera, label: "Take photo" },
    { icon: PenLine, label: "Manual entry" },
  ];

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Options */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed bottom-28 right-6 z-50 flex flex-col items-end gap-3">
            {options.map((option, index) => (
              <motion.button
                key={option.label}
                className="flex items-center gap-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ delay: (options.length - 1 - index) * 0.05 }}
                onClick={() => {
                  setIsOpen(false);
                }}
              >
                <span className="text-sm text-gray-600 bg-white px-4 py-2 rounded-full shadow-sm">
                  {option.label}
                </span>
                <div className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center">
                  <option.icon className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        className="fixed bottom-8 right-6 z-50 w-14 h-14 rounded-full bg-gray-900 flex items-center justify-center shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.95 }}
        animate={{ rotate: isOpen ? 45 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <Plus className="w-6 h-6 text-white" strokeWidth={1.5} />
      </motion.button>
    </>
  );
}
