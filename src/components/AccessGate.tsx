import { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';

export default function AccessGate({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/check-auth')
      .then(res => res.json())
      .then(data => setAuthorized(data.authorized));
  }, []);

  const handleVerify = async () => {
    const res = await fetch('/api/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    if (res.ok) {
      setAuthorized(true);
    } else {
      setError(true);
    }
  };

  if (authorized === null) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (authorized) return <>{children}</>;

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100 dark:border-slate-800 transition-colors">
        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Lock className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
        </div>
        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 text-center mb-2">Accès restreint</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">Veuillez entrer le code d'accès pour continuer.</p>
        <input
          type="password"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(false); }}
          className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl mb-4 text-center font-mono font-bold text-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          placeholder="Code d'accès"
        />
        <button
          onClick={handleVerify}
          className="w-full py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all active:scale-95 shadow-lg shadow-indigo-100 dark:shadow-none"
        >
          Accéder
        </button>
        {error && <p className="text-red-500 dark:text-red-400 text-xs font-bold text-center mt-4">Code incorrect.</p>}
        
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
           <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
             Développé par <span className="text-indigo-500">Omar Badrani</span>
           </p>
        </div>
      </div>
    </div>
  );
}
