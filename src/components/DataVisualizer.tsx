import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { ChartData } from '../services/geminiService';
import { Download, FileSpreadsheet, FileText, Camera, BarChart3, LineChart as LineIcon, PieChart as PieIcon, AreaChart as AreaIcon, Palette, Table as TableIcon } from 'lucide-react';
import { exportToCSV, exportToExcel, exportToPDF } from '../services/exportService';
import DataTable from './DataTable';

const PRESET_COLORS = [
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Emeraude', value: '#10b981' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Ambre', value: '#f59e0b' },
  { name: 'Bleu', value: '#3b82f6' },
  { name: 'Violet', value: '#8b5cf6' },
];

const PIE_COLORS = ['#4f46e5', '#10b981', '#f43f5e', '#f59e0b', '#3b82f6', '#8b5cf6'];

export default function DataVisualizer({ config }: { config: ChartData }) {
  const [chartType, setChartType] = useState<ChartData['type']>(config.type);
  const [primaryColor, setPrimaryColor] = useState(PRESET_COLORS[0].value);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [activePayload, setActivePayload] = useState<any>(null);
  
  const chartId = `chart-container-${config.title.toLowerCase().replace(/\s+/g, '-')}`;

  const downloadChartImage = () => {
    const container = document.getElementById(chartId);
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    // Use simple serializing approach
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const svgSize = svg.getBoundingClientRect();
    
    const scale = 2; // High resolution
    canvas.width = svgSize.width * scale;
    canvas.height = svgSize.height * scale;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Create a higher resolution canvas for better quality
      const scaleFactor = 2;
      canvas.width = svgSize.width * scaleFactor;
      canvas.height = svgSize.height * scaleFactor;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = `${config.title.toLowerCase().replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    };
    img.onerror = (e) => {
      console.error("Image export failed", e);
      alert("Erreur lors de l'export de l'image.");
    };
    img.src = url;
  };

  const onChartHover = (state: any) => {
    if (state && state.activePayload && state.activePayload.length > 0) {
      setActivePayload(state.activePayload[0].payload);
    } else {
      setActivePayload(null);
    }
  };

  const renderChart = () => {
    const chartProps = {
      onMouseMove: onChartHover,
      onMouseLeave: () => setActivePayload(null),
    };

    switch (chartType) {
      case 'bar':
        return (
          <BarChart data={config.data} {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" opacity={0.5} />
            <XAxis dataKey="name" fontSize={10} tick={{ fill: '#64748b' }} axisLine={false} />
            <YAxis fontSize={10} tick={{ fill: '#64748b' }} axisLine={false} />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
            />
            <Bar dataKey="value" fill={primaryColor} radius={[4, 4, 0, 0]}>
              {config.data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={activePayload === entry ? '#1e293b' : primaryColor}
                  className="transition-all duration-300"
                />
              ))}
            </Bar>
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={config.data} {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" opacity={0.5} />
            <XAxis dataKey="name" fontSize={10} tick={{ fill: '#64748b' }} />
            <YAxis fontSize={10} tick={{ fill: '#64748b' }} />
            <Tooltip />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={primaryColor} 
              strokeWidth={activePayload ? 3 : 2} 
              dot={{ r: 4, fill: primaryColor }} 
              activeDot={{ r: 6, fill: '#1e293b' }}
            />
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart data={config.data} {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" opacity={0.5} />
            <XAxis dataKey="name" fontSize={10} />
            <YAxis fontSize={10} />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke={primaryColor} fill={primaryColor} fillOpacity={0.2} />
          </AreaChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={config.data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              onMouseEnter={(_, index) => setActivePayload(config.data[index])}
              onMouseLeave={() => setActivePayload(null)}
            >
              {config.data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={activePayload === entry ? '#1e293b' : PIE_COLORS[index % PIE_COLORS.length]} 
                  className="transition-all"
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        );
      default:
        return null;
    }
  };

  const getCsvContent = () => {
    const headers = Object.keys(config.data[0]).join(',');
    const csvContent = config.data.map(item => Object.values(item).join(',')).join('\n');
    return `${headers}\n${csvContent}`;
  };

  const handleDownload = (type: 'csv' | 'excel' | 'pdf') => {
    const baseName = config.title.toLowerCase().replace(/\s+/g, '_');
    const data = getCsvContent();
    switch (type) {
      case 'csv':
        exportToCSV(data, `${baseName}.csv`);
        break;
      case 'excel':
        exportToExcel(data, `${baseName}.xlsx`);
        break;
      case 'pdf':
        exportToPDF(data, config.title, `${baseName}.pdf`);
        break;
    }
  };

  return (
    <div className={`w-full ${viewMode === 'table' ? 'min-h-[400px]' : 'h-80'} mt-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 relative transition-all overflow-hidden group`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{config.title}</h3>
        <div className="flex gap-1">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg mr-2">
            <button
              onClick={() => setViewMode('chart')}
              className={`p-1 rounded-md transition-all ${viewMode === 'chart' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
              title="Graphique"
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1 rounded-md transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
              title="Tableau"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="Personnaliser"
          >
            <Palette className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-slate-100 dark:bg-slate-800 mx-1 self-center" />
          <button 
            onClick={downloadChartImage}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-purple-600 transition-colors"
            title="Télécharger Figure (Image)"
          >
            <Camera className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleDownload('csv')}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
            title="Télécharger CSV"
          >
            <Download className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleDownload('excel')}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-green-600 transition-colors"
            title="Télécharger Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleDownload('pdf')}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
            title="Télécharger PDF"
          >
            <FileText className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="absolute top-14 left-4 right-4 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-wrap gap-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Type de Graphique</label>
              <div className="flex gap-1.5">
                {[
                  { id: 'bar', icon: BarChart3 },
                  { id: 'line', icon: LineIcon },
                  { id: 'area', icon: AreaIcon },
                  { id: 'pie', icon: PieIcon },
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setChartType(type.id as ChartData['type'])}
                    className={`p-2 rounded-lg border transition-all ${
                      chartType === type.id 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 ring-2 ring-indigo-100' 
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-indigo-300'
                    }`}
                  >
                    <type.icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Couleur Principale</label>
              <div className="flex gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setPrimaryColor(color.value)}
                    className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                      primaryColor === color.value 
                        ? 'border-indigo-600 scale-125' 
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'chart' ? (
        <div id={chartId} className="w-full h-[80%] transition-opacity duration-300">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="animate-in fade-in duration-300">
          <DataTable 
            data={config.data} 
            onRowClick={(row) => setActivePayload(row === activePayload ? null : row)}
            highlightedRow={activePayload}
          />
        </div>
      )}
    </div>
  );
}
