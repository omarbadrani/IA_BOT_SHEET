import { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, Filter, ArrowUpDown } from 'lucide-react';

interface DataTableProps {
  data: any[];
  title?: string;
  onRowClick?: (row: any) => void;
  highlightedRow?: any;
}

export default function DataTable({ data, title, onRowClick, highlightedRow }: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const columns = useMemo(() => {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]);
  }, [data]);

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Search
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(row => 
        Object.values(row).some(val => 
          String(val).toLowerCase().includes(lowerSearch)
        )
      );
    }

    // Sort
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchTerm, sortConfig]);

  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  if (!data || data.length === 0) return null;

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        {title && (
          <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
            {title}
          </h4>
        )}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-indigo-500 transition-all dark:text-slate-200"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              {columns.map(col => (
                <th 
                  key={col}
                  onClick={() => requestSort(col)}
                  className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {col}
                    {sortConfig?.key === col ? (
                      sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {paginatedData.map((row, idx) => {
              const isHighlighted = highlightedRow === row;
              return (
                <tr 
                  key={idx}
                  onClick={() => onRowClick?.(row)}
                  className={`group transition-colors ${
                    isHighlighted 
                      ? 'bg-indigo-50 dark:bg-indigo-900/20' 
                      : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                  } cursor-pointer`}
                >
                  {columns.map(col => (
                    <td 
                      key={col}
                      className={`px-4 py-3 text-xs ${
                        isHighlighted ? 'text-indigo-700 dark:text-indigo-300 font-medium' : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {String(row[col])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center px-4">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            Page {currentPage} sur {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              <ChevronDown className="w-4 h-4 rotate-90" />
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              <ChevronDown className="w-4 h-4 -rotate-90" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
