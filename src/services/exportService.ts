import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

// Ensure basic environment polyfills for xlsx and other libraries
if (typeof window !== 'undefined') {
  if (!(window as any).process) (window as any).process = { env: {} };
  if (!(window as any).global) (window as any).global = window;
  // Shim for stream to avoid SheetJS/XLSX error "Cannot read properties of undefined (reading 'readable')"
  if (!(window as any).Buffer) (window as any).Buffer = { isBuffer: () => false };
}

export const exportToCSV = (data: string, filename: string = 'export_ia_imbert.csv') => {
  let csv = "";
  try {
    // If it's a JSON stringified array (from table scraping)
    if (data.startsWith('[[')) {
      const parsed = JSON.parse(data);
      csv = Papa.unparse(parsed);
    } else {
      const cleanData = data.replace(/--- FEUILLE:.*?\n/g, ''); 
      const parsed = Papa.parse(cleanData, { header: true });
      csv = Papa.unparse(parsed.data);
    }
  } catch (e) {
    csv = data; // Fallback to raw
  }
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToExcel = (data: string, filename: string = 'export_ia_imbert.xlsx') => {
  console.log("Exporting to Excel:", { dataLength: data.length, filename });
  try {
    const workbook = XLSX.utils.book_new();
    const sheets = data.split('--- FEUILLE:').filter(Boolean);

    const cleanSheetName = (name: string) => {
      // Excel restricts: \ / ? * [ ] : and max length 31
      return name
        .replace(/[\\/?*\[\]:]/g, '_')
        .substring(0, 31)
        .trim() || 'Sheet';
    };

    let sheetAdded = false;

    if (sheets.length <= 1 && !data.includes('--- FEUILLE:')) {
      let worksheet;
      try {
        if (data.trim().startsWith('[[')) {
          const rows = JSON.parse(data.trim());
          worksheet = XLSX.utils.aoa_to_sheet(rows);
        } else {
          const rows = Papa.parse(data, { header: true }).data;
          worksheet = XLSX.utils.json_to_sheet(rows);
        }
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Données Exportées');
        sheetAdded = true;
      } catch (e) {
        console.error("Single sheet parse failed:", e);
      }
    } else {
      sheets.forEach((sheetBlock, idx) => {
        // Robust split: handles both \n and \r\n and optional trailing spaces
        const parts = sheetBlock.split(/---\s*[\r\n]+/);
        if (parts.length < 2) return;
        
        let sheetName = cleanSheetName(parts[0].trim() || `Sheet${idx + 1}`);
        const csvData = parts[1];
        
        if (!csvData || csvData.trim().length === 0) return;

        const rows = Papa.parse(csvData, { header: true }).data;
        const worksheet = XLSX.utils.json_to_sheet(rows);
        
        // Ensure unique sheet name
        let finalName = sheetName;
        let count = 1;
        while (workbook.SheetNames.includes(finalName)) {
          finalName = `${sheetName.substring(0, 28)}_${count++}`;
        }
        
        XLSX.utils.book_append_sheet(workbook, worksheet, finalName);
        sheetAdded = true;
      });
    }

    if (!sheetAdded) {
      // Final fallback to avoid "Workbook is empty" error
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Information", "Aucune donnée n'a pu être structurée pour l'export"]]), 'Instructions');
    }
    
    // Use XLSX.writeFile for automatic blob management if in browser environment
    // or manually generate if writeFile is not available/working
    if (typeof window !== 'undefined') {
      XLSX.writeFile(workbook, filename);
    } else {
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      downloadBlob(new Blob([wbout], { type: 'application/octet-stream' }), filename);
    }
    
    console.log("Export to Excel completed successfully.");
  } catch (error) {
    console.error("Excel export error:", error);
    // Alert the user instead of silent fallback to CSV with confusing extension
    alert("L'exportation Excel a échoué. Tentative de téléchargement en format CSV de secours.");
    exportToCSV(data, filename.replace('.xlsx', '.csv'));
  }
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToPDF = (
  data: string, 
  summary: string = '', 
  filename: string = 'rapport_ia_imbert.pdf'
) => {
  console.log("Exporting to PDF:", { dataLength: data.length, summaryLength: summary.length });
  try {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.setTextColor(79, 70, 229); 
    doc.text('Rapport IA Imbert', 14, 20);
    
    // Date
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Généré le: ${new Date().toLocaleString()}`, 14, 28);

    let startY = 35;

    // AI Summary Section
    if (summary) {
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text('Résumé de l\'analyse AI:', 14, startY);
      
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const splitSummary = doc.splitTextToSize(summary, 180);
      doc.text(splitSummary, 14, startY + 7);
      startY += 12 + (splitSummary.length * 5);
    }

    const sheets = data.split('--- FEUILLE:').filter(Boolean);
    const dataToProcess = sheets.length > 0 ? (sheets[0].includes('---\n') ? sheets[0].split('---\n')[1] : sheets[0]) : data;

    let rows: any[] = [];
    if (dataToProcess.startsWith('[[')) {
      rows = JSON.parse(dataToProcess);
    } else {
      rows = Papa.parse(dataToProcess, { header: true }).data;
    }

    if (rows.length > 0) {
      const headers = [Object.keys(rows[0] as any)];
      const body = rows.map((row: any) => Object.values(row));

      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text(`Aperçu des Données:`, 14, startY);

      autoTable(doc, {
        head: headers,
        body: body.slice(0, 100),
        startY: startY + 5,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 7, cellPadding: 2 },
      });
    }

    doc.save(filename);
  } catch (error) {
    console.error("PDF export error:", error);
    throw error;
  }
};
