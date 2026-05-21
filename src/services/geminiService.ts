import * as XLSX from 'xlsx';
import { GoogleGenAI } from "@google/genai";
import Papa from 'papaparse';

const DEFAULT_MODEL = "gemini-3-flash-preview"; 

// Helper to get API Key
export const getGeminiApiKey = () => localStorage.getItem('gemini_api_key') || '';
export const setGeminiApiKey = (key: string) => localStorage.setItem('gemini_api_key', key);

/**
 * Call the backend server which has the backup integrated API keys configured
 */
async function callBackendFallback(contents: any, systemInstruction?: string) {
  try {
    const response = await fetch("/api/gemini-fallback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        systemInstruction,
        model: DEFAULT_MODEL,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Erreur serveur (${response.status})`);
    }

    const data = await response.json();
    if (!data.text) {
      throw new Error("Aucune réponse du serveur de secours.");
    }
    return data.text;
  } catch (err: any) {
    console.error("Erreur d'appel du fallback de secours de l'application:", err);
    throw new Error("QUOTA_EXCEEDED_AND_FALLBACK_FAILED");
  }
}

/**
 * Direct call to Gemini from the client with retry logic for 503 errors
 */
async function callGemini(contents: any, systemInstruction?: string, retries = 3, delay = 2000) {
  const apiKey = getGeminiApiKey();
  
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  const ai = new GoogleGenAI({ apiKey });
  const formattedContents = typeof contents === 'string' ? [{ role: "user", parts: [{ text: contents }] }] : contents;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await ai.models.generateContent({
        model: DEFAULT_MODEL, 
        contents: formattedContents,
        config: {
          systemInstruction: systemInstruction,
        },
      });

      if (!response || !response.text) {
        throw new Error("Aucune réponse du modèle.");
      }

      return response.text;
    } catch (error: any) {
      const isUnavailable = error?.message?.includes("503") || error?.message?.includes("UNAVAILABLE") || error?.status === 503;
      const isQuotaExceeded = error?.message?.includes("429") || error?.message?.includes("RESOURCE_EXHAUSTED") || error?.status === 429 || error?.message?.includes("quota");
      
      if (isUnavailable && i < retries - 1) {
        console.warn(`Gemini 503 error, retrying (${i + 1}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i))); // Exponential backoff
        continue;
      }

      if (isQuotaExceeded) {
        console.warn("Quota utilisateur épuisé. Tentative via les clés de secours de l'application...");
        try {
          return await callBackendFallback(formattedContents, systemInstruction);
        } catch (fallbackError: any) {
          if (fallbackError.message === "QUOTA_EXCEEDED_AND_FALLBACK_FAILED") {
            throw new Error("QUOTA_EXCEEDED_AND_FALLBACK_FAILED");
          }
          throw fallbackError;
        }
      }
      
      console.error("Gemini Client Error:", error);
      throw error;
    }
  }
  
  throw new Error("Le service est saturé. Veuillez réessayer dans quelques instants.");
}

/**
 * Fetch sheet names from a Google Sheet
 */
