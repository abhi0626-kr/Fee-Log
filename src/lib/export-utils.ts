import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  UnifiedLogItem,
  UserSettings,
  MEDICAL_DISCLAIMER,
  FEEL_COLORS,
} from '@/types';
import { formatISTDate, formatISTTime } from './date-utils';

/**
 * Generates and downloads CSV string matching exact spec columns:
 * date, time, category, insulin_type/meal/activity/feel, units/items/duration/feel_level, carb_size, symptoms, glucose_mgdl, note
 */
export function generateCSV(logs: UnifiedLogItem[]): string {
  const headers = [
    'date',
    'time',
    'category',
    'insulin_type/meal/activity/feel',
    'units/items/duration/feel_level',
    'carb_size',
    'symptoms',
    'glucose_mgdl',
    'note',
  ];

  const escapeCSV = (str: string | number | null | undefined): string => {
    if (str === null || str === undefined) return '';
    const val = String(str).replace(/"/g, '""');
    return `"${val}"`;
  };

  const rows = logs.map((item) => {
    let subType = '';
    let mainValue = '';
    let carbSize = '';
    let symptoms = '';
    let glucoseVal = '';
    let note = '';

    if (item.category === 'insulin' && item.insulin) {
      subType = item.insulin.insulin_type;
      mainValue = `${item.insulin.units} U`;
      note = item.insulin.note || '';
    } else if (item.category === 'food' && item.food) {
      subType = item.food.meal;
      mainValue = item.food.items;
      carbSize = item.food.carb_size || '';
      note = item.food.note || '';
    } else if (item.category === 'activity' && item.activity) {
      subType = item.activity.activity_type;
      mainValue = `${item.activity.duration_min} min (${item.activity.intensity || 'moderate'})`;
      note = item.activity.note || '';
    } else if (item.category === 'feel' && item.feel) {
      subType = 'feel';
      mainValue = item.feel.feel;
      symptoms = (item.feel.symptoms || []).join('; ');
      note = item.feel.note || '';
    } else if (item.category === 'glucose' && item.glucose) {
      subType = item.glucose.context || 'reading';
      mainValue = `${item.glucose.reading_mgdl} mg/dL`;
      glucoseVal = `${item.glucose.reading_mgdl}`;
      note = item.glucose.note || '';
    }

    return [
      escapeCSV(item.log_date),
      escapeCSV(item.log_time),
      escapeCSV(item.category),
      escapeCSV(subType),
      escapeCSV(mainValue),
      escapeCSV(carbSize),
      escapeCSV(symptoms),
      escapeCSV(glucoseVal),
      escapeCSV(note),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function downloadCSVFile(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates and downloads clean doctor PDF report
 */
export function generateDoctorPDF(
  logs: UnifiedLogItem[],
  settings: UserSettings,
  startDate: string,
  endDate: string
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  // Header banner
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, doc.internal.pageSize.width, 95, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('T1D Log — Clinical Log & Pattern Summary', 40, 42);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Patient: ${settings.display_name}  |  Age: 20  |  Height: ${settings.height_cm} cm  |  Weight: ${settings.weight_kg} kg`,
    40,
    62
  );
  doc.text(
    `Date Range: ${formatISTDate(startDate)} — ${formatISTDate(endDate)}  |  Timezone: Asia/Kolkata (IST)`,
    40,
    78
  );

  // Subheader: Current Regimen Box
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(40, 110, doc.internal.pageSize.width - 80, 56, 4, 4, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('CURRENT INSULIN REGIMEN (FROM SETTINGS):', 50, 126);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `• Morning: ${settings.morning_regular_units} Units Regular (R) before meal\n• Night: ${settings.night_30_70_units} Units Biphasic 30/70 before meal`,
    50,
    142
  );

  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Note: Glucose reading is optional/nullable. Logs capture daily food, insulin, feel, and exercise.',
    310,
    146
  );

  // Doctor note callout
  doc.setTextColor(180, 83, 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(
    '★ Bring this to your endocrinologist to discuss your insulin regimen and afternoon high patterns.',
    40,
    182
  );

  // Group logs by date
  const groupedByDate = new Map<string, UnifiedLogItem[]>();
  logs.forEach((item) => {
    if (!groupedByDate.has(item.log_date)) {
      groupedByDate.set(item.log_date, []);
    }
    groupedByDate.get(item.log_date)!.push(item);
  });

  const sortedDates = Array.from(groupedByDate.keys()).sort();

  // Prepare table data
  const tableRows: (string | { content: string; styles?: object })[][] = [];

  sortedDates.forEach((date) => {
    const dayItems = groupedByDate.get(date)!;
    // Date header row
    tableRows.push([
      {
        content: `Day: ${formatISTDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}`,
        styles: { fillColor: [248, 250, 252], fontStyle: 'bold', textColor: [15, 23, 42] },
      },
      '',
      '',
      '',
      '',
    ]);

    dayItems.forEach((item) => {
      let categoryLabel = item.category.toUpperCase();
      let details = '';
      let feelOrGlucose = '-';
      let note = '';

      if (item.category === 'insulin' && item.insulin) {
        categoryLabel = 'INSULIN';
        details = `${item.insulin.insulin_type === 'morning_regular' ? 'Morning Regular' : 'Night 30/70'}: ${item.insulin.units} U (Taken: ${item.insulin.taken ? 'Yes' : 'No'})`;
        note = item.insulin.note || '';
      } else if (item.category === 'food' && item.food) {
        categoryLabel = `FOOD (${item.food.meal.toUpperCase()})`;
        details = `${item.food.items} ${item.food.carb_size ? `[Carb: ${item.food.carb_size.toUpperCase()}]` : ''}`;
        note = item.food.note || '';
      } else if (item.category === 'activity' && item.activity) {
        categoryLabel = 'ACTIVITY';
        details = `${item.activity.activity_type.toUpperCase()} · ${item.activity.duration_min} min (${item.activity.intensity || 'mod'})`;
        note = item.activity.note || '';
      } else if (item.category === 'feel' && item.feel) {
        categoryLabel = 'FEEL LOG';
        const color = FEEL_COLORS[item.feel.feel];
        feelOrGlucose = `Feel: ${color.label.toUpperCase()}`;
        details = item.feel.symptoms && item.feel.symptoms.length > 0 ? `Symptoms: ${item.feel.symptoms.join(', ')}` : 'No symptoms';
        note = item.feel.note || '';
      } else if (item.category === 'glucose' && item.glucose) {
        categoryLabel = 'GLUCOSE';
        feelOrGlucose = `${item.glucose.reading_mgdl} mg/dL`;
        details = `Context: ${item.glucose.context || 'General'}`;
        note = item.glucose.note || '';
      }

      tableRows.push([
        formatISTTime(item.log_time),
        categoryLabel,
        details,
        feelOrGlucose,
        note,
      ]);
    });
  });

  autoTable(doc, {
    startY: 195,
    head: [['Time', 'Category', 'Details / Food Items', 'Feel / Glucose', 'Notes']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 80 },
      2: { cellWidth: 195 },
      3: { cellWidth: 85 },
      4: { cellWidth: 100 },
    },
    margin: { left: 40, right: 40, bottom: 50 },
    didDrawPage: (data) => {
      // Persistent Disclaimer Footer on every page
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      doc.text(
        `DISCLAIMER: ${MEDICAL_DISCLAIMER}`,
        40,
        pageHeight - 24,
        { maxWidth: 515 }
      );
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Page ${data.pageNumber}`,
        doc.internal.pageSize.width - 70,
        pageHeight - 24
      );
    },
  });

  doc.save(`T1D_Log_Report_${startDate}_to_${endDate}.pdf`);
}
