import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Bot, Sparkles, User, Loader2, Database, MessageSquare, ShieldCheck, ChevronRight, Copy, RefreshCcw, Info, FileText, Download, PieChart as ChartIcon, FileSpreadsheet, History, Plus, Trash2, Menu, X, Key, Sun, Moon } from 'lucide-react';
import { fetchSheetData, getChatResponse, ChatMessage, ChartData, getSuggestions, getKnowledgeSummary, generateDetailedSummary, getGeminiApiKey, getWorkbookSheets } from './services/geminiService';
import { exportToExcel, exportToPDF, exportToCSV } from './services/exportService';
import DataVisualizer from './components/DataVisualizer';
import ApiKeyModal from './components/ApiKeyModal';
import AccessGate from './components/AccessGate';
import WorkspaceHub from './components/WorkspaceHub';
import { getWorkspaceAccessToken } from './services/workspaceService';
import { Language, translations } from './i18n';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatSession {
  id: string;
  title: string;
  messages: (ChatMessage & { chart?: ChartData })[];
  timestamp: number;
}

export default function App() {
  const [lang, setLang] = useState<Language>('fr');
  const t = (key: keyof typeof translations['fr']) => translations[lang][key];
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('sheetmind_sessions');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<(ChatMessage & { chart?: ChartData })[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeMainTab, setActiveMainTab] = useState<'chat' | 'workspace'>('chat');
  const [sheetData, setSheetData] = useState('');
  const [errorHeader, setErrorHeader] = useState<string | null>(null);
  const [sheetInputs, setSheetInputs] = useState<string[]>(() => {
    const saved = localStorage.getItem('sheet_ids_persistent');
    if (saved) return JSON.parse(saved);
    const singleton = localStorage.getItem('sheet_id_persistent') || import.meta.env.VITE_GOOGLE_SHEET_ID || '';
    return singleton ? [singleton] : [''];
  });
  const [isTraining, setIsTraining] = useState(false);
  const [trainingLogs, setTrainingLogs] = useState<string[]>([]);
  const [knowledgeSummary, setKnowledgeSummary] = useState<string>('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(!getGeminiApiKey());
  const [availableSheetsMap, setAvailableSheetsMap] = useState<Record<string, string[]>>({});
  const [selectedSheetsMap, setSelectedSheetsMap] = useState<Record<string, string[]>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleRefreshSuggestions = async (data: string) => {
    try {
      const newSuggestions = await getSuggestions(data);
      setSuggestions(newSuggestions);
    } catch (e) {
      console.error("Failed to refresh suggestions", e);
    }
  };

  const fetchAndSync = async (ids: string[]) => {
    const validIds = ids.filter(id => id && id !== "YOUR_SHEET_ID_HERE");
    if (validIds.length === 0) {
      setIsInitializing(false);
      return;
    }
    
    setIsTraining(true);
    setTrainingLogs(["Connexion à Google Cloud...", "Lecture du flux CSV..."]);
    setErrorHeader(null);
    
    try {
      const gToken = getWorkspaceAccessToken();
      const data = await fetchSheetData(validIds, selectedSheetsMap, gToken || undefined);
      if (!data) {
        setErrorHeader("Impossible d'accéder aux données. Vérifiez les permissions.");
        setTrainingLogs([]);
      } else {
        setSheetData(data);
        localStorage.setItem('sheet_ids_persistent', JSON.stringify(validIds));
        
        const sourceCount = validIds.length;
        const sheetCount = (data.match(/--- FEUILLE:/g) || []).length;
        
        let syncStatus = `${sourceCount} lien(s) détecté(s)...`;
        if (Object.keys(selectedSheetsMap).length > 0) {
          const totalSelected = Object.values(selectedSheetsMap).reduce((acc, curr) => acc + curr.length, 0);
          syncStatus = `${sourceCount} source(s), ${totalSelected} feuille(s) sélectionnée(s)...`;
        }

        setTrainingLogs(prev => [
          ...prev, 
          syncStatus,
          `${sheetCount} feuille(s) chargées avec succès...`,
          "Fusion des sources et analyse des liaisons...",
          "Extraction du graphe de relations...",
          "Mise en cache intelligente..."
        ]);
        
        const summary = await getKnowledgeSummary(data);
        setKnowledgeSummary(summary);
        
        // Initial suggestions
        await handleRefreshSuggestions(data);
        
        setTrainingLogs(prev => [...prev, "Entraînement multi-source terminé ✅"]);
        setTimeout(() => setTrainingLogs([]), 3000);
      }
    } catch (err) {
      setErrorHeader("Erreur lors de l'entraînement.");
    } finally {
      setIsTraining(false);
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    fetchAndSync(sheetInputs);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isTraining, trainingLogs, suggestions]);

  const handleSync = () => {
    fetchAndSync(sheetInputs);
  };

  const addSheetInput = () => {
    setSheetInputs([...sheetInputs, '']);
  };

  const removeSheetInput = (index: number) => {
    const newInputs = sheetInputs.filter((_, i) => i !== index);
    setSheetInputs(newInputs.length ? newInputs : ['']);
  };

  const updateSheetInput = (index: number, value: string) => {
    const newInputs = [...sheetInputs];
    newInputs[index] = value;
    setSheetInputs(newInputs);
  };

  useEffect(() => {
    const fetchSheetsForAll = async () => {
      const newAvailable = { ...availableSheetsMap };
      const newSelected = { ...selectedSheetsMap };
      let changed = false;
      const gToken = getWorkspaceAccessToken();

      for (const id of sheetInputs) {
        if (id && id.length > 5 && !newAvailable[id]) {
          const sheets = await getWorkbookSheets(id, gToken || undefined);
          if (sheets.length > 0) {
            newAvailable[id] = sheets;
            // Select all by default for new IDs
            if (!newSelected[id]) {
              newSelected[id] = sheets;
            }
            changed = true;
          }
        }
      }

      if (changed) {
        setAvailableSheetsMap(newAvailable);
        setSelectedSheetsMap(newSelected);
      }
    };
    fetchSheetsForAll();
  }, [sheetInputs]);

  const toggleSheetSelection = (sheetId: string, sheetName: string) => {
    setSelectedSheetsMap(prev => {
      const current = prev[sheetId] || [];
      const next = current.includes(sheetName)
        ? current.filter(s => s !== sheetName)
        : [...current, sheetName];
      return { ...prev, [sheetId]: next };
    });
  };

  const toggleAllSheets = (sheetId: string) => {
    const available = availableSheetsMap[sheetId] || [];
    const selected = selectedSheetsMap[sheetId] || [];
    
    if (selected.length === available.length) {
      setSelectedSheetsMap(prev => ({ ...prev, [sheetId]: [] }));
    } else {
      setSelectedSheetsMap(prev => ({ ...prev, [sheetId]: available }));
    }
  };

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('sheetmind_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const loadSession = (session: ChatSession) => {
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(null), 3000); // Reset confirmation after 3s
      return;
    }
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    localStorage.setItem('sheetmind_sessions', JSON.stringify(newSessions));
    setDeleteConfirmId(null);
    if (currentSessionId === id) {
      startNewChat();
    }
  };

  const handleSend = async (overrideInput?: string) => {
    const userPrompt = (overrideInput || input).trim();
    if (!userPrompt || isLoading) return;

    const newMessages = [...messages, { role: 'user' as const, text: userPrompt }];
    setInput('');
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await getChatResponse(messages, sheetData, userPrompt, knowledgeSummary);
      
      // Parse chart data if present in response
      let cleanText = response;
      let chart: ChartData | undefined;
      
      try {
        const jsonMatch = response.match(/\{.*"chart".*\}/s);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          chart = parsed.chart;
          cleanText = response.replace(jsonMatch[0], '').trim();
        }
      } catch (e) {
        console.warn("Failed to parse chart JSON");
      }

      const assistantMessage = { role: 'model' as const, text: cleanText, chart };
      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);
      setIsLoading(false);

      // Refresh suggestions based on new state
      if (sheetData) handleRefreshSuggestions(sheetData);

      // Update or Create session
      if (currentSessionId) {
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: updatedMessages } : s));
      } else {
        const newId = Date.now().toString();
        const newSession: ChatSession = {
          id: newId,
          title: userPrompt.slice(0, 40) + (userPrompt.length > 40 ? '...' : ''),
          messages: updatedMessages,
          timestamp: Date.now()
        };
        setSessions(prev => [newSession, ...prev]);
        setCurrentSessionId(newId);
      }
    } catch (error: any) {
      setIsLoading(false);
      console.error("Chat Error:", error);
      if (error.message === "API_KEY_MISSING") {
        setIsApiKeyModalOpen(true);
        setMessages(prev => [...prev, { role: 'model', text: "⚠️ Clé API manquante. Veuillez configurer votre clé pour continuer." }]);
      } else {
        setMessages(prev => [...prev, { role: 'model', text: `⚠️ Une erreur est survenue lors de l'appel à l'IA : ${error.message}` }]);
      }
    }
  };

  const handleReset = () => {
    if (messages.length > 0) {
      if (!window.confirm("Êtes-vous sûr de vouloir vider l'écran de chat actuel ? (Votre historique restera sauvegardé)")) return;
    }
    setMessages([]);
    setCurrentSessionId(null);
  };

  const handleExportPDF = () => {
    try {
      if (sheetData) exportToPDF(sheetData, '', 'rapport_ia_imbert.pdf');
    } catch (e) {
      console.error("PDF Export failed:", e);
      alert("Erreur lors de l'export PDF.");
    }
  };

  const handleSummaryPDF = async () => {
    if (!sheetData || isLoading) return;
    setIsLoading(true);
    try {
      const summary = await generateDetailedSummary(sheetData);
      exportToPDF(sheetData, summary, 'resume_ia_imbert.pdf');
    } catch (error) {
      console.error("Export failed:", error);
      alert("Erreur lors de l'export du résumé.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportExcel = () => {
    try {
      if (sheetData) exportToExcel(sheetData);
    } catch (e) {
      console.error("Excel Export failed:", e);
      alert("Erreur lors de l'export Excel.");
    }
  };

  const handleExportCSV = () => {
    try {
      if (sheetData) exportToCSV(sheetData);
    } catch (e) {
      console.error("CSV Export failed:", e);
      alert("Erreur lors de l'export CSV.");
    }
  };

  if (isInitializing && sheetInputs.some(id => id && id !== "YOUR_SHEET_ID_HERE")) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <AccessGate>
    <div className="flex h-screen bg-white dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-300">
      {/* Sidebar - History */}
      <aside className={`border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col shrink-0 transition-all duration-300 fixed lg:relative z-40 inset-y-0 ${
        isSidebarOpen 
          ? 'w-72 translate-x-0 opacity-100 border-r' 
          : 'w-72 -translate-x-full lg:translate-x-0 lg:w-0 opacity-0 overflow-hidden pointer-events-none border-none'
      }`}>
        <div className="w-72 flex flex-col h-full shrink-0">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
          <button 
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-100 dark:shadow-none active:scale-95"
          >
            <Plus className="w-4 h-4" /> {t('newChat')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <label className="px-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 block">{t('history')}</label>
          {sessions.length === 0 ? (
            <div className="py-12 text-center text-slate-300 dark:text-slate-700">
              <History className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-[10px] font-bold uppercase tracking-widest">{t('empty')}</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => loadSession(session)}
                className={`group relative flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all border ${
                  currentSessionId === session.id
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                    : 'bg-white/50 dark:bg-slate-900/50 border-transparent text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${currentSessionId === session.id ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}>
                  <MessageSquare className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold truncate tracking-tight">{session.title}</p>
                  <p className="text-[9px] opacity-60 font-bold mt-0.5">{new Date(session.timestamp).toLocaleDateString()}</p>
                </div>
                <button 
                  onClick={(e) => deleteSession(e, session.id)}
                  className={`p-1.5 rounded-lg transition-all ${
                    deleteConfirmId === session.id 
                      ? 'bg-red-500 text-white opacity-100 scale-110 shadow-lg' 
                      : 'opacity-0 group-hover:opacity-100 text-slate-400 dark:text-slate-500 hover:text-red-500'
                  }`}
                >
                  {deleteConfirmId === session.id ? <span className="text-[8px] font-black uppercase px-1">Confirmer ?</span> : <Trash2 className="w-3 h-3" />}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 space-y-3">
          <button 
            onClick={() => setIsApiKeyModalOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all shadow-sm"
          >
            <Key className="w-3.5 h-3.5" /> {t('apiKey')}
          </button>
          
          <div className="p-3 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900 rounded-xl flex items-center gap-3">
             <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
               {import.meta.env.VITE_USER_INITIAL || 'U'}
             </div>
             <div className="flex-1 min-w-0">
               <p className="text-[10px] font-bold text-slate-900 dark:text-slate-100 truncate">{t('userPremium')}</p>
               <p className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-tighter">{t('planUnlimited')}</p>
             </div>
          </div>
        </div>
        </div>
      </aside>

      {/* Main Content (Chat) */}
      <main className="flex-1 flex flex-col bg-white dark:bg-slate-950 overflow-hidden relative shadow-2xl dark:shadow-none transition-colors duration-300">
        {/* Mobile Sidebar Trigger */}
        <div className="lg:hidden absolute top-4 left-4 z-50">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5 text-slate-700 dark:text-slate-200" />}
          </button>
        </div>

        {errorHeader && (
          <div className="bg-red-50 dark:bg-red-950/20 border-b border-red-100 dark:border-red-900/30 p-4 px-8 flex flex-col gap-3 animate-in fade-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3">
              <Info className="w-4 h-4 text-red-500" />
              <p className="text-xs text-red-600 dark:text-red-400 font-bold uppercase tracking-wider">{errorHeader}</p>
              <button 
                onClick={() => window.location.reload()}
                className="ml-auto text-[10px] bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-2 py-1 rounded font-bold hover:bg-red-200"
              >
                Actualiser
              </button>
            </div>
            <div className="text-[11px] text-red-500/80 dark:text-red-400/80 leading-relaxed bg-white/50 dark:bg-slate-900/50 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
              <p className="font-bold mb-1">Comment corriger :</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>Ouvrez votre Google Sheet</li>
                <li>Cliquez sur <span className="font-bold">Partager</span> (haut à droite)</li>
                <li>Modifiez "Accès général" en <span className="font-bold">"Tous les utilisateurs disposant du lien"</span></li>
                <li>Vérifiez que le rôle est <span className="font-bold">"Lecteur"</span></li>
              </ol>
            </div>
          </div>
        )}
        <header className="h-16 shrink-0 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-8 lg:px-10 bg-white/50 dark:bg-slate-950/50 backdrop-blur-xl sticky top-0 z-30 transition-colors duration-300">
          <div className="flex items-center gap-4">
             <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100 dark:shadow-none hidden lg:flex">
               <Database className="w-4 h-4" />
             </div>
             <h2 className="font-black text-slate-800 dark:text-slate-100 text-sm tracking-tight lg:ml-0 ml-12 uppercase flex items-center gap-2">
               Session de chat
               <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block"></span>
             </h2>

             {/* Collapsible Sidebar Controls */}
             <div className="hidden sm:flex items-center gap-2 ml-4">
               <button
                 onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border shadow-xs ${
                   isSidebarOpen 
                     ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400' 
                     : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-450 hover:bg-slate-50 dark:hover:bg-slate-850'
                 }`}
                 title={isSidebarOpen ? "Masquer l'Historique" : "Afficher l'Historique"}
               >
                 <History className="w-3.5 h-3.5" />
                 <span>Historique</span>
               </button>

               <button
                 onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border shadow-xs ${
                   isRightSidebarOpen 
                     ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/45 text-emerald-700 dark:text-emerald-450' 
                     : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-450 hover:bg-slate-50 dark:hover:bg-slate-850'
                 }`}
                 title={isRightSidebarOpen ? "Masquer les Paramètres" : "Afficher les Paramètres"}
               >
                 <Database className="w-3.5 h-3.5 text-emerald-500" />
                 <span>Paramètres</span>
               </button>
             </div>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Language)}
              className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold uppercase dark:text-slate-200"
            >
              <option value="en">EN</option>
              <option value="fr">FR</option>
              <option value="ar">AR</option>
            </select>
            
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-slate-500 dark:text-slate-400"
              title={isDarkMode ? 'Mode clair' : 'Mode sombre'}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">{t('connectedStable')}</span>
            <button 
              onClick={handleReset}
              className="px-4 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-black uppercase hover:bg-slate-100 transition-all active:scale-95"
            >
              Réinitialiser
            </button>
          </div>
        </header>

        {/* Tab Selector Area */}
        <div className="border-b border-slate-100 dark:border-slate-800/85 bg-slate-50/20 dark:bg-slate-900/10 px-6 sm:px-8 py-3 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
          <div className="flex gap-1.5 p-1 bg-slate-100/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-2xl w-full sm:w-auto">
            <button
              onClick={() => setActiveMainTab('chat')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-150 ${
                activeMainTab === 'chat'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-extrabold border border-indigo-100/20 dark:border-slate-750'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-250'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {lang === 'fr' ? 'Discussion & Analyse IA' : lang === 'ar' ? 'دردشة وتحليل' : 'AI Analysis & Chat'}
            </button>
            <button
              onClick={() => setActiveMainTab('workspace')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-150 ${
                activeMainTab === 'workspace'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-extrabold border border-indigo-100/20 dark:border-slate-755'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-250'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {lang === 'fr' ? 'Espace Collaboratif Intelligent' : lang === 'ar' ? 'المساحة التعاونية' : 'Collaborative Workspace'}
            </button>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
            </span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              {activeMainTab === 'chat' ? (lang === 'fr' ? 'Discussion' : 'AI Active') : (lang === 'fr' ? 'Google Workspace' : 'Workspace Connected')}
            </span>
          </div>
        </div>

        {/* Tab content panels */}
        {activeMainTab === 'workspace' ? (
          <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 max-w-7xl mx-auto w-full scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 transition-colors duration-300">
            <WorkspaceHub 
              onLoadSheetId={(id) => {
                const cleanedId = id.includes("/")
                  ? id.split("/d/")[1]?.split("/")[0] || id.trim()
                  : id.trim();
                
                const exists = sheetInputs.some(input => {
                  const existingClean = input.includes("/")
                    ? input.split("/d/")[1]?.split("/")[0] || input.trim()
                    : input.trim();
                  return existingClean === cleanedId;
                });

                if (!exists) {
                  const newInputs = (sheetInputs.length === 1 && !sheetInputs[0]) ? [id] : [...sheetInputs, id];
                  setSheetInputs(newInputs);
                  fetchAndSync(newInputs);
                } else {
                  fetchAndSync(sheetInputs);
                }
                
                // Switch tab visual focus to AI Chat so they can converse immediately
                setActiveMainTab('chat');
              }}
              onLoadCsvData={(csvText, summary, inputs) => {
                setSheetData(csvText);
                if (summary) {
                  setKnowledgeSummary(summary);
                }
                if (inputs) {
                  setSheetInputs(inputs);
                }
                setActiveMainTab('chat');
              }}
              activeCsvData={sheetData}
              lang={lang}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 max-w-4xl mx-auto w-full scroll-smooth scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 transition-colors duration-300">
            {messages.length === 0 && !isInitializing && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center py-20"
              >
                <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center mb-6 transition-colors">
                  <Bot className="w-10 h-10 text-slate-200 dark:text-slate-700" />
                </div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight transition-colors">{t('helloPreready')}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium max-w-xs mt-2 transition-colors">
                  {t('introText')}
                </p>
              </motion.div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start gap-4'}`}
                >
                  {msg.role === 'model' && (
                    <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 font-black text-[10px] shadow-sm transition-colors">
                      AI
                    </div>
                  )}
                  <div className={`px-6 py-5 rounded-[2rem] max-w-[88%] shadow-sm text-[13px] leading-relaxed tracking-tight transition-colors ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 dark:bg-indigo-600 text-white rounded-tr-none shadow-xl shadow-indigo-50 dark:shadow-none border border-indigo-500 dark:border-indigo-400' 
                      : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-tl-none font-medium'
                  }`}>
                    <div className="markdown-body prose prose-slate dark:prose-invert max-w-none">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({children}) => (
                            <div className="relative group">
                              <table className="mt-4 mb-4">{children}</table>
                              <div className="flex gap-1 absolute top-0 right-0 p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all">
                                <button 
                                  className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                  title="Excel"
                                  onClick={(e) => {
                                    const table = e.currentTarget.parentElement?.parentElement?.querySelector('table');
                                    if (!table) return;
                                    const rows = Array.from(table.querySelectorAll('tr'));
                                    const data = rows.map(row => 
                                      Array.from(row.querySelectorAll('th, td')).map(cell => cell.textContent?.trim() || '')
                                    );
                                    exportToExcel(JSON.stringify(data), 'table_export.xlsx');
                                  }}
                                ><FileSpreadsheet className="w-4 h-4" /></button>
                                <button 
                                  className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                  title="PDF"
                                  onClick={(e) => {
                                    const table = e.currentTarget.parentElement?.parentElement?.querySelector('table');
                                    if (!table) return;
                                    const rows = Array.from(table.querySelectorAll('tr'));
                                    const data = rows.map(row => 
                                      Array.from(row.querySelectorAll('th, td')).map(cell => cell.textContent?.trim() || '')
                                    );
                                    const csvContent = data.map(r => r.join(',')).join('\n');
                                    exportToPDF(csvContent, 'Table Export', 'table_export.pdf');
                                  }}
                                ><FileText className="w-4 h-4" /></button>
                              </div>
                            </div>
                          )
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                    {msg.chart && <div className="mt-6"><DataVisualizer config={msg.chart} /></div>}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start gap-4"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 font-black text-[10px] transition-colors">
                  AI
                </div>
                <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 px-6 py-4 rounded-[2rem] rounded-tl-none flex items-center gap-3 transition-colors">
                  <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                  <span className="text-[11px] font-bold italic tracking-tight">Intelligence en action...</span>
                </div>
              </motion.div>
            )}

            <AnimatePresence>
              {suggestions.length > 0 && !isLoading && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="flex flex-col items-center gap-4 mt-12 mb-6"
                >
                  <div className="flex flex-wrap justify-center gap-2 max-w-2xl px-4 animate-in fade-in duration-700">
                    {suggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(suggestion)}
                        className="text-[11px] font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 px-5 py-2.5 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all shadow-sm active:scale-95 flex items-center gap-2"
                      >
                        {suggestion}
                      </button>
                    ))}
                    <button 
                      onClick={() => handleRefreshSuggestions(sheetData)}
                      className="p-2.5 text-slate-300 dark:text-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all hover:rotate-180 duration-500"
                      title="Régénérer les suggestions"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Action Area */}
        {activeMainTab === 'chat' && (
          <div className="p-6 md:p-8 border-t border-slate-50 dark:border-slate-900 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md transition-colors duration-300">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-3xl p-2 pl-6 focus-within:ring-4 focus-within:ring-indigo-50 dark:focus-within:ring-indigo-900/20 focus-within:border-indigo-200 dark:focus-within:border-indigo-800 transition-all shadow-xl shadow-slate-100 dark:shadow-none">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ex: Analyse la corrélation entre les ventes et la météo..."
                  disabled={isInitializing}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-4 placeholder:text-slate-300 dark:placeholder:text-slate-600 font-semibold dark:text-slate-100"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading || isInitializing}
                  className="bg-indigo-600 dark:bg-indigo-500 text-white h-12 w-12 rounded-2xl flex items-center justify-center hover:bg-slate-900 dark:hover:bg-indigo-600 transition-all shadow-lg dark:shadow-none active:scale-90 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-300 dark:disabled:text-slate-600 overflow-hidden relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <Send className="w-5 h-5 relative z-10" />
                </button>
              </div>
              <div className="flex items-center justify-center gap-8 mt-6 text-[9px] text-slate-300 dark:text-slate-600 font-black uppercase tracking-[0.3em]">
                <div className="flex items-center gap-2 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
                  <ShieldCheck className="w-3.5 h-3.5" /> Chiffré bout en bout
                </div>
                <span className="w-1.5 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full" />
                <div className="flex items-center gap-2 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all cursor-default flex-row">
                  <ChartIcon className="w-3.5 h-3.5" /> Visualisation IA
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Right Sidebar - Tools & Config */}
      <aside className={`border-slate-100 dark:border-slate-800 bg-slate-50/35 dark:bg-slate-900/35 flex flex-col shrink-0 transition-all duration-300 fixed xl:relative z-40 inset-y-0 right-0 ${
        isRightSidebarOpen 
          ? 'w-80 translate-x-0 opacity-100 border-l' 
          : 'w-80 translate-x-full xl:translate-x-0 xl:w-0 opacity-0 overflow-hidden pointer-events-none border-none'
      }`}>
        <div className="w-80 flex flex-col h-full shrink-0">
          <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
            <RefreshCcw className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            {t('sourceSettings')}
          </h4>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-tighter">{t('syncLabel')}</p>
          
          <div className="mt-6 space-y-4">
            {sheetInputs.map((input, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex gap-2 group relative">
                  <div className="relative flex-1">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg blur opacity-0 group-focus-within:opacity-20 transition-all"></div>
                    <input 
                      type="text" 
                      value={input}
                      onChange={(e) => updateSheetInput(idx, e.target.value)}
                      placeholder="ID ou URL Google Sheet"
                      className="relative w-full text-[10px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-all font-mono font-bold dark:text-slate-200"
                    />
                  </div>
                  {sheetInputs.length > 1 && (
                    <button 
                      onClick={() => removeSheetInput(idx)}
                      className="p-3 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Selection de feuilles */}
                {input && availableSheetsMap[input] && availableSheetsMap[input].length > 1 && (
                  <div className="ml-1 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800 transition-colors">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">{t('sheetsToInclude')}</span>
                      <button 
                        onClick={() => toggleAllSheets(input)}
                        className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                      >
                        {(selectedSheetsMap[input]?.length || 0) === availableSheetsMap[input].length ? t('deselectAll') : t('selectAll')}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {availableSheetsMap[input].map(sheet => (
                        <button
                          key={sheet}
                          onClick={() => toggleSheetSelection(input, sheet)}
                          className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all border ${
                            (selectedSheetsMap[input] || []).includes(sheet)
                              ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-900'
                          }`}
                        >
                          {sheet}
                        </button>
                      ))}
                    </div>
                    {(selectedSheetsMap[input]?.length === 0) && (
                      <p className="mt-2 text-[8px] text-red-400 dark:text-red-500 font-bold italic">{t('noSheetsSelected')}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
            
            <button 
              onClick={addSheetInput}
              className="w-full py-2 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-lg text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest hover:border-indigo-200 dark:hover:border-indigo-700 hover:text-indigo-500 dark:hover:text-indigo-400 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('addSource')}
            </button>

            <button 
              onClick={handleSync}
              disabled={isTraining || sheetInputs.every(i => !i)}
              className="w-full mt-2 py-4 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-600 dark:hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 shadow-xl dark:shadow-none active:scale-95 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-300 dark:disabled:text-slate-600"
            >
              {isTraining ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
              {t('syncAll')}
            </button>

            {sheetInputs.length > 1 && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-lg">
                <p className="text-[9px] font-bold text-amber-700 dark:text-amber-500 uppercase leading-relaxed flex items-center gap-2">
                  <Info className="w-3 h-3" /> Analyse Relationnelle
                </p>
                <p className="text-[9px] text-amber-600 dark:text-amber-600/80 mt-1 leading-tight">
                  Demandez à l'IA : "Quelle est la liaison entre SOURCE 1 et SOURCE 2 ?" pour croiser les données.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10 transition-colors duration-300">
          <section>
            <h5 className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mb-4">Exportation Rapport</h5>
            <div className="space-y-3">
              <button 
                onClick={handleSummaryPDF}
                disabled={isLoading || !sheetData}
                className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-indigo-400 dark:hover:border-indigo-700 hover:shadow-xl dark:hover:shadow-none hover:shadow-indigo-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Résumé IA</p>
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500">PDF Intelligent</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-700 group-hover:text-indigo-500" />
              </button>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleExportExcel} 
                  className="w-full flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-2xl hover:bg-green-100 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-800 hover:shadow-xl dark:hover:shadow-none hover:shadow-green-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Exporter vers Excel</p>
                      <p className="text-[9px] font-bold text-green-600 dark:text-green-500">Format .xlsx natif</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-green-300 dark:text-green-700 group-hover:text-green-600" />
                </button>

                <div className="grid grid-cols-1 gap-3">
                  <button onClick={handleExportPDF} className="p-3.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-center gap-3 hover:bg-white dark:hover:bg-slate-800 hover:shadow-lg dark:hover:shadow-none transition-all group">
                    <FileText className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter transition-colors">Exporter en PDF</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {sheetData && (
            <section className="animate-in fade-in zoom-in duration-500">
               <h5 className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mb-4 transition-colors">Explorateur de Données</h5>
               <button 
                  onClick={() => {
                    const win = window.open('', '_blank');
                    if (win) {
                      win.document.write(`
                        <html>
                          <head>
                            <title>Sheet App IA - Explorateur de Données</title>
                            <script src="https://cdn.tailwindcss.com"></script>
                            <style>
                              body { background: #f8fafc; font-family: sans-serif; }
                              table { width: 100%; border-collapse: collapse; margin-top: 20px; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
                              th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
                              th { background: #f1f5f9; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }
                              tr:hover { background: #f8fafc; }
                              .header { padding: 40px; background: white; border-bottom: 1px solid #e2e8f0; }
                              .container { max-width: 1200px; margin: 0 auto; padding: 40px; }
                            </style>
                          </head>
                          <body>
                            <div class="header">
                              <div class="max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center;">
                                <h1 style="font-weight: 900; letter-spacing: -0.025em; font-size: 24px; color: #1e293b;">Explorateur de Données</h1>
                                <button onclick="window.print()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-xs">Imprimer / PDF</button>
                              </div>
                            </div>
                            <div class="container">
                              <div id="table-container">Chargement...</div>
                            </div>
                            <script>
                              const csv = \`${sheetData.replace(/`/g, '\\`').replace(/\${/g, '\\${')}\`;
                              const sheets = csv.split('--- FEUILLE:').filter(s => s.trim());
                              
                              let html = '';
                              sheets.forEach(s => {
                                const parts = s.split('---');
                                const name = parts[0].trim();
                                const data = parts[1]?.trim() || '';
                                
                                html += \`<h2 style="font-weight: 900; color: #6366f1; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 40px;">\${name}</h2>\`;
                                html += '<table>';
                                const lines = data.split('\\n').filter(l => l.trim());
                                if (lines.length > 0) {
                                  // Header
                                  html += '<thead><tr>';
                                  const headers = lines[0].split(',');
                                  headers.forEach(h => html += \`<th>\${h.replace(/"/g, '')}</th>\`);
                                  html += '</tr></thead>';
                                  
                                  // Body
                                  html += '<tbody>';
                                  for (let i = 1; i < Math.min(lines.length, 500); i++) {
                                    html += '<tr>';
                                    const cells = lines[i].split(',');
                                    cells.forEach(c => html += \`<td>\${c.replace(/"/g, '')}</td>\`);
                                    html += '</tr>';
                                  }
                                  html += '</tbody>';
                                  if (lines.length > 500) {
                                    html += \`<tfoot><tr><td colspan="\${headers.length}" style="text-align: center; color: #94a3b8; font-style: italic; font-size: 11px; padding: 20px;">Affichage limité aux 500 premières lignes</td></tr></tfoot>\`;
                                  }
                                }
                                html += '</table>';
                              });
                              document.getElementById('table-container').innerHTML = html;
                            </script>
                          </body>
                        </html>
                      `);
                      win.document.close();
                    }
                  }}
                  className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-indigo-400 dark:hover:border-indigo-700 hover:shadow-xl dark:hover:shadow-none transition-all group"
               >
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 dark:text-orange-400 group-hover:bg-orange-600 group-hover:text-white transition-all">
                     <FileSpreadsheet className="w-5 h-5" />
                   </div>
                   <div className="text-left">
                     <p className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Voir l'ensemble</p>
                     <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500">Explorateur complet</p>
                   </div>
                 </div>
                 <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-700 group-hover:text-orange-500" />
               </button>
            </section>
          )}

          {sheetData && (
            <section className="animate-in fade-in zoom-in duration-500">
               <h5 className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mb-4 transition-colors">Statut de l'Intelligence</h5>
               <div className="p-5 bg-gradient-to-br from-indigo-600 to-indigo-800 dark:from-indigo-700 dark:to-indigo-900 rounded-3xl text-white shadow-2xl shadow-indigo-200 dark:shadow-none relative overflow-hidden transition-colors">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                 <div className="relative z-10">
                   <div className="flex items-center gap-2 text-[10px] font-bold opacity-80 uppercase tracking-widest mb-3">
                     <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]"></span>
                     Base Opérationnelle
                   </div>
                   {knowledgeSummary && (
                     <p className="text-[11px] font-bold leading-relaxed italic opacity-95">"{knowledgeSummary}"</p>
                   )}
                 </div>
               </div>
            </section>
          )}

          {trainingLogs.length > 0 && (
            <section>
              <h5 className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mb-4 transition-colors">Console Logs</h5>
              <div className="bg-slate-900 dark:bg-black rounded-2xl p-5 shadow-2xl border border-slate-800 dark:border-slate-900 overflow-hidden relative transition-colors">
                <div className="absolute top-2 right-4 flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500/50"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500/50"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500/50"></div>
                </div>
                <div className="space-y-2 mt-2">
                  {trainingLogs.map((log, i) => (
                    <p key={i} className="text-[9px] font-mono text-indigo-300 dark:text-indigo-400 leading-snug flex gap-2">
                      <span className="opacity-30">[{i+1}]</span> {log}
                    </p>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="p-8 border-t border-slate-100 dark:border-slate-800 mt-auto bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm transition-colors duration-300">
           <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center gap-3 group hover:border-indigo-200 dark:hover:border-indigo-800 transition-all">
             <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform transition-colors">
               <ShieldCheck className="w-5 h-5" />
             </div>
             <div>
                <p className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter transition-colors">Sécurité IA</p>
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 transition-colors">Canal Privé & Sécurisé</p>
             </div>
           </div>
           
           <div className="mt-6 text-center">
             <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">
               Développé par <span className="text-indigo-500 dark:text-indigo-400">Omar Badrani</span>
             </p>
           </div>
        </div>
        </div>
      </aside>
      
      <ApiKeyModal 
        isOpen={isApiKeyModalOpen} 
        onClose={() => setIsApiKeyModalOpen(false)} 
        onSaved={handleSync}
      />
    </div>
    </AccessGate>
  );
}
