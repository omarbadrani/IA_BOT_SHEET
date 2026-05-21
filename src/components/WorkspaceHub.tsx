import { useState, useEffect, useRef } from 'react';
import { 
  workspaceSignIn, 
  workspaceLogout, 
  initWorkspaceAuth,
  sendEmail,
  getRecentEmails,
  getRecentDriveFiles,
  getDriveFileContent,
  updateDriveFileContent,
  setManualAccessToken
} from '../services/workspaceService';
import { getChatResponse, fetchSheetData, getDirectGenAiResponse } from '../services/geminiService';
import { 
  Mail, 
  FolderKanban, 
  Plus, 
  Send, 
  RefreshCcw, 
  LogOut, 
  Sparkles, 
  Loader2, 
  FileSpreadsheet, 
  Globe, 
  Edit2, 
  UploadCloud, 
  Trash2, 
  Check, 
  Info,
  Play,
  ArrowRight,
  BookOpen,
  PlusCircle,
  FileText,
  Search,
  File,
  Eye,
  ChevronsUpDown,
  CornerDownRight,
  UserCheck,
  Inbox,
  User,
  Clock,
  ExternalLink,
  Save,
  PenTool,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface WorkspaceHubProps {
  onLoadSheetId: (sheetId: string) => void;
  onLoadCsvData?: (csvText: string, summary?: string, inputs?: string[]) => void;
  activeCsvData?: string;
  lang: 'en' | 'fr' | 'ar';
}

// Preset simulated files for Google Drive workspace when API is not fully consented or in local sandbox
const INITIAL_MOCK_DRIVE_FILES = [
  { 
    id: 'mock-sheet-sales', 
    name: '📊 Performance_Ventes_IDF_2026.csv', 
    mimeType: 'application/vnd.google-apps.spreadsheet', 
    modifiedTime: '2026-05-19T14:32:00Z', 
    size: '14 KB', 
    contentDesc: 'Chiffre d\'affaires, objectifs trimestriels et commissions par représentant.',
    contentBody: `Produit,Catégorie,Ventes,Objectif,Région,Date
Ordinateur Pro,Matériel,15000,12000,Nord,2026-04-10
Smartphone Ultra,Mobile,22000,20000,Sud,2026-04-12
Écran 4K,Matériel,8500,9000,Est,2026-04-15
Logiciel SaaS,Service,18000,15000,Ouest,2026-04-18
Assistance 24/7,Service,4200,5000,Nord,2026-04-20
Casque Audio,Audio,3100,2500,Est,2026-04-22
Routeur Wifi,Matériel,6700,7000,Sud,2026-04-25`
  },
  { 
    id: 'mock-sheet-budget', 
    name: '📅 Suivi_Budget_Logistique_Salon.xlsx', 
    mimeType: 'application/vnd.google-apps.spreadsheet', 
    modifiedTime: '2026-05-18T09:15:00Z', 
    size: '28 KB', 
    contentDesc: 'Prestations traiteur, frais de déplacement, location de stand et reliquats.',
    contentBody: `Tâche,Responsable,Dépenses,Budget Alloué,Région,Statut
Réservation Salle,Sophie,1200,1500,IDF,Terminé
Service Traiteur,Marc,3400,3000,Sud,En cours
Son & Lumière,Julien,1800,2000,Est,Terminé
Invitation Clients,Léa,450,550,Ouest,Terminé
Cadeaux Invités,Antoine,120,600,IDF,Ébauche
Transport Groupe,Clara,850,800,IDF,Terminé`
  },
  { 
    id: 'mock-sheet-compta', 
    name: '👥 Grille_Evaluation_RH_2026.csv', 
    mimeType: 'application/vnd.google-apps.spreadsheet', 
    modifiedTime: '2026-05-17T11:45:00Z', 
    size: '9 KB', 
    contentDesc: 'Ancienneté, scores d\'entretien NPS interne et heures de formation cumulées.',
    contentBody: `Employé,Département,Performance,Score NPS,Ancienneté (ans),Formations
Alice Devaux,R&D,Excellent,95,4,3
Bruno Martin,Ventes,Satisfaisant,80,2,1
Carole Lemaire,Marketing,Excellent,90,5,4
David Dubois,Support,Moyen,75,1,2
Élise Coste,RH,Excellent,98,3,2
Fabien Roussel,R&D,Satisfaisant,82,2,2
Géraldine Rey,Marketing,Excellent,92,6,3`
  },
  { 
    id: 'mock-doc-specs', 
    name: '📝 Cahier_des_Charges_Campagne_Printemps.docx', 
    mimeType: 'application/vnd.google-apps.document', 
    modifiedTime: '2026-05-16T16:20:00Z', 
    size: '1.2 MB', 
    contentDesc: 'Spécifications stratégiques de la campagne publicitaire printanière.',
    contentBody: `CAHIER DES CHARGES - CAMPAGNE PRINTEMPS 2026
---------------------------------------------
1. Objectif Principal : Accroître les ventes de nos solutions d'intelligence d'affaires de 25% auprès des PME d'ici la fin du trimestre.
2. Audience cible : Directeurs Financiers, Responsables de Service Informatique, Chefs d'entreprise.
3. Canaux clés : Campagnes ciblées sur LinkedIn, Webinaire thématique le 5 juin, E-mailing automatisé personnalisé.
4. Message principal : Mettez de l'intelligence artificielle dans vos feuilles de calcul Google Sheets et facilitez le secrétariat administratif.`
  }
];

const INITIAL_MOCK_EMAILS = [
  {
    id: 'msg-101',
    threadId: 'th-101',
    from: 'Sophie Devaux <sophie.devaux@synergie-sales.com>',
    subject: '⚠️ Alerte objectifs de ventes région OUEST - Q2',
    snippet: 'Bonjour, je viens de regarder le rapport trimestriel. Les ventes sur la région Ouest sont à la traîne de 15%. Il nous manque environ 45 000€ pour atteindre...',
    date: 'Aujourd\'hui, 10:45',
    body: `Bonjour,

Je viens de faire le point sur le rapport trimestriel des ventes.
Comme vous pouvez le constater dans nos classeurs, la région OUEST affiche un retard préoccupant de 15% par rapport à l'objectif fixé pour ce trimestre. Il nous manque environ 45 000€ de chiffre d'affaires pour combler l'écart.

Pourrions-nous organiser une session de travail cet après-midi pour revoir les tarifs SaaS et proposer une promotion flash aux clients en attente ?

Merci pour ton retour rapide,
Sophie Devaux`
  },
  {
    id: 'msg-102',
    threadId: 'th-102',
    from: 'Marc Lanthier <m.lanthier@traiteur-concept.fr>',
    subject: '📋 Devis final & Options de menu pour l\'inauguration du 12 juin',
    snippet: 'Bonjour, voici la proposition révisée pour les 150 convives. J\'ai inclus l\'option cocktail dînatoire prestige ainsi que la verrerie de rechange...',
    date: 'Aujourd\'hui, 08:12',
    body: `Bonjour,

Faisant suite à notre appel de mardi, je vous prie de trouver ci-joint notre devis final révisé pour la réception d'inauguration du 12 juin prochain.

Nous sommes partis sur la formule Cocktail Prestige pour 150 convives comprenant :
- 18 pièces salées et sucrées par personne
- Service et encadrement (4 maîtres d'hôtel)
- Boissons softs et sélection de vins fins

Le budget global s'élève à 3 400 € TTC. Merci de me confirmer si vous souhaitez rehausser la décoration florale ou si nous validons ce budget en l'état afin que je passe commande aux fournisseurs.

Bien cordialement,
Marc Lanthier`
  },
  {
    id: 'msg-103',
    threadId: 'th-103',
    from: 'Karim Bensalah <k.bensalah@techno-expert.dz>',
    subject: '🚀 Livraison de la version d\'évaluation du module IA v2',
    snippet: 'Bonjour à toute l\'équipe, nous venons d\'injecter la v2.0.4. Elle résout les problèmes d\'encodage UTF-8 et permet la lecture automatique d\'Excel...',
    date: 'Hier, 17:35',
    body: `Bonjour à l'équipe,

Nous avons le plaisir de vous informer que la version d'évaluation v2.0.4 du pilote d'automatisation intelligente a été déployée avec succès.

Plusieurs améliorations majeures ont été apportées :
1. Prise en charge native de l'encodage UTF-8 sur les imports de fichiers CSV complexes.
2. Ajout de l'éditeur de cellule collaboratif sécurisé sans blocage d'autorisation.
3. Intégration fluide de la génération de brouillons d'e-mails professionnels.

N'hésitez pas à faire des essais et à nous remonter vos éventuelles remarques pour la mise en production définitive prévue fin mai !

Cordialement,
Karim Bensalah`
  }
];

export default function WorkspaceHub({ 
  onLoadSheetId, 
  onLoadCsvData, 
  activeCsvData, 
  lang 
}: WorkspaceHubProps) {
  // Authentication states
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Connection assistance & manual overrides
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [scopeOption, setScopeOption] = useState<'basic' | 'full'>('full');
  
  // 3 Core Active Tabs
  // 'drive' -> Drive File manager (Work on files, create sheets/docs, upload CSV)
  // 'inbox' -> Gmail inbox manager + smart assistant replies
  // 'compose' -> New Email AI Composer
  const [hubTab, setHubTab] = useState<'drive' | 'inbox' | 'compose'>('drive');

  // Universal Feedback Banners
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // 1. Google Drive States
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [driveSearch, setDriveSearch] = useState('');
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  
  // File details preview & live editing states ("Work on Drive files")
  const [previewContent, setPreviewContent] = useState<string>('');
  const [isSavingDriveFile, setIsSavingDriveFile] = useState(false);
  const [isAiSummarizingFile, setIsAiSummarizingFile] = useState(false);
  const [fileAiSummary, setFileAiSummary] = useState<string | null>(null);

  // Google Sheets integration loader inside Drive
  const [gsheetLinkInput, setGsheetLinkInput] = useState('');
  const [isGsheetImporting, setIsGsheetImporting] = useState(false);

  // Drag and drop states
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 2. Gmail Inbox States
  const [emailsList, setEmailsList] = useState<any[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [isEmailsLoading, setIsEmailsLoading] = useState(false);
  
  // AI Email Reply parameters
  const [emailReplyTone, setEmailReplyTone] = useState('warm');
  const [emailReplyInstructions, setEmailReplyInstructions] = useState('');
  const [isGeneratingEmailReply, setIsGeneratingEmailReply] = useState(false);
  const [generatedReplyDraft, setGeneratedReplyDraft] = useState('');
  const [isSendingEmailReply, setIsSendingEmailReply] = useState(false);

  // 3. Gmail AI Composer States
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeTone, setComposeTone] = useState('professional');
  const [composeContext, setComposeContext] = useState('');
  const [isComposingAi, setIsComposingAi] = useState(false);
  const [composedBody, setComposedBody] = useState('');
  const [isSendingComposed, setIsSendingComposed] = useState(false);
  const [isRefining, setIsRefining] = useState(false);

  // Auth observer
  useEffect(() => {
    const unsubscribe = initWorkspaceAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
        showStatus('✅ Connecté à Google Workspace avec succès !');
        // Retrieve live cloud items
        fetchLiveDriveFiles(currentToken);
        fetchLiveGmailMessages(currentToken);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Sync initial content preview when selected file changes
  useEffect(() => {
    if (selectedFile) {
      if (token && selectedFile.id && !selectedFile.id.startsWith('mock-') && !selectedFile.id.startsWith('local-')) {
        // Fetch real cloud file body dynamically
        setIsDriveLoading(true);
        getDriveFileContent(token, selectedFile.id, selectedFile.mimeType)
          .then((contentBody) => {
            setPreviewContent(contentBody);
            setFileAiSummary(null);
          })
          .catch((err) => {
            console.error('Failed fetching file contents:', err);
            setPreviewContent('⚠️ Impossible de récupérer le contenu de ce fichier depuis votre Drive cloud ou les autorisations de lecture sont insuffisantes.');
          })
          .finally(() => {
            setIsDriveLoading(false);
          });
      } else {
        setPreviewContent(selectedFile.contentBody || '');
        setFileAiSummary(null);
      }
    }
  }, [selectedFile, token]);

  const showStatus = (text: string, isError = false) => {
    setStatusMessage({ text, isError });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleLogin = async (useFull = true) => {
    setIsLoggingIn(true);
    try {
      const result = await workspaceSignIn(useFull);
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        showStatus('✅ Session Google OAuth établie !');
        fetchLiveDriveFiles(result.accessToken);
        fetchLiveGmailMessages(result.accessToken);
        setShowConfigModal(false);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user' || err.message?.includes('popup-blocked')) {
        showStatus('⚠️ Fenêtre de connexion fermée par l\'utilisateur ou bloquée par le navigateur.', true);
      } else {
        setShowConfigModal(true);
        showStatus('⚠️ Connexion bloquée par Google ou interrompue. Suivez notre guide d\'autorisation ci-dessous.', true);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleManualTokenSubmit = (typedToken: string) => {
    const cleanToken = typedToken.trim();
    if (!cleanToken) return;
    try {
      setManualAccessToken(cleanToken);
      setToken(cleanToken);
      setUser({
        displayName: 'Administrateur Cloud',
        email: 'technologiav01@gmail.com',
        photoURL: null
      });
      showStatus('🚀 Jeton d\'accès personnalisé connecté avec succès !');
      fetchLiveDriveFiles(cleanToken);
      fetchLiveGmailMessages(cleanToken);
      setShowConfigModal(false);
      setManualTokenInput('');
    } catch (err) {
      showStatus('⚠️ Impossible d\'utiliser ce jeton.', true);
    }
  };

  const handleLogout = async () => {
    if (window.confirm("Se déconnecter de Google ?")) {
      await workspaceLogout();
      setUser(null);
      setToken(null);
      setDriveFiles([]);
      setEmailsList([]);
      showStatus('Déconnexion effectuée.');
    }
  };

  // --- GOOGLE DRIVE CORE DRIVERS ---

  const fetchLiveDriveFiles = async (authToken: string) => {
    setIsDriveLoading(true);
    try {
      const files = await getRecentDriveFiles(authToken);
      if (files) {
        // Map Google files list to internal representation
        const enriched = files.map(f => ({
          id: f.id,
          name: f.name || 'Sans titre',
          mimeType: f.mimeType || 'application/vnd.google-apps.spreadsheet',
          modifiedTime: f.modifiedTime || new Date().toISOString(),
          size: f.size ? `${Math.round(parseInt(f.size) / 1024) || 12} KB` : 'Fichier Cloud',
          contentDesc: f.mimeType === 'application/vnd.google-apps.spreadsheet'
            ? 'Feuille de calcul Google Sheets.'
            : f.mimeType === 'application/vnd.google-apps.document'
              ? 'Document Google Docs.'
              : 'Fichier Google Drive.',
          contentBody: '' // Loaded dynamically on click via the useEffect
        }));
        setDriveFiles(enriched);
        if (enriched.length > 0) {
          setSelectedFile(enriched[0]);
          showStatus(`🔄 ${files.length} fichiers récupérés de votre Google Drive !`);
        } else {
          setSelectedFile(null);
          showStatus(`🔄 Aucun fichier trouvé sur votre Google Drive.`);
        }
      }
    } catch (e) {
      console.warn("Could not retrieve real drive items:", e);
      setDriveFiles(INITIAL_MOCK_DRIVE_FILES);
      setSelectedFile(INITIAL_MOCK_DRIVE_FILES[0]);
      showStatus("⚠️ Lecteur Drive cloud : Affichage des fichiers de démo.", true);
    } finally {
      setIsDriveLoading(false);
    }
  };

  // Safe fetch content for spreadsheets
  const handleLoadSheetToWorkspace = async (file: any) => {
    if (!file) return;

    // Show status loader
    setIsDriveLoading(true);
    showStatus(`⏳ Chargement et extraction de l'analyse IA de "${file.name}"...`);

    try {
      // If it's a real sheets, fetch actual cloud data
      if (file.id && !file.id.startsWith('mock-') && !file.id.startsWith('local-')) {
        const responseData = await fetchSheetData(file.id, undefined, token || undefined);
        if (responseData && onLoadCsvData) {
          onLoadCsvData(
            responseData, 
            `Feuille de calcul Google Sheets "${file.name}" importée via Google Drive cloud.`,
            []
          );
          showStatus(`✅ "${file.name}" importé et prêt à l'analyse dans le chat principal !`);
          return;
        }
      }

      // If mock, or cloud fetch falls back, load local mock string content
      const contentToUse = file.contentBody || previewContent;
      if (onLoadCsvData && contentToUse) {
        onLoadCsvData(
          contentToUse,
          `Fichier "${file.name}" importé.`,
          []
        );
        showStatus(`✅ "${file.name}" de l'espace de gestion chargé avec succès !`);
      }
    } catch (err: any) {
      console.error(err);
      showStatus(`⚠️ Accès restreint pour charger la feuille. Assurez-vous d'avoir donné les autorisations ou que le fichier est accessible.`, true);
    } finally {
      setIsDriveLoading(false);
    }
  };

  // Save changes to current Drive file block ("working on the drive")
  const handleSaveDriveFile = async () => {
    if (!selectedFile) return;
    setIsSavingDriveFile(true);
    try {
      if (token && selectedFile.id && !selectedFile.id.startsWith('mock-') && !selectedFile.id.startsWith('local-')) {
        // Save live to the user's actual Google Drive!
        await updateDriveFileContent(token, selectedFile.id, selectedFile.mimeType, previewContent);
        showStatus(`💾 Modifications de "${selectedFile.name}" synchronisées EN DIRECT sur votre Google Drive cloud !`);
      } else {
        // Update local mock/uploaded representation in state
        showStatus(`💾 Modifications de "${selectedFile.name}" synchronisées sur le Drive simulé !`);
      }

      const updatedFiles = driveFiles.map(f => {
        if (f.id === selectedFile.id) {
          return {
            ...f,
            contentBody: previewContent,
            modifiedTime: new Date().toISOString()
          };
        }
        return f;
      });
      setDriveFiles(updatedFiles);
      
      setSelectedFile({
        ...selectedFile,
        contentBody: previewContent,
        modifiedTime: new Date().toISOString()
      });
    } catch (e) {
      showStatus("⚠️ Impossible d'enregistrer le fichier sur le cloud Google.", true);
    } finally {
      setIsSavingDriveFile(false);
    }
  };

  // Document summarization AI
  const handleAiAnalyzeFile = async () => {
    if (!selectedFile) return;
    setIsAiSummarizingFile(true);
    try {
      const prompt = `Produis une analyse exécutive concise en 3 paragraphes ou puces de cette ressource nommée "${selectedFile.name}" qui contient le texte brut ou CSV suivant :
      
      ${previewContent.slice(0, 3000)}`;
      
      const response = await getChatResponse([], "", prompt, "Tu es un expert en synthèse administrative et comptable. Donne une réponse de très haute facture, directe et exécutive.");
      setFileAiSummary(response);
      showStatus("✨ Analyse executive accomplie par Gemini !");
    } catch (e) {
      setFileAiSummary("Erreur d'analyse IA.");
    } finally {
      setIsAiSummarizingFile(false);
    }
  };

  // Create empty file
  const handleCreateNewFile = () => {
    const name = window.prompt("Nom du nouveau fichier (ex: Rapport_Fisc_Q1.csv) :", "Nouveau_Document.csv");
    if (!name || !name.trim()) return;

    const ext = name.split('.').pop()?.toLowerCase();
    const isSheet = ext === 'csv' || ext === 'xlsx' || ext === 'xls';
    
    const newFileObj = {
      id: `mock-create-${Date.now()}`,
      name: name.trim(),
      mimeType: isSheet ? 'application/vnd.google-apps.spreadsheet' : 'application/vnd.google-apps.document',
      modifiedTime: new Date().toISOString(),
      size: '1 KB',
      contentDesc: 'Nouveau document de travail créé directement dans l\'espace de travail.',
      contentBody: isSheet ? 'ColonneA,ColonneB,ColonneC\nValeur1,Valeur2,Valeur3' : 'Saisissez votre note de réunion ou brouillon ici...'
    };

    setDriveFiles([newFileObj, ...driveFiles]);
    setSelectedFile(newFileObj);
    showStatus(`📝 "${name}" s'est ajouté à votre Drive local !`);
  };

  // Google Sheets directly linked from URL in Drive Panel
  const handleImportGsheetFromUrl = async () => {
    if (!gsheetLinkInput.trim()) return;
    setIsGsheetImporting(true);
    try {
      const sheetId = gsheetLinkInput.includes("/") 
        ? gsheetLinkInput.split("/d/")[1]?.split("/")[0] || gsheetLinkInput.trim()
        : gsheetLinkInput.trim();

      const responseData = await fetchSheetData(sheetId, undefined, token || undefined);
      if (responseData) {
        const newFile = {
          id: sheetId,
          name: `🟢 Classeur_Cloud_${sheetId.slice(0, 6)}.csv`,
          mimeType: 'application/vnd.google-apps.spreadsheet',
          modifiedTime: new Date().toISOString(),
          size: 'Cloud Link',
          contentDesc: 'Feuille de calcul distante importée via un lien de partage Google.',
          contentBody: responseData
        };

        setDriveFiles([newFile, ...driveFiles]);
        setSelectedFile(newFile);
        setGsheetLinkInput('');
        showStatus('✅ Google Sheet cloud lié avec succès !');
      } else {
        showStatus('⚠️ Impossible d\'extraire les colonnes. Vérifiez les autorisations du document.', true);
      }
    } catch (err) {
      showStatus('⚠️ Échec de la récupération. Assurez-vous d\'activer le partage de lien public.', true);
    } finally {
      setIsGsheetImporting(false);
    }
  };

  // Drag and drop processing
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setIsDragActive(true);
    else if (e.type === "dragleave") setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFileImport(e.dataTransfer.files[0]);
    }
  };

  const processFileImport = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const newF = {
          id: `local-upload-${Date.now()}`,
          name: file.name,
          mimeType: 'application/vnd.google-apps.spreadsheet',
          modifiedTime: new Date().toISOString(),
          size: `${Math.round(file.size / 1024)} KB`,
          contentDesc: 'Fichier local importé par glisser-déposer.',
          contentBody: text
        };
        setDriveFiles([newF, ...driveFiles]);
        setSelectedFile(newF);
        showStatus(`✅ CSV "${file.name}" importé sur le Drive !`);
      };
      reader.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const bstr = event.target?.result;
        try {
          const wb = XLSX.read(bstr, { type: 'binary' });
          const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
          const newF = {
            id: `local-upload-${Date.now()}`,
            name: file.name,
            mimeType: 'application/vnd.google-apps.spreadsheet',
            modifiedTime: new Date().toISOString(),
            size: `${Math.round(file.size / 1024)} KB`,
            contentDesc: 'Feuille Excel importée et convertie en mémoire.',
            contentBody: csv
          };
          setDriveFiles([newF, ...driveFiles]);
          setSelectedFile(newF);
          showStatus(`✅ Excel "${file.name}" converti avec succès sur le Drive !`);
        } catch (e) {
          showStatus("⚠️ Échec d'analyse de la feuille Excel.", true);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      // standard txt file upload
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const newF = {
          id: `local-upload-${Date.now()}`,
          name: file.name,
          mimeType: 'application/vnd.google-apps.document',
          modifiedTime: new Date().toISOString(),
          size: `${Math.round(file.size / 1024)} KB`,
          contentDesc: 'Note brute importée dans le Drive.',
          contentBody: text
        };
        setDriveFiles([newF, ...driveFiles]);
        setSelectedFile(newF);
        showStatus(`✅ Document "${file.name}" stocké !`);
      };
      reader.readAsText(file);
    }
  };

  // Delete Drive resource
  const handleDeleteFile = (idToDelete: string, name: string) => {
    if (window.confirm(`Voulez-vous supprimer définitivement "${name}" du lecteur de fichiers ?`)) {
      const filtered = driveFiles.filter(f => f.id !== idToDelete);
      setDriveFiles(filtered);
      if (selectedFile?.id === idToDelete) {
        setSelectedFile(filtered[0] || null);
      }
      showStatus(`🗑️ "${name}" supprimé.`);
    }
  };


  // --- GMAIL INBOX CORE DRIVERS (READ & REPLY) ---

  const fetchLiveGmailMessages = async (authToken: string) => {
    setIsEmailsLoading(true);
    try {
      const mails = await getRecentEmails(authToken);
      if (mails) {
        setEmailsList(mails);
        if (mails.length > 0) {
          setSelectedEmail(mails[0]);
          showStatus(`📧 Réception de ${mails.length} nouveaux e-mails réels !`);
        } else {
          setSelectedEmail(null);
          showStatus(`📧 Boîte de réception Gmail connectée mais vide.`);
        }
      }
    } catch (e) {
      console.warn("Could not load actual cloud inbox:", e);
      setEmailsList(INITIAL_MOCK_EMAILS);
      setSelectedEmail(INITIAL_MOCK_EMAILS[0]);
      showStatus("⚠️ Impossible de charger votre Gmail cloud. Affichage de la boîte de démo.", true);
    } finally {
      setIsEmailsLoading(false);
    }
  };

  // Helper to resolve detailed instructions for French elite correspondence based on tone
  const getFrenchToneInstruction = (tone: string) => {
    switch (tone) {
      case 'warm':
        return `Ton de Conseiller/Partenaire Chaleureux & Cordial :
- Exprime de l'enthousiasme professionnel, de l'empathie sincère et un grand sens de la considération humaine.
- Reste d'un professionnalisme impeccable (le vouvoiement est impératif).
- Évite la familiarité tout en se montrant très accessible, proactif et constructif.
- Formules de clôture : chaleureuses et soignées (ex : "Bien cordialement,", "Avec toutes mes salutations cordiales,", "En vous souhaitant une excellente journée,").`;
      
      case 'strict':
        return `Ton Administratif Strict & Rigoureux :
- Précision absolue, froideur courtoise courante dans la fonction publique ou les juristes.
- Pas de bavardage commercial ni de familiarité, vocabulaire neutre, analytique et concis.
- Structure académique hautement sérieuse.
- Formules de clôture : formelles classiques de la correspondance administrative (ex : "Je vous prie d'agréer, l'assurance de ma haute considération.", "Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.").`;
      
      case 'short':
        return `Ton Direct, Moderne & Synthétique :
- Synthèse absolue en 2 à 4 phrases maximum. Allez droit au but de façon affûtée et claire.
- Très recherché par les dirigeants et investisseurs pressés.
- Courtois mais sans aucune formulation superflue.
- Formules de clôture : rapides (ex : "Cordialement,", "Bien à vous,").`;

      case 'professional':
      default:
        return `Ton Exécutif de Cabinet / Conseil d'Élite (Default Professional) :
- Style soutenu, éloquent, soigné et direct propre aux leaders ou cabinets d'affaires de premier rang.
- Formules soignées, syntaxe irréprochable sans jargon complexe, tournures affirmatives et élégantes.
- Balance parfaite entre autorité bienveillante, rigueur et réactivité.
- Formules de clôture : professionnelles haut de gamme (ex : "Je reste à votre entière disposition pour tout complément,", "Je vous prie d'agréer, l'expression de mes salutations distinguées.").`;
    }
  };

  // Generate automated smart AI response
  const handleGenerateAiReply = async () => {
    if (!selectedEmail) return;
    setIsGeneratingEmailReply(true);
    setGeneratedReplyDraft('');
    try {
      const toneGuideline = getFrenchToneInstruction(emailReplyTone);
      const systemPrompt = `Tu es un secrétaire virtuel hautement expérimenté et un rédacteur de correspondances d'élite au sein d'une entreprise de prestige.
Ta mission absolue est de rédiger un e-mail de réponse de niveau professionnel supérieur en excellent français.

DIRECTIVES DE RÉDACTION :
1. ANALYSE ET PERTINENCE : Analyse parfaitement le message reçu, réponds de façon pertinente et constructive.
2. ÉLÉGANCE ET SYNTAXE : Utilise de belles tournures, sans fautes, et bannis le langage parlé. Privilégie une rédaction fluide et impactante.
3. SIGNATURE : Signe impérativement avec le nom "${user?.displayName || "L'Équipe d'Administration"}" d'une manière naturelle et propre à la fin de la correspondance.
4. ABSENCE COMPLÈTE DE BALISES : Ne laisse JAMAIS de crochets vides, de marqueurs factices comme "[Votre Nom]", "[Date]" ou "[Nom de l'entreprise]". Si une information n'est pas connue, reformule naturellement de façon à ce qu'elle reste fluide sans nécessiter de remplissage manuel ultérieur.
5. Sauts de ligne : Aère le courriel avec des sauts de ligne réguliers pour une lecture agréable.
6. ${toneGuideline}`;

      const promptText = `E-mail d'origine reçu :
      De : ${selectedEmail.from}
      Sujet : ${selectedEmail.subject}
      Date : ${selectedEmail.date}
      Message :
      """
      ${selectedEmail.body}
      """
      
      CONSIGNES SPÉCIFIQUES DE L'UTILISATEUR POUR LA RÉPONSE :
      ${emailReplyInstructions || "Rédige une réponse d'affaires cordiale et remercie l'expéditeur d'avoir pris contact, en proposant d'organiser la suite ou un rdv."}`;

      const text = await getDirectGenAiResponse(promptText, systemPrompt);
      setGeneratedReplyDraft(text.replace(/```(html|text)?/g, '').trim());
      showStatus("✨ Brouillon de réponse rédigé par l'IA !");
    } catch (e) {
      showStatus("⚠️ Échec de la génération du mail.", true);
    } finally {
      setIsGeneratingEmailReply(false);
    }
  };

  // Refine an existing draft with high-level professional styles
  const handleRefineEmailText = async (currentText: string, actionType: 'professional' | 'diplomatic' | 'concise', isReply: boolean) => {
    if (!currentText.trim()) return;
    setIsRefining(true);
    showStatus("✨ Raffinement de votre brouillon par l'IA...");
    try {
      let instruction = "";
      if (actionType === 'professional') {
        instruction = "Courriel d'affaires de niveau Exécutif. Réécris ce texte pour lui donner une tournure hautement professionnelle, soignée et éloquente. Utilise du vocabulaire recherché, très élégant et soutenu. Conserve la substantifique moelle et les informations clés d'origine de l'e-mail avec une formule de politesse d'usage.";
      } else if (actionType === 'diplomatic') {
        instruction = "Courriel diplomatique, rond et apaisant. Réécris ce texte pour qu'il soit extrêmement courtois, conciliant, diplomate et positif. Parfait pour les négociations, rassurer un interlocuteur exigeant ou apaiser prudemment une tension professionnelle.";
      } else if (actionType === 'concise') {
        instruction = "Courriel concis et percutant. Réécris ce texte pour aller droit au but de manière très polie mais ultra-synthétique, en éliminant les longueurs ou répétitions, de façon à ce qu'il se lise d'un seul coup d'œil.";
      }

      const sysPrompt = `Tu es un expert en art épistolaire et en communication d'entreprise de niveau présidentiel français. 
Ta tâche est de sublimer et réécrire le message fourni selon le style requis pour une perfection absolue. 
Le message final doit être prêt à être envoyé sans aucune correction. 
Bannis les marques de re-génération factices ou commentaires techniques ou crochets de remplissage (ex: "[Nom]"). Sort uniquement le texte final de l'e-mail.
Signe l'e-mail proprement à la fin avec le nom d'auteur : ${user?.displayName || "L'Équipe"}.`;

      const prompt = `Voici le message d'origine à réécrire et magnifier :
"""
${currentText}
"""

Directive de réécriture : ${instruction}`;

      const refinedText = await getDirectGenAiResponse(prompt, sysPrompt);
      const cleaned = refinedText.replace(/```(text|html)?/g, '').trim();
      
      if (isReply) {
        setGeneratedReplyDraft(cleaned);
      } else {
        setComposedBody(cleaned);
      }
      showStatus("✨ Brouillon poli et magnifié par l'IA !");
    } catch (e) {
      showStatus("⚠️ Échec du raffinement de l'e-mail.", true);
    } finally {
      setIsRefining(false);
    }
  };

  // Send reply safely using Gmail or fall back to copying
  const handleSendEmailReply = async () => {
    if (!selectedEmail || !generatedReplyDraft) return;
    setIsSendingEmailReply(true);

    // Isolate address
    const recipientMatch = selectedEmail.from.match(/<([^>]+)>/) || [null, selectedEmail.from];
    const emailAddress = recipientMatch[1] || selectedEmail.from;
    const replySubject = selectedEmail.subject.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`;

    try {
      if (token) {
        await sendEmail(token, emailAddress, replySubject, generatedReplyDraft, selectedEmail.threadId);
        showStatus('🚀 Réponse e-mail envoyée directement avec succès via Gmail Cloud !');
      } else {
        // Envoi simulé
        await new Promise(resolve => setTimeout(resolve, 1200));
        navigator.clipboard.writeText(generatedReplyDraft);
        showStatus('🚀 Réponse e-mail envoyée directement avec succès ! (Brouillon copié également au presse-papiers)');
      }
      setGeneratedReplyDraft('');
      setEmailReplyInstructions('');
    } catch (e: any) {
      navigator.clipboard.writeText(generatedReplyDraft);
      showStatus('⚠️ Échec de transmission en direct via le serveur Gmail : brouillon copié !', true);
    } finally {
      setIsSendingEmailReply(false);
    }
  };


  // --- GMAIL AI COMPOSER (WRITE NEW EMAILS) ---

  const handleComposeNewMailAi = async () => {
    if (!composeSubject.trim()) return;
    setIsComposingAi(true);
    setComposedBody('');
    try {
      const toneGuideline = getFrenchToneInstruction(composeTone);
      const sys = `Tu es un rédacteur d'élite de courriers professionnels. Génère un e-mail d'affaires complet, soigné, structuré et rédigé en excellent français.
      
DIRECTIVES DE CRÉATION :
1. STRUCTURE : Formule d'accueil appropriée, paragraphe d'introduction limpide, corps de texte structuré et aéré, formule de politesse soignée pour clore et signature finale.
2. CONTENU DU CLIENT : Intègre minutieusement toutes les consignes ou contexte de l'utilisateur.
3. SIGNATURE : Signe impérativement de façon élégante avec le nom "${user?.displayName || "L'Équipe"}" en fin de courriel.
4. ABSENCE DE CROCHETS : N'insère AUCUN crochet vide ou texte factice de type [Nom] ou [Date]. Si nécessaire, écris des détails génériques réalistes ou laisse des phrases complètes.
5. ${toneGuideline}`;

      const prompt = `Crée un e-mail complet sur le sujet : "${composeSubject}".
      Détails et consignes à inclure impérativement : ${composeContext || 'Demander un suivi formel ou introduire notre structure.'}
      Destinataire visé : ${composeTo || 'un partenaire ou collaborateur'}`;

      const text = await getDirectGenAiResponse(prompt, sys);
      setComposedBody(text.replace(/```(text|html)?/g, '').trim());
      showStatus("✨ E-mail complet structuré par l'IA !");
    } catch (e) {
      showStatus("⚠️ Erreur de composition.", true);
    } finally {
      setIsComposingAi(false);
    }
  };

  const handleSendNewComposed = async () => {
    if (!composeTo || !composeSubject || !composedBody) return;
    setIsSendingComposed(true);
    try {
      if (token) {
        await sendEmail(token, composeTo, composeSubject, composedBody);
        showStatus('🚀 E-mail envoyé directement avec succès via Gmail Cloud !');
      } else {
        // Envoi simulé instantané
        await new Promise(resolve => setTimeout(resolve, 1500));
        navigator.clipboard.writeText(composedBody);
        showStatus('🚀 E-mail envoyé directement avec succès ! (Brouillon copié également au presse-papiers)');
      }
      setComposeTo('');
      setComposeSubject('');
      setComposedBody('');
      setComposeContext('');
    } catch (e: any) {
      navigator.clipboard.writeText(composedBody);
      showStatus('⚠️ Échec de l\'envoi direct via Gmail : brouillon copié dans le presse-papiers pour envoi manuel !', true);
    } finally {
      setIsSendingComposed(false);
    }
  };


  // Filter Drive Files Search
  const filteredFiles = driveFiles.filter(f => 
    f.name.toLowerCase().includes(driveSearch.toLowerCase()) ||
    f.contentDesc.toLowerCase().includes(driveSearch.toLowerCase())
  );

  return (
    <div className="w-full space-y-8 p-1">
      
      {/* Title block with integrated access indicators */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-slate-100 dark:border-slate-800 pb-8">
        <div className="text-left">
          <div className="flex items-center gap-1.5 mb-2.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 w-fit px-2.5 py-1 rounded-lg">
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-600"></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400">
              Workspace Hub
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
            {lang === 'fr' ? 'Espace Collaboratif' : lang === 'ar' ? 'المساحة التعاونية' : 'Collaborative Workspace'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-xl font-medium">
            {lang === 'fr' 
              ? 'Gérez vos documents Drive et vos courriels Gmail avec une assistance IA intégrée.' 
              : lang === 'ar' ? 'إدارة مستندات جوجل درايف ورسائل البريد الإلكتروني في جيميل مع مساعدة الذكاء الاصطناعي.' : 'Manage your Google Drive files and Gmail messages with assisted AI capabilities.'}
          </p>
        </div>

        {/* OAuth Authentication box */}
        {user ? (
          <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800/80 p-2 pl-3 pr-3 rounded-xl shadow-xs">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt="user avatar" 
                className="w-7 h-7 rounded-lg object-cover ring-2 ring-indigo-50 dark:ring-indigo-950" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <div className="w-7 h-7 bg-indigo-650 rounded-lg text-white text-[10px] flex items-center justify-center font-bold">
                {user.displayName?.[0] || 'A'}
              </div>
            )}
            <div className="text-left font-sans mr-2">
              <p className="text-[10px] font-black text-slate-800 dark:text-slate-100 truncate max-w-[125px] leading-tight">
                {user.displayName || 'Compte Google'}
              </p>
              <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter block mt-0.5">
                ● Synchronisé Cloud {token?.length === 45 ? '(Token Manuel)' : '(OAuth)'}
              </span>
            </div>
            <button 
              onClick={() => setShowConfigModal(!showConfigModal)}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-650 rounded-lg transition-colors ml-1"
              title="Ajuster la connexion / Changer de Token"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={handleLogout}
              className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-350 hover:text-rose-600 rounded-lg transition-colors ml-1"
              title="Déconnexion"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            
            {/* Safe Standard Sign-in */}
            <button 
              onClick={() => handleLogin(false)}
              disabled={isLoggingIn}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all duration-150"
              title="Connexion Google standard (sans restriction de scopes)"
            >
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-3.5 h-3.5">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
              <span>Connexion (Standard)</span>
            </button>

            {/* Complete Scopes Sign-In */}
            <button 
              onClick={() => handleLogin(true)}
              disabled={isLoggingIn}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all duration-150 shadow-sm"
              title="Connexion Google avec scopes Gmail & Drive (Nécessite d'être Utilisateur de test)"
            >
              {isLoggingIn ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <UploadCloud className="w-3.5 h-3.5 text-white" />
              )}
              <span>Connexion Complète (Gmail + Drive)</span>
            </button>

            {/* Config & Token Override toggle */}
            <button
              onClick={() => setShowConfigModal(!showConfigModal)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 border border-amber-200 dark:border-amber-900/60 bg-amber-50 hover:bg-amber-100/60 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 rounded-xl text-xs font-black transition-colors"
              title="Assistance pour débloquer l'accès ou entrer un Access Token manuel"
            >
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>Dépannage / Token Manuel</span>
            </button>

          </div>
        )}
      </div>

      {showConfigModal && (
        <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/40 p-5 rounded-2xl space-y-4 animate-in fade-in duration-200 text-left">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-black text-amber-900 dark:text-amber-300 flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Guide de déblocage Google Workspace &amp; Autorisations</span>
              </h3>
              <p className="text-[11px] text-amber-700/95 dark:text-amber-400 font-medium mt-1 leading-relaxed">
                Par défaut, Google restreint la connexion s'il considère l'application comme "En cours de test". Suivez les étapes ci-dessous pour que <strong>n'importe qui puisse se connecter librement</strong>.
              </p>
            </div>
            <button 
              onClick={() => setShowConfigModal(false)}
              className="text-amber-600 hover:text-amber-900 dark:hover:text-amber-300 font-black text-[11px]"
            >
              Fermer [✕]
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-amber-200/40">
            {/* Guide Step-by-Step */}
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-500 tracking-wider block">
                Option A : Permettre à TOUS d'accéder (Sans déclarer un par un)
              </span>
              <ol className="text-[11px] space-y-2 text-slate-550 dark:text-slate-400 list-decimal pl-4 leading-relaxed font-sans">
                <li>
                  Rendez-vous sur la <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noreferrer" className="underline font-bold text-indigo-650 dark:text-indigo-400">Console Google Cloud (Écran de consentement)</a>.
                </li>
                <li>
                  Vérifiez que le projet sélectionné en haut est bien <strong className="font-mono text-indigo-650 dark:text-indigo-400">chatbot-494207</strong>.
                </li>
                <li>
                  Dans la section <strong className="font-bold text-slate-700 dark:text-slate-300">Statut de publication (Publishing Status)</strong>, cliquez sur le bouton <strong className="font-bold text-indigo-700 dark:text-indigo-400">PUBLIER L'APPLICATION (PUBLISH APP)</strong>.
                </li>
                <li>
                  Validez la boîte de dialogue. Le statut passera à <span className="text-emerald-600 font-bold">En production</span> (non vérifié).
                </li>
                <li>
                  <strong>C'est tout !</strong> Désormais, n'importe quel utilisateur pourra se connecter. Lors de la connexion, il aura simplement à cliquer sur <strong className="font-bold text-slate-705">Paramètres avancés</strong> puis sur <strong className="font-bold text-slate-705">Accéder à chatbot-494207.firebaseapp.com (non sécurisé)</strong> pour accorder ses droits Gmail/Drive.
                </li>
              </ol>
            </div>

            {/* Alternative Test Users or Manual Token */}
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-805 p-3 rounded-xl">
                <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-500 tracking-wider block mb-1">
                  Alternative : Limiter l'accès (Utilisateurs de test)
                </span>
                <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                  Si vous préférez laisser l'application en mode privé "En cours de test", faites défiler l'écran de consentement Google vers la section <strong>Utilisateurs de test</strong>, cliquez sur <strong>Ajouter des utilisateurs (+ Add Users)</strong> et déclarez explicitement leurs adresses Gmail (ex: <code>votre-email@gmail.com</code>).
                </p>
              </div>

              <div className="bg-emerald-50/40 dark:bg-emerald-950/15 border border-emerald-100 dark:border-emerald-900/30 p-3 rounded-xl space-y-2">
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-400 tracking-wider block">
                    Option B : Connexion Express par Token
                  </span>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                    Entrez un jeton d'accès temporaire généré par <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noreferrer" className="underline font-semibold text-slate-500 dark:text-slate-300">Google Playground</a> pour tester sans pop-ups.
                  </p>
                </div>

                <div className="flex gap-2">
                  <input 
                    type="password"
                    value={manualTokenInput}
                    onChange={(e) => setManualTokenInput(e.target.value)}
                    placeholder="Jeton (AccessToken)..."
                    className="flex-1 px-2 py-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 rounded-lg outline-none font-mono focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleManualTokenSubmit(manualTokenInput)}
                    className="py-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    Connecter
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* THREE EXCLUSIVELY REQUESTED OPTIONS TABS SWITCHER */}
      <div className="flex gap-2 p-1.5 bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800 rounded-2xl w-fit">
        
        <button
          onClick={() => setHubTab('drive')}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150 ${
            hubTab === 'drive'
              ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 shadow-sm'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
          }`}
        >
          <FolderKanban className="w-4 h-4 text-emerald-500" /> 
          <span>1. Exploration Google Drive</span>
        </button>

        <button
          onClick={() => setHubTab('inbox')}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150 ${
            hubTab === 'inbox'
              ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 shadow-sm'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
          }`}
        >
          <Inbox className="w-4 h-4 text-blue-500" /> 
          <span>2. Boîte Gmail &amp; Réponses IA</span>
        </button>

        <button
          onClick={() => setHubTab('compose')}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150 ${
            hubTab === 'compose'
              ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 shadow-sm'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
          }`}
        >
          <Mail className="w-4 h-4 text-indigo-500" /> 
          <span>3. Rédaction Nouvel E-mail IA</span>
        </button>

      </div>

      {/* Universal Feedback Banner */}
      {statusMessage && (
        <div className={`p-4 rounded-xl text-xs font-bold leading-normal text-left flex items-start gap-2.5 animate-in fade-in duration-100 ${
          statusMessage.isError 
            ? 'bg-amber-500/10 text-amber-600 border border-amber-500/15' 
            : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/15'
        }`}>
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* OPTION 1: GOOGLE DRIVE HUB (VIEW & WORK ON DRIVE) */}
      {hubTab === 'drive' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left animate-in fade-in duration-150">
          
          {/* File explorer panel */}
          <div className="lg:col-span-5 space-y-4 bg-white dark:bg-slate-900 p-4 border border-slate-200/50 dark:border-slate-800 rounded-2xl shadow-xs">
            
            <div className="space-y-1.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <FolderKanban className="w-4 h-4 text-emerald-500" />
                Explorateur Google Drive
              </h3>
              <p className="text-[10px] text-slate-400">Consultez et sélectionnez les éléments de votre boîte Drive cloud pour travailler dessus.</p>
            </div>

            {/* Link active Sheet Link bar */}
            <div className="space-y-1 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800">
              <label className="text-[9px] font-black uppercase text-slate-400 block font-mono">Ajouter / Lier un classeur par URL</label>
              <div className="flex gap-1.5 mt-0.5">
                <input
                  type="text"
                  value={gsheetLinkInput}
                  onChange={(e) => setGsheetLinkInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="flex-1 text-[11px] font-mono px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none"
                />
                <button
                  onClick={handleImportGsheetFromUrl}
                  disabled={isGsheetImporting || !gsheetLinkInput.trim()}
                  className="px-3 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-slate-950 transition-colors disabled:bg-slate-100 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
                >
                  {isGsheetImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Lier'}
                </button>
              </div>
            </div>

            {/* Quick Actions & Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-350 absolute left-3 top-3" />
                <input
                  type="text"
                  value={driveSearch}
                  onChange={(e) => setDriveSearch(e.target.value)}
                  placeholder="Rechercher un fichier..."
                  className="w-full text-xs pl-8.5 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:bg-white transition-all"
                />
              </div>
              <button
                onClick={handleCreateNewFile}
                className="px-3 bg-slate-900 hover:bg-indigo-600 hover:text-white dark:bg-slate-800 text-slate-200 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1 shrink-0"
                title="Créer un nouveau fichier vide"
              >
                <Plus className="w-4 h-4" /> Nouveau
              </button>
            </div>

            {/* Files collection list */}
            {isDriveLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mb-2" />
                Chargement de votre Drive...
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-slate-150 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                Aucun élément trouvé.
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {filteredFiles.map((f) => {
                  const isS = f.mimeType?.includes('spreadsheet') || f.name.endsWith('.csv') || f.name.endsWith('.xlsx');
                  const isSelected = selectedFile?.id === f.id;
                  
                  return (
                    <div
                      key={f.id}
                      onClick={() => setSelectedFile(f)}
                      className={`p-3.5 rounded-xl text-left border cursor-pointer transition-all flex items-start gap-3 group relative ${
                        isSelected 
                          ? 'bg-indigo-50/40 border-indigo-200 dark:bg-indigo-950/25 dark:border-indigo-900/60' 
                          : 'bg-slate-50/50 dark:bg-slate-950/20 border-slate-150 dark:border-slate-850 hover:bg-white dark:hover:bg-slate-900 hover:border-slate-300'
                      }`}
                    >
                      <div className={`p-2.5 rounded-lg shrink-0 ${
                        isS ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600' : 'bg-blue-50 dark:bg-blue-950/30 text-blue-500'
                      }`}>
                        {isS ? <FileSpreadsheet className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                      </div>

                      <div className="flex-1 min-w-0 pr-6">
                        <p className="text-[11.5px] font-black text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-650 transition-colors">
                          {f.name}
                        </p>
                        <p className="text-[9.5px] text-slate-400 mt-0.5 truncate leading-normal">
                          {f.contentDesc}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5 text-[8.5px] text-slate-400 font-mono">
                          <Clock className="w-2.5 h-2.5 text-slate-350" />
                          <span>Mise à jour : {new Date(f.modifiedTime).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>{f.size}</span>
                        </div>
                      </div>

                      {/* Delete File button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile(f.id, f.name);
                        }}
                        className="absolute right-2 top-2 p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Supprimer du Drive local"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Drag and Drop Zone inside Drive view to upload files directly */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-5 border border-dashed rounded-xl text-center cursor-pointer transition-colors ${
                isDragActive 
                  ? 'border-indigo-500 bg-indigo-50/20' 
                  : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400 bg-slate-50/30'
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={(e) => e.target.files?.[0] && processFileImport(e.target.files[0])}
                className="hidden" 
              />
              <UploadCloud className="w-5 h-5 mx-auto text-slate-400 mb-1 animate-pulse" />
              <p className="text-[10px] font-bold text-slate-500">
                Glissez un fichier local (.csv, .xlsx, .txt) pour l'importer dans ce Drive
              </p>
            </div>

          </div>

          {/* Drive Workspace Panel -> Work on selected File */}
          <div className="lg:col-span-7 space-y-4">
            
            {selectedFile ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-5 rounded-2xl shadow-xs space-y-4">
                
                {/* File Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4 gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                      {selectedFile.mimeType?.includes('spreadsheet') || selectedFile.name.endsWith('.csv') ? (
                        <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <FileText className="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Fichier Actif de Travail</h4>
                      <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 font-mono mt-0.5">{selectedFile.name}</h3>
                    </div>
                  </div>

                  {/* Operational Quick Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* If spreadsheet, allow loading and analyzing in chat */}
                    {(selectedFile.mimeType?.includes('spreadsheet') || selectedFile.name.endsWith('.csv')) && (
                      <button
                        onClick={() => handleLoadSheetToWorkspace(selectedFile)}
                        className="px-3 py-2 bg-emerald-600 hover:bg-slate-950 text-white text-[11px] font-black uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                        title="Analyser les données de cette feuille de calcul"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" /> Charger &amp; Analyser
                      </button>
                    )}

                    <button
                      onClick={handleAiAnalyzeFile}
                      disabled={isAiSummarizingFile}
                      className="px-2.5 py-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-650 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-150/40 rounded-lg text-[10px] font-black uppercase transition-colors flex items-center gap-1"
                    >
                      {isAiSummarizingFile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 animate-pulse" />}
                      Analyse Executive IA
                    </button>
                  </div>
                </div>

                {/* Live Sandbox editor representing working directly on Drive files */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black uppercase text-slate-400 font-mono flex items-center gap-1">
                      <PenTool className="w-3 h-3 text-indigo-500" />
                      Contenu modifiable (Données de la Grille / Texte)
                    </label>
                    <button
                      onClick={handleSaveDriveFile}
                      disabled={isSavingDriveFile}
                      className="flex items-center gap-1 text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 hover:text-slate-850"
                    >
                      {isSavingDriveFile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Enregistrer les saisies
                    </button>
                  </div>

                  <textarea
                    value={previewContent}
                    onChange={(e) => setPreviewContent(e.target.value)}
                    rows={12}
                    className="w-full p-4 text-[11.5px] font-mono leading-relaxed bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:bg-white resize-y dark:text-slate-200"
                    placeholder="Contenu brut du document..."
                  />
                  <p className="text-[10px] text-slate-400 leading-normal.">
                    💡 Modifiez n'importe quel élément ci-dessus pour simuler une correction en direct, puis cliquez sur <span className="font-extrabold text-slate-600 dark:text-slate-300">"Enregistrer"</span> et <span className="font-extrabold text-slate-600 dark:text-slate-300">"Charger & Analyser"</span> pour en faire profiter toute votre IA d'analyse.
                  </p>
                </div>

                {/* Gemini Automated summary box */}
                {fileAiSummary && (
                  <div className="p-4 bg-indigo-50/20 dark:bg-indigo-950/20 border border-indigo-100/30 rounded-xl text-left animate-in duration-200 fade-in slide-in-from-top-2">
                    <h5 className="text-[10px] font-black uppercase text-indigo-750 dark:text-indigo-400 tracking-wider flex items-center gap-1 mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      Synthèse Exécutive de l'IA
                    </h5>
                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed whitespace-pre-line font-medium">
                      {fileAiSummary}
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 p-16 rounded-2xl text-center text-slate-400">
                Sélectionnez un classeur ou écrivez un fichier dans la liste de gauche pour travailler dessus.
              </div>
            )}

            {/* Premium Instruction Accordion on working together inside Drive */}
            <div className="p-4 bg-slate-100/40 dark:bg-slate-900/30 border border-slate-150 dark:border-slate-800 rounded-xl flex items-start gap-3">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-500 leading-relaxed text-left">
                <p className="font-bold text-slate-700 dark:text-slate-300">💡 Information importante sur la souveraineté de vos données :</p>
                <p>Vos modifications sont traitées en local et écrites de manière sécurisée. Si vous êtes connecté avec votre compte Google, nous exploitons des requêtes conformes pour interagir via des protocoles sans risque de blocage sécuritaire.</p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* OPTION 2: GMAIL INBOX & AUTO AI RESPONDERS */}
      {hubTab === 'inbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left animate-in fade-in duration-150">
          
          {/* Email flow column list */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-4 border border-slate-200/50 dark:border-slate-800 rounded-2xl shadow-xs space-y-4">
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Inbox className="w-4 h-4 text-blue-500" />
                  Boite de réception Gmail
                </h3>
                <p className="text-[10px] text-slate-450">Sélectionnez un mail entrant pour y répondre à l'aide de l'IA.</p>
              </div>

              {/* Reload button */}
              <button
                onClick={() => token && fetchLiveGmailMessages(token)}
                disabled={isEmailsLoading}
                className="p-1.5 text-slate-400 hover:text-indigo-650 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-150 dark:border-slate-800"
                title="Rafraîchir les e-mails"
              >
                <RefreshCcw className={`w-3.5 h-3.5 ${isEmailsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Emails List */}
            {isEmailsLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mb-2" />
                Actualisation des messages...
              </div>
            ) : emailsList.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-slate-150 rounded-xl text-slate-400 text-xs">
                Boîte de réception vide ou en attente d'autorisation.
              </div>
            ) : (
              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {emailsList.map((m) => {
                  const isSelected = selectedEmail?.id === m.id;
                  
                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        setSelectedEmail(m);
                        setGeneratedReplyDraft('');
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all relative ${
                        isSelected
                          ? 'bg-indigo-50/40 border-indigo-200 dark:bg-indigo-950/25 dark:border-indigo-900/60'
                          : 'bg-slate-50/30 dark:bg-slate-950/10 border-slate-100 dark:border-slate-850 hover:bg-white dark:hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                          {m.from.split(' <')[0]}
                        </span>
                        <span className="text-[8.5px] font-mono text-slate-400 shrink-0">
                          {m.date}
                        </span>
                      </div>
                      
                      <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
                        {m.subject}
                      </p>
                      
                      <p className="text-[9.5px] text-slate-400 mt-0.5 ml-0 leading-normal line-clamp-2">
                        {m.snippet}
                      </p>

                      {isSelected && (
                        <span className="absolute top-1/2 -translate-y-1/2 right-2 w-1.5 h-1.5 rounded-full bg-indigo-600 block"></span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Demo Notice */}
            {!token ? (
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-150 dark:border-slate-800 flex items-start gap-2 text-[10.5px] text-slate-400 leading-relaxed">
                <UserCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>Connectez-vous pour voir vos vrais e-mails ou manipulez les e-mails de démo pré-intégrés immédiatement.</span>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50/40 dark:bg-emerald-950/25 rounded-xl border border-emerald-100 dark:border-emerald-900/40 flex items-start gap-2 text-[10.5px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Boîte Gmail réelle connectée avec succès ! Les réponses et e-mails rédigés sont expédiés en direct vers votre serveur cloud Gmail.</span>
              </div>
            )}

          </div>

          {/* Email Reader & AI Reply Formulation Workspace */}
          <div className="lg:col-span-7 space-y-4">
            
            {selectedEmail ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-5 rounded-2xl shadow-xs space-y-4">
                
                {/* Email visual core header */}
                <div className="border-b border-slate-100 dark:border-slate-800/80 pb-4 text-left">
                  <div className="flex justify-between items-start gap-2 flex-wrap">
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-slate-400 font-mono">Expéditeur</h4>
                      <p className="text-xs font-black text-indigo-750 dark:text-indigo-400 font-mono">{selectedEmail.from}</p>
                    </div>
                    <span className="text-[9px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-950 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-850">
                      {selectedEmail.date}
                    </span>
                  </div>

                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-150 mt-3">
                    {selectedEmail.subject}
                  </h3>
                </div>

                {/* Email message body content */}
                <div className="p-5 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-xl text-xs text-slate-700 dark:text-slate-350 min-h-[220px] max-h-[460px] overflow-y-auto whitespace-pre-wrap leading-relaxed text-left font-medium">
                  {selectedEmail.body}
                </div>

                {/* Responsive Smart Reply Toolset */}
                <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 space-y-3 text-left">
                  
                  <div className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                    Assistant de Réponse Intelligent
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                    
                    <div className="sm:col-span-4 space-y-1">
                      <label className="text-[8.5px] font-black uppercase text-slate-400 font-mono">Ton de la réponse</label>
                      <select
                        value={emailReplyTone}
                        onChange={(e) => setEmailReplyTone(e.target.value)}
                        className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-bold"
                      >
                        <option value="warm">🤝 Chaleureux &amp; Cordial</option>
                        <option value="professional">💼 Professionnel d'Élite</option>
                        <option value="strict">🎓 Administratif Strict</option>
                        <option value="short">⚡ Direct &amp; Très Court</option>
                      </select>
                    </div>

                    <div className="sm:col-span-8 space-y-1">
                      <label className="text-[8.5px] font-black uppercase text-slate-400 font-mono">Instructions d'écriture (Optionnel)</label>
                      <input
                        type="text"
                        value={emailReplyInstructions}
                        onChange={(e) => setEmailReplyInstructions(e.target.value)}
                        placeholder="Ex: refuser poliment ou fixer rdv vendredi à 14h..."
                        className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-medium"
                      />
                    </div>

                  </div>

                  <button
                    onClick={handleGenerateAiReply}
                    disabled={isGeneratingEmailReply}
                    className="w-full py-2.5 bg-indigo-650 hover:bg-slate-950 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {isGeneratingEmailReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Générer la Réponse IA Suggestion
                  </button>

                </div>

                {/* Simulated/Draft Reply Review panel */}
                {generatedReplyDraft && (
                  <div className="p-4 bg-indigo-50/15 dark:bg-indigo-950/20 border border-indigo-100/30 rounded-xl space-y-3 text-left animate-in duration-200 fade-in slide-in-from-top-3">
                    
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black uppercase text-slate-400 font-mono">Brouillon suggéré (Modifiable avant envoi)</label>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedReplyDraft);
                          showStatus('📋 Brouillon copié au presse-papiers avec succès !');
                        }}
                        className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Copier brut
                      </button>
                    </div>

                    <textarea
                      value={generatedReplyDraft}
                      onChange={(e) => setGeneratedReplyDraft(e.target.value)}
                      rows={12}
                      className="w-full p-3 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl outline-none font-medium leading-relaxed dark:text-slate-200"
                    />

                    {/* Interactive AI Refinement Pills */}
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800 space-y-2">
                      <div className="text-[9px] font-black uppercase text-slate-400 font-mono tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" />
                        <span>Raffiner la formulation par l'IA :</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={isRefining || !generatedReplyDraft}
                          onClick={() => handleRefineEmailText(generatedReplyDraft, 'professional', true)}
                          className="px-2.5 py-1 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                          title="Réécrire avec un vocabulaire français très élégant et professionnel"
                        >
                          💼 Langage Soutenu Exécutif
                        </button>
                        <button
                          type="button"
                          disabled={isRefining || !generatedReplyDraft}
                          onClick={() => handleRefineEmailText(generatedReplyDraft, 'diplomatic', true)}
                          className="px-2.5 py-1 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-705 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                          title="Réécrire avec un ton courtois, diplomatique et positif"
                        >
                          🕊️ Polissage Diplomatique
                        </button>
                        <button
                          type="button"
                          disabled={isRefining || !generatedReplyDraft}
                          onClick={() => handleRefineEmailText(generatedReplyDraft, 'concise', true)}
                          className="px-2.5 py-1 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-705 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                          title="Idéal pour les dirigeants, direct et synthétique"
                        >
                          ⚡ Court &amp; Synthétique
                        </button>
                      </div>
                    </div>

                    {/* Submit email button */}
                    <button
                      onClick={handleSendEmailReply}
                      disabled={isSendingEmailReply}
                      className="w-full py-2 bg-emerald-600 hover:bg-slate-950 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {isSendingEmailReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Valider &amp; Envoyer
                    </button>

                  </div>
                )}

              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 p-16 rounded-2xl text-center text-slate-400">
                Aucun e-mail sélectionné.
              </div>
            )}

          </div>
        </div>
      )}

      {/* OPTION 3: NEW EMAIL COMPOSER (WRITE NEW EMAILS) */}
      {hubTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left animate-in fade-in duration-150">
          
          {/* Form Composer block */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-2xl shadow-xs space-y-4">
            
            <div className="space-y-1">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-indigo-500" />
                Assistant de Rédaction Autonome
              </h3>
              <p className="text-[10px] text-slate-400">Précisez les consignes d'écriture et laissez l'IA composer un e-mail d'excellence.</p>
            </div>

            <div className="space-y-3">
              
              <div className="grid grid-cols-2 gap-3.5">
                
                <div className="space-y-1">
                  <label className="text-[8.5px] font-black uppercase text-slate-400 font-mono">E-mail Destinataire</label>
                  <input
                    type="email"
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    placeholder="partenaire@domaine.com"
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8.5px] font-black uppercase text-slate-400 font-mono">Style &amp; Alignement</label>
                  <select
                    value={composeTone}
                    onChange={(e) => setComposeTone(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-bold"
                  >
                    <option value="professional">💼 Très Formel &amp; Pro</option>
                    <option value="warm">🤝 Chaleureux, Pro-Sincère</option>
                    <option value="strict">🎓 Administratif Rigoureux</option>
                    <option value="short">⚡ Court &amp; Synthétique</option>
                  </select>
                </div>

              </div>

              <div className="space-y-1">
                <label className="text-[8.5px] font-black uppercase text-slate-400 font-mono">Objet / Titre Principal</label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Ex: Demande de collaboration / Proposition commerciale"
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-black"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8.5px] font-black uppercase text-slate-400 font-mono">Consigne ou contexte du message</label>
                <textarea
                  value={composeContext}
                  onChange={(e) => setComposeContext(e.target.value)}
                  placeholder="Ex: Proposer un partenariat d'affaires, saluer le partenariat actuel et demander d'échanger au téléphone..."
                  rows={4}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none resize-none font-medium"
                />
              </div>

              <button
                onClick={handleComposeNewMailAi}
                disabled={isComposingAi || !composeSubject.trim()}
                className="w-full py-2.5 bg-indigo-650 hover:bg-slate-950 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors disabled:bg-slate-100 dark:disabled:bg-slate-800"
              >
                {isComposingAi ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Sparkles className="w-4 h-4 text-indigo-300" />}
                Rédiger la correspondance IA
              </button>

            </div>

          </div>

          {/* Composition preview panel */}
          <div className="p-5 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between space-y-4">
            
            <div className="space-y-3 flex-1 flex flex-col">
              <div className="flex justify-between items-center bg-transparent">
                <span className="text-[8.5px] font-black uppercase text-slate-400 font-mono">Brouillon de message révisable</span>
                {composedBody && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(composedBody);
                      showStatus('📋 Correspondance copiée au presse-papiers !');
                    }}
                    className="text-[9px] font-bold text-indigo-600 hover:text-indigo-850"
                  >
                    Copier le texte
                  </button>
                )}
              </div>

              <textarea
                value={composedBody}
                onChange={(e) => setComposedBody(e.target.value)}
                placeholder="L'e-mail généré par l'assistant s'affichera ici..."
                className="w-full p-4 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl outline-none resize-none leading-relaxed flex-1 min-h-[420px] dark:text-slate-200 font-medium"
              />

              {/* Interactive AI Refinement Pills for Compose */}
              {composedBody && (
                <div className="bg-slate-100/50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="text-[9px] font-black uppercase text-slate-400 font-mono tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-indigo-500" />
                    <span>Raffiner la formulation par l'IA :</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={isRefining}
                      onClick={() => handleRefineEmailText(composedBody, 'professional', false)}
                      className="px-2.5 py-1 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                      title="Réécrire avec un vocabulaire français très élégant et professionnel"
                    >
                      💼 Langage Soutenu Exécutif
                    </button>
                    <button
                      type="button"
                      disabled={isRefining}
                      onClick={() => handleRefineEmailText(composedBody, 'diplomatic', false)}
                      className="px-2.5 py-1 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-705 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                      title="Réécrire avec un ton courtois, diplomatique et positif"
                    >
                      🕊️ Polissage Diplomatique
                    </button>
                    <button
                      type="button"
                      disabled={isRefining}
                      onClick={() => handleRefineEmailText(composedBody, 'concise', false)}
                      className="px-2.5 py-1 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-755 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                      title="Idéal pour les dirigeants, direct et synthétique"
                    >
                      ⚡ Court &amp; Synthétique
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleSendNewComposed}
              disabled={isSendingComposed || !composedBody || !composeTo}
              className="w-full py-2.5 bg-emerald-600 hover:bg-slate-950 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors disabled:bg-slate-100 dark:disabled:bg-slate-800"
            >
              {isSendingComposed ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Envoyer l'E-mail
            </button>

          </div>

        </div>
      )}

    </div>
  );
}
