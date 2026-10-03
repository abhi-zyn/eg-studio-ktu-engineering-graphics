/* =====================================================================
   exporter.js — export the current drawing as PNG or PDF, plus reset.
   PNG: rasterise the 2D SVG (and optionally the 3D canvas) to a canvas.
   PDF: use jsPDF (vendored UMD) to place the rasterised image.
   ===================================================================== */
const Exporter = (function () {
  // Rasterise an <svg> element to a canvas at a target pixel width.
  function svgToCanvas(svg, pxWidth = 1600) {
    return new Promise((resolve, reject) => {
      const vb = svg.viewBox.baseVal;
      const ratio = vb.height / vb.width;
      const w = pxWidth, h = Math.round(pxWidth * ratio);
      const data = Svg2D.toSVGString(svg);
      const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url); resolve(c);
      };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  function downloadCanvas(canvas, filename) {
    canvas.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    }, 'image/png');
  }

  async function exportPNG(svg, filename = 'drawing.png') {
    if (!svg) return;
    const c = await svgToCanvas(svg);
    downloadCanvas(c, filename);
  }

  async function exportPDF(svg, title = 'Engineering Graphics', filename = 'drawing.pdf') {
    if (!svg) return;
    const c = await svgToCanvas(svg, 2000);
    const { jsPDF } = window.jspdf;
    const landscape = c.width >= c.height;
    const pdf = new jsPDF({ orientation: landscape ? 'l' : 'p', unit: 'mm', format: 'a4' });
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
    const margin = 12;
    pdf.setFontSize(13); pdf.text(title, margin, margin);
    const availW = pw - margin * 2, availH = ph - margin * 2 - 6;
    const ir = c.height / c.width;
    let iw = availW, ih = iw * ir;
    if (ih > availH) { ih = availH; iw = ih / ir; }
    pdf.addImage(c.toDataURL('image/png'), 'PNG', margin, margin + 4, iw, ih);
    pdf.setFontSize(8); pdf.setTextColor(120);
    pdf.text('Generated with EG Studio — KTU Engineering Graphics (First-angle projection)', margin, ph - 6);
    pdf.save(filename);
  }

  return { exportPNG, exportPDF, svgToCanvas };
})();
if (typeof window !== 'undefined') window.Exporter = Exporter;
