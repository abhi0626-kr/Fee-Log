'use client';

import React, { useState, useEffect } from 'react';
import {
  FileDown,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import {
  getTodayIST,
  formatISTDate,
  shiftDate,
} from '@/lib/date-utils';
import {
  getUnifiedLogsForDate,
  getSettings,
  getAllLoggedDates,
} from '@/lib/sync-storage';
import {
  generateCSV,
  downloadCSVFile,
  generateDoctorPDF,
} from '@/lib/export-utils';
import { UnifiedLogItem, UserSettings, MEDICAL_DISCLAIMER } from '@/types';

export default function ExportPage() {
  const [today] = useState<string>(getTodayIST());
  const [startDate, setStartDate] = useState<string>(shiftDate(getTodayIST(), -13));
  const [endDate, setEndDate] = useState<string>(getTodayIST());
  const [settings, setSettings] = useState<UserSettings>(getSettings());
  const [selectedLogs, setSelectedLogs] = useState<UnifiedLogItem[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Collect all unified logs between startDate and endDate
    const allDates = getAllLoggedDates().filter((d) => d >= startDate && d <= endDate);
    const combined: UnifiedLogItem[] = [];

    allDates.forEach((d) => {
      const dayLogs = getUnifiedLogsForDate(d);
      combined.push(...dayLogs);
    });

    combined.sort((a, b) => {
      if (a.log_date === b.log_date) {
        return a.log_time.localeCompare(b.log_time);
      }
      return a.log_date.localeCompare(b.log_date);
    });

    setSelectedLogs(combined);
    setSettings(getSettings());
  }, [startDate, endDate]);

  const handleDownloadCSV = () => {
    setIsExporting(true);
    try {
      const csvData = generateCSV(selectedLogs);
      downloadCSVFile(csvData, `T1D_Log_${startDate}_to_${endDate}.csv`);
      setExportSuccess('CSV downloaded successfully');
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPDF = () => {
    setIsExporting(true);
    try {
      generateDoctorPDF(selectedLogs, settings, startDate, endDate);
      setExportSuccess('Doctor PDF report generated successfully');
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePreset = (days: number) => {
    setStartDate(shiftDate(today, -(days - 1)));
    setEndDate(today);
  };

  return (
    <div className="pb-28 max-w-lg mx-auto px-4 pt-4">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider">
          <FileDown className="w-4 h-4" />
          <span>Clinical Export</span>
        </div>
        <h1 className="text-xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
          Export Logs for Doctor
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Generate structured PDF for endocrinologist visits or CSV for analysis
        </p>
      </div>

      {/* Doctor Copy Banner */}
      <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl mb-5 shadow-xs">
        <p className="text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
          ★ Bring this to your endocrinologist to discuss your insulin regimen
        </p>
        <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
          {MEDICAL_DISCLAIMER}
        </p>
      </div>

      {/* Date Range Selection Card */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-sm mb-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Select Date Range
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => handlePreset(7)}
              className="px-2 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-lg text-slate-600 dark:text-slate-300"
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => handlePreset(14)}
              className="px-2 py-1 text-[11px] font-semibold bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 rounded-lg text-teal-700 dark:text-teal-300 border border-teal-200/60"
            >
              14 Days (Recommended)
            </button>
            <button
              type="button"
              onClick={() => handlePreset(30)}
              className="px-2 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-lg text-slate-600 dark:text-slate-300"
            >
              30 Days
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>

        <p className="text-[11px] text-slate-500 mt-2">
          Selected: {formatISTDate(startDate)} to {formatISTDate(endDate)} ({selectedLogs.length} events logged)
        </p>
      </div>

      {/* Export Action Buttons */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {/* PDF Download Button */}
        <button
          type="button"
          disabled={isExporting || selectedLogs.length === 0}
          onClick={handleDownloadPDF}
          className="p-4 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white shadow-md active:scale-[0.98] transition-all flex flex-col items-center justify-center text-center min-h-[90px]"
        >
          <FileText className="w-6 h-6 mb-1.5" />
          <span className="text-xs font-bold">Download Doctor PDF</span>
          <span className="text-[10px] text-teal-100 mt-0.5">
            Printable 1–2 week clinical report
          </span>
        </button>

        {/* CSV Download Button */}
        <button
          type="button"
          disabled={isExporting || selectedLogs.length === 0}
          onClick={handleDownloadCSV}
          className="p-4 rounded-2xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 disabled:opacity-50 text-white shadow-md active:scale-[0.98] transition-all flex flex-col items-center justify-center text-center min-h-[90px]"
        >
          <FileSpreadsheet className="w-6 h-6 mb-1.5 text-emerald-400" />
          <span className="text-xs font-bold">Download CSV</span>
          <span className="text-[10px] text-slate-300 mt-0.5">
            Spreadsheet with exact schema
          </span>
        </button>
      </div>

      {exportSuccess && (
        <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {exportSuccess}
        </div>
      )}

      {/* Preview Table of Records to be Exported */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-sm">
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
          Preview Selected Records ({selectedLogs.length})
        </h3>

        {selectedLogs.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">
            No records found for selected date window.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr className="text-slate-400 text-[10px] uppercase">
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">Time</th>
                  <th className="py-2 pr-2">Category</th>
                  <th className="py-2 pr-2">Details</th>
                  <th className="py-2">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-750">
                {selectedLogs.slice(0, 50).map((item) => {
                  let details = '';
                  let note = '';
                  if (item.category === 'insulin' && item.insulin) {
                    details = `${item.insulin.insulin_type}: ${item.insulin.units}U`;
                    note = item.insulin.note || '';
                  } else if (item.category === 'food' && item.food) {
                    details = `${item.food.meal}: ${item.food.items}`;
                    note = item.food.note || '';
                  } else if (item.category === 'activity' && item.activity) {
                    details = `${item.activity.activity_type}: ${item.activity.duration_min}m`;
                    note = item.activity.note || '';
                  } else if (item.category === 'feel' && item.feel) {
                    details = `Feel: ${item.feel.feel}`;
                    note = item.feel.symptoms?.join(', ') || '';
                  } else if (item.category === 'glucose' && item.glucose) {
                    details = `${item.glucose.reading_mgdl} mg/dL`;
                    note = item.glucose.note || '';
                  }

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-2 pr-2 text-slate-500 font-mono text-[10px]">
                        {item.log_date}
                      </td>
                      <td className="py-2 pr-2 font-bold text-slate-800 dark:text-slate-200">
                        {item.log_time}
                      </td>
                      <td className="py-2 pr-2 uppercase font-semibold text-[10px] text-teal-600">
                        {item.category}
                      </td>
                      <td className="py-2 pr-2 text-slate-700 dark:text-slate-300 truncate max-w-[130px]">
                        {details}
                      </td>
                      <td className="py-2 text-slate-400 text-[11px] truncate max-w-[100px]">
                        {note || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
