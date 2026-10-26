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
      const macroStr = item.food.carbs_g != null ? ` [${item.food.carbs_g}g C, ${item.food.protein_g ?? 0}g P, ${item.food.fiber_g ?? 0}g F, ${item.food.sodium_mg ?? 0}mg Na]` : '';
      mainValue = `${item.food.items}${macroStr}`;
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
    `Patient: ${settings.display_name}  |  Age: ${settings.age || 20}  |  Height: ${settings.height_cm} cm  |  Weight: ${settings.weight_kg} kg`,
    40,
    62
  );
  doc.text(
    `Date Range: ${formatISTDate(startDate)} — ${formatISTDate(endDate)}  |  Location: ${settings.city || 'Bangalore'}  |  Timezone: ${settings.timezone || 'Asia/Kolkata'}`,
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
  const morningBrand = settings.morning_insulin_brand || 'Regular (R)';
  const middayBrand = settings.midday_insulin_brand || 'Regular (R)';
  const nightBrand = settings.night_insulin_brand || '30/70 Biphasic';
  const middayText = settings.afternoon_regular_units ? `  |  • Midday: ${settings.afternoon_regular_units} U ${middayBrand}` : '';
  doc.text(
    `• Morning: ${settings.morning_regular_units} U ${morningBrand}  |  • Night: ${settings.night_30_70_units} U ${nightBrand}${middayText}`,
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
  const doctorNoteText = settings.doctor_name
    ? `★ Bring this to ${settings.doctor_name}${settings.clinic_name ? ` (${settings.clinic_name})` : ''} to discuss your insulin regimen and patterns.`
    : '★ Bring this to your endocrinologist to discuss your insulin regimen and afternoon high patterns.';
  doc.text(
    doctorNoteText,
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

  // Report overview
  const categoryCounts = logs.reduce<Record<string, number>>((counts, item) => {
    counts[item.category] = (counts[item.category] || 0) + 1;
    return counts;
  }, {});
  const glucoseReadings = logs
    .filter((item) => item.category === 'glucose' && item.glucose)
    .map((item) => item.glucose!.reading_mgdl);
  const averageGlucose = glucoseReadings.length
    ? Math.round(glucoseReadings.reduce((sum, value) => sum + value, 0) / glucoseReadings.length)
    : null;
  const feelEvents = logs.filter((item) => item.category === 'feel' && item.feel);
  const elevatedFeelEvents = feelEvents.filter(
    (item) => item.feel!.feel === 'slightly_high' || item.feel!.feel === 'high'
  ).length;
  const lowFeelEvents = feelEvents.filter(
    (item) => item.feel!.feel === 'slightly_low' || item.feel!.feel === 'low'
  ).length;

  const pageWidth = doc.internal.pageSize.width;
  const contentWidth = pageWidth - 80;
  const drawMetricCard = (x: number, label: string, value: string, accent: [number, number, number]) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, 208, 118, 52, 5, 5, 'FD');
    doc.setFillColor(...accent);
    doc.roundedRect(x, 208, 4, 52, 2, 2, 'F');
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(label.toUpperCase(), x + 13, 225);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(value, x + 13, 247);
  };

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('CLINICAL OVERVIEW', 40, 201);
  drawMetricCard(40, 'Days logged', `${sortedDates.length}`, [14, 116, 144]);
  drawMetricCard(171, 'Total events', `${logs.length}`, [30, 41, 59]);
  drawMetricCard(302, 'Avg. glucose', averageGlucose ? `${averageGlucose} mg/dL` : 'Not logged', [22, 163, 74]);
  drawMetricCard(433, 'Feel alerts', `${lowFeelEvents + elevatedFeelEvents}`, [217, 119, 6]);

  const observationY = 277;
  doc.setFillColor(240, 249, 250);
  doc.setDrawColor(153, 216, 221);
  doc.roundedRect(40, observationY, contentWidth, 48, 5, 5, 'FD');
  doc.setTextColor(15, 91, 102);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('OBSERVATIONS FOR CLINICIAN REVIEW', 52, observationY + 16);
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const observationText = [
    `${categoryCounts.insulin || 0} insulin doses, ${categoryCounts.food || 0} meals, ${categoryCounts.activity || 0} activity logs, and ${categoryCounts.glucose || 0} glucose readings recorded.`,
    feelEvents.length
      ? `${elevatedFeelEvents} elevated and ${lowFeelEvents} low-feeling events were self-reported.`
      : 'No subjective feel events were recorded in this period.',
  ].join(' ');
  doc.text(observationText, 52, observationY + 32, { maxWidth: contentWidth - 24 });

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
        const typeLabels: Record<string, string> = {
          morning_regular: 'Morning Regular (R)',
          afternoon_regular: 'Midday Regular (R)',
          night_30_70: 'Night 30/70 Biphasic',
          correction: 'Correction Dose',
          other: 'Insulin',
        };
        const label = typeLabels[item.insulin.insulin_type] || 'Insulin';
        details = `${label}: ${item.insulin.units} U (Taken: ${item.insulin.taken ? 'Yes' : 'No'})`;
        note = item.insulin.note || '';
      } else if (item.category === 'food' && item.food) {
        categoryLabel = `FOOD (${item.food.meal.toUpperCase()})`;
        const macroStr = item.food.carbs_g != null ? ` [${item.food.carbs_g}g C, ${item.food.protein_g ?? 0}g P, ${item.food.fiber_g ?? 0}g F, ${item.food.sodium_mg ?? 0}mg Na]` : '';
        details = `${item.food.items} ${item.food.carb_size ? `[Carb: ${item.food.carb_size.toUpperCase()}]` : ''}${macroStr}`;
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

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('DETAILED DAILY RECORD', 40, 347);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.text('A chronological appendix of all events captured during the selected period.', 40, 361);

  autoTable(doc, {
    startY: 372,
    head: [['Time', 'Category', 'Details / Food Items', 'Feel / Glucose', 'Notes']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 91, 102],
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
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.raw && Array.isArray(data.row.raw) && data.row.raw[0] && typeof data.row.raw[0] !== 'string') {
        data.cell.styles.fillColor = [226, 244, 245];
        data.cell.styles.lineColor = [153, 216, 221];
      }
    },
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
