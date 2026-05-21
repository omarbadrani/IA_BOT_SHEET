import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Key, ShieldCheck, X, Check, ExternalLink, AlertCircle } from 'lucide-react';
import { getGeminiApiKey, setGeminiApiKey } from '../services/geminiService';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function ApiKeyModal({ isOpen, onClose, onSaved }: ApiKeyModalProps) {
  const [keyInput, setKeyInput] = useState(getGeminiApiKey());
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    if (!keyInput.trim()) {
      setError("La clé API ne peut pas être vide.");
      return;
    }
    
    // Simple validation (Gemini keys usually start with AIza)
    if (!keyInput.startsWith('AIza')) {
      setError("Format de clé invalide. Une clé Gemini API commence généralement par 'AIza'.");
      // We allow it anyway just in case the format changes
    }

    setGeminiApiKey(keyInput.trim());
    setIsSaved(true);
    setError(null);
    
    setTimeout(() => {
      setIsSaved(false);
      onClose();
      if (onSaved) onSaved();
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 transition-colors"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100 dark:shadow-none">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Configuration API</h2>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Bring Your Own Key (BYOK)</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl flex gap-3 text-amber-700 dark:text-amber-400 transition-colors">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <div className="text-[11px] font-medium leading-relaxed">
                    <p className="font-bold mb-1 underline">Pourquoi une clé personnelle ?</p>
                    Pour garantir votre confidentialité et votre propre quota de requêtes. Votre clé est stockée uniquement <span className="font-bold underline">localement</span> dans votre navigateur.
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Clé API Google Gemini</label>
                  <div className="relative group">
                    <input
                      type="password"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder="Entrez votre clé AIza..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-2xl p-4 pr-12 text-sm font-mono focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/20 focus:border-indigo-200 dark:focus:border-indigo-800 transition-all outline-none"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                  </div>
                  {error && <p className="text-[10px] text-red-500 dark:text-red-400 font-bold mt-2 ml-1">{error}</p>}
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleSave}
                    disabled={isSaved}
                    className={`w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95 ${
                      isSaved ? 'bg-green-500 text-white' : 'bg-slate-900 dark:bg-indigo-600 text-white hover:bg-indigo-600 dark:hover:bg-indigo-700 shadow-indigo-100 dark:shadow-none'
                    }`}
                  >
                    {isSaved ? (
                      <>
                        <Check className="w-4 h-4" /> Enregistré !
                      </>
                    ) : (
                      "Sauvegarder la clé"
                    )}
                  </button>
                  
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline py-2"
                  >
                    Obtenir une clé gratuite sur Google AI Studio <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
