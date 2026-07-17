// Export selected analytics charts to a downloadable PDF. Each chart's DOM node
// is rasterised with html2canvas and placed on its own landscape page under a
// project/title header. jspdf + html2canvas are heavy (~150 kB gzip), so they're
// dynamically imported here — the main bundle stays lean and they only load when
// the user actually exports.

export interface ChartSection {
  title: string;
  el: HTMLElement;
}

export async function exportChartsPdf(
  sections: ChartSection[],
  opts: { fileName: string; heading: string; subheading?: string },
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 32;

  for (let i = 0; i < sections.length; i += 1) {
    const { title, el } = sections[i];
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false });
    const img = canvas.toDataURL('image/png');

    if (i > 0) pdf.addPage();

    pdf.setTextColor(17, 24, 39);
    pdf.setFontSize(15);
    pdf.text(opts.heading, margin, margin + 4);
    if (opts.subheading) {
      pdf.setFontSize(10);
      pdf.setTextColor(107, 114, 128);
      pdf.text(opts.subheading, margin, margin + 20);
    }
    pdf.setFontSize(12);
    pdf.setTextColor(17, 24, 39);
    pdf.text(title, margin, margin + 40);

    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2 - 52;
    const ratio = Math.min(availW / canvas.width, availH / canvas.height);
    const w = canvas.width * ratio;
    const h = canvas.height * ratio;
    pdf.addImage(img, 'PNG', margin, margin + 52, w, h);
  }

  pdf.save(opts.fileName);
}