export async function getWorkbookSheets(sheetId: string, accessToken?: string) {
  if (!sheetId || sheetId === "YOUR_SHEET_ID_HERE") return [];
  
  const cleanId = sheetId.includes("/") 
    ? sheetId.split("/d/")[1]?.split("/")[0] || sheetId.trim()
    : sheetId.trim();

  try {
    const xlsxUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/export?format=xlsx`;
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    const response = await fetch(xlsxUrl, { headers });
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { bookSheets: true });
      return workbook.SheetNames;
    }
  } catch (error) {
    console.warn(`Failed to get sheet names for ${cleanId}`, error);
  }
  return [];
}

/**
 * Fetch data from one or more Google Sheets and combine them
 */
export async function fetchSheetData(
  sheetIdsInput: string | string[],
  selectedSheetsMap?: Record<string, string[]>,
  accessToken?: string
) {
  const ids = Array.isArray(sheetIdsInput) ? sheetIdsInput : [sheetIdsInput];
  let fullCombinedData = "";

  for (let i = 0; i < ids.length; i++) {
    const sheetId = ids[i];
    if (!sheetId || sheetId === "YOUR_SHEET_ID_HERE") continue;
    
    // Clean the ID in case a full URL was pasted
    const cleanId = sheetId.includes("/") 
      ? sheetId.split("/d/")[1]?.split("/")[0] || sheetId.trim()
      : sheetId.trim();

    let sheetData = "";
    const sourceLabel = ids.length > 1 ? `SOURCE ${i + 1} (ID: ${cleanId})` : "";
    const selectedForThisId = selectedSheetsMap ? selectedSheetsMap[sheetId] : null;

    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Try fetching everything as XLSX to get all sheets/tabs
    try {
      const xlsxUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/export?format=xlsx`;
      console.log(`[Export] Fetching XLSX: ${xlsxUrl}`);
      const response = await fetch(xlsxUrl, { headers });
      
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        
        workbook.SheetNames.forEach(sheetName => {
          // If we have selections and this sheet isn't selected, skip it
          if (selectedForThisId && selectedForThisId.length > 0 && !selectedForThisId.includes(sheetName)) {
            return;
          }
          
          const worksheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(worksheet);
          sheetData += `\n--- FEUILLE: ${sheetName} ${sourceLabel} ---\n${csv}\n`;
        });
      }
    } catch (error) {
      console.warn(`XLSX export failed for ${cleanId}`, error);
    }

    if (!sheetData) {
      try {
        // Fallback to gviz for single sheet
        const url = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:csv`;
        const response = await fetch(url, { headers });
        if (response.ok) {
          const text = await response.text();
          if (!text.includes("<!DOCTYPE html>") && !text.includes("<html")) {
            sheetData = `\n--- FEUILLE: Principal ${sourceLabel} ---\n${text}\n`;
          }
        }
      } catch (error) {
        console.error(`Network error fetching sheet ${cleanId}:`, error);
      }
    }

    fullCombinedData += sheetData;
  }

  return fullCombinedData;
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export interface ChartData {
  type: 'bar' | 'line' | 'area' | 'pie';
  data: any[];
  xAxis: string;
  yAxis: string;
  title: string;
}

export async function parseCSV(csv: string) {
  return new Promise<any[]>((resolve) => {
    Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
    });
  });
}

/**
 * Helper to format Gemini errors into user-friendly messages
 */
export function formatGeminiError(error: any): string {
  const msg = error?.message || "";
  if (msg === 'API_KEY_MISSING') return "⚠️ Clé API manquante. Veuillez la configurer dans les paramètres.";
  if (msg === 'QUOTA_EXCEEDED_AND_FALLBACK_FAILED') {
    return "⚠️ Quota dépassé pour votre clé API, et toutes les clés de secours de l'application ont également échoué ou sont épuisées.";
  }
  if (msg === 'QUOTA_EXCEEDED') return "⚠️ Quota dépassé. Vous avez atteint la limite de requêtes pour votre clé API gratuite actuelle (20 requêtes/jour). Veuillez patienter ou utiliser une autre clé.";
  if (msg.includes('API Key')) return "⚠️ Configuration de clé API incorrecte.";
  if (msg.includes('404')) return "⚠️ Modèle introuvable (Erreur 404).";
  if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
    return "⚠️ Le service AI est actuellement saturé par une forte demande. Merci de patienter quelques secondes et de relancer votre demande.";
  }
  return `⚠️ Erreur AI: ${msg || "Erreur technique"}`;
}

export async function getKnowledgeSummary(data: string) {
  const prompt = `
    Analyze this CSV data and provide a professional, one-sentence summary of what this database contains and its main columns.
    Data snippet: ${data.slice(0, 2000)}
  `;

  try {
    return await callGemini(prompt);
  } catch (error: any) {
    if (error.message === 'QUOTA_EXCEEDED' || error.message === 'QUOTA_EXCEEDED_AND_FALLBACK_FAILED') {
      return "⚠️ Quota dépassé pour l'analyse automatique.";
    }
    console.error("Knowledge Summary Error:", error);
    return "Analyse terminée (Contexte réduit).";
  }
}

export async function generateDetailedSummary(data: string) {
  const prompt = `
    Analyze this multi-sheet CSV data (identified by --- FEUILLE: name --- separators) and provide a detailed master summary for a professional PDF report.
    
    Include:
    1. A synthesized overview of ALL sheets and how they relate.
    2. Key metrics and totals across the entire workbook.
    3. Specific insights found in individual sheets.
    4. Data structure audit (which sheets are most critical).
    
    Format the response as clear paragraphs with bullet points.
    Language: French.
    Data snippet: ${data.slice(0, 4000)}
  `;

  try {
    return await callGemini(prompt);
  } catch (error: any) {
    if (error.message === 'QUOTA_EXCEEDED' || error.message === 'QUOTA_EXCEEDED_AND_FALLBACK_FAILED') {
      throw new Error("QUOTA_EXCEEDED");
    }
    return "Erreur lors de la génération du résumé.";
  }
}

export async function getSuggestions(data: string) {
  const prompt = `
    Based on this CSV data snippet, suggest 3 short, helpful questions or commands a user might ask an AI analyst to explore the data.
    Make them specific and practical (e.g., "Quel est le produit le plus cher ?" or "Affiche un graphique des catégories").
    Return ONLY a JSON array of strings. 
    Language: French.
    Data: ${data.slice(0, 2000)}
  `;

  try {
    const text = await callGemini(prompt);
    const matches = text.match(/\[.*\]/s);
    return matches ? JSON.parse(matches[0]) : [];
  } catch (error: any) {
    if (error.message === 'QUOTA_EXCEEDED' || error.message === 'QUOTA_EXCEEDED_AND_FALLBACK_FAILED') {
      return ["⚠️ Quota API dépassé"];
    }
    console.error("Suggestions Error:", error);
    return [
      "Fais-moi un résumé des données",
      "Quelles sont les colonnes ?",
      "Analyse les tendances"
    ];
  }
}

export async function getChatResponse(
  history: ChatMessage[],
  sheetData: string,
  userPrompt: string,
  knowledgeSummary?: string
) {
  const safeSheetData = sheetData.length > 200000 ? sheetData.slice(0, 200000) + "\n[Data truncated for stability...]" : sheetData;
  
  const systemInstruction = `
    You are a specialized expert for "Sheet App IA Imbert", a stateful data analyst.
    
    CONVERSATION CONTINUITY:
    - ALWAYS maintain context from previous turns. If the user uses pronouns (e.g., "them", "him", "those", "that sheet"), resolve them using the conversation history.
    - If the user asks a follow-up question after a data search, assume they are still talking about the same subset of data unless they explicitly change the subject.
    
    KNOWLEDGE CONTEXT:
    ${knowledgeSummary ? `Current Workbook Overview: ${knowledgeSummary}` : ""}
    
    FULL DATABASE (Multi-sheet CSV marked with --- FEUILLE: name ---):
    ${safeSheetData}
    
    RELATIONAL ANALYSIS:
    - If multiple sources (SOURCE 1, SOURCE 2, etc.) are present, check for matching columns (ID, Email, Date, SKU, etc.).
    - Your goal is often to find the "liaison" (connection) between these datasets.
    - Explain explicitly which columns connect the sheets if asked.
    
    CAPABILITIES:
    1. TABLES: Use Markdown for any data presentation.
    2. VISUALIZATION: Append the JSON block for charts:
       { "chart": { "type": "bar|line|area|pie", "data": [{ "name": "val", "value": 123 }, ...], "xAxis": "label", "yAxis": "value", "title": "Title" } }
    3. SEARCH LOGIC: Search across all sheets. If information is missing in one sheet, check the others.
 
    ANALYTICAL RULES:
    1. RELATIONAL SEARCH: If a user asks a question about a row found in a previous turn, look up its specific details again in the database.
    2. LANGUAGE: Answer in the user's language (default: French).
    3. PRECISION: Give exact counts and values. Never guess.
  `;

  try {
    const contents = [
      ...history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
      { role: "user", parts: [{ text: userPrompt }] }
    ];

    return await callGemini(contents, systemInstruction);
  } catch (error: any) {
    console.error("Gemini Error:", error);
    return formatGeminiError(error);
  }
}

/**
 * Direct custom call to Gemini with specific custom instructions (avoiding sheet analytical boilerplate)
 */
export async function getDirectGenAiResponse(prompt: string, systemInstruction?: string) {
  try {
    return await callGemini([{ role: "user", parts: [{ text: prompt }] }], systemInstruction);
  } catch (error: any) {
    console.error("Direct GenAI Error:", error);
    return formatGeminiError(error);
  }
}

