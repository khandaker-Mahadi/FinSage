const Charts = {
  _setupCanvas(canvas, width, height) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return ctx;
  },

  drawDonut(canvas, pct) {
    if (!canvas) return;
    const size = canvas.parentElement?.clientWidth || 180;
    const ctx = this._setupCanvas(canvas, size, size);
    const cx = size / 2, cy = size / 2, radius = size / 2 - 16, lw = size * 0.07;

    ctx.clearRect(0, 0, size, size);

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#e5e7eb';
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.stroke();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const bgColor = isDark ? '#2a2e3d' : '#e5e7eb';
    const dangerColor = '#ef4444';
    const warningColor = '#f59e0b';
    const successColor = '#10b981';

    let fillColor = successColor;
    if (pct > 0.75) fillColor = dangerColor;
    else if (pct > 0.5) fillColor = warningColor;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.strokeStyle = fillColor;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.stroke();
  },

  _drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  },

  drawGroupedBars(canvas, datasets, labels) {
    if (!canvas || !datasets || datasets.length === 0) return;
    const container = canvas.parentElement;
    const width = container?.clientWidth || 400;
    const height = 220;
    const ctx = this._setupCanvas(canvas, width, height);
    const padding = { top: 20, bottom: 30, left: 10, right: 10 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    const maxVal = Math.max(...datasets.flat(), 1);
    const barGroups = datasets.length;
    const groupW = chartW / labels.length;
    const barW = Math.min((groupW * 0.7) / barGroups, 24);
    const gap = (groupW - barW * barGroups) / 2;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#9ca3af' : '#6b7280';

    const colors = ['#10b981', '#ef4444', '#3b82f6'];

    labels.forEach((label, i) => {
      const gx = padding.left + i * groupW;
      datasets.forEach((data, j) => {
        const val = data[i] || 0;
        const barH = (val / maxVal) * chartH;
        const bx = gx + gap + j * barW;
        const by = padding.top + chartH - barH;
        ctx.fillStyle = colors[j % colors.length];
        this._drawRoundedRect(ctx, bx, by, barW - 2, barH, 3);
        ctx.fill();
      });

      ctx.fillStyle = textColor;
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, gx + groupW / 2, height - padding.bottom + 16);
    });
  },

  drawLineChart(canvas, data) {
    if (!canvas || !data || data.length < 2) return;
    const container = canvas.parentElement;
    const width = container?.clientWidth || 400;
    const height = 200;
    const ctx = this._setupCanvas(canvas, width, height);
    const padding = { top: 16, bottom: 24, left: 8, right: 8 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    const values = data.map(d => d.amount);
    const maxVal = Math.max(...values, 1);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const lineColor = isDark ? '#60a5fa' : '#3b82f6';
    const fillColor = isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.08)';
    const textColor = isDark ? '#9ca3af' : '#6b7280';

    const points = data.map((d, i) => ({
      x: padding.left + (i / (data.length - 1)) * chartW,
      y: padding.top + chartH - (d.amount / maxVal) * chartH
    }));

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const cx = (points[i - 1].x + points[i].x) / 2;
      ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, cx, (points[i - 1].y + points[i].y) / 2);
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
    ctx.lineTo(points[0].x, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const cx = (points[i - 1].x + points[i].x) / 2;
      ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, cx, (points[i - 1].y + points[i].y) / 2);
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    if (data.length <= 14) {
      const step = Math.max(1, Math.floor(data.length / 7));
      ctx.fillStyle = textColor;
      ctx.font = '9px Inter, sans-serif';
      ctx.textAlign = 'center';
      data.forEach((d, i) => {
        if (i % step === 0 || i === data.length - 1) {
          const label = d.date.slice(5);
          ctx.fillText(label, points[i].x, height - 4);
        }
      });
    }
  },

  drawCategoryPie(canvas, categoryData) {
    if (!canvas || !categoryData || categoryData.length === 0) return;
    const container = canvas.parentElement;
    const width = container?.clientWidth || 300;
    const size = Math.min(width, 260);
    const ctx = this._setupCanvas(canvas, size, size);
    const cx = size / 2, cy = size / 2, radius = size / 2 - 20;

    ctx.clearRect(0, 0, size, size);

    const total = categoryData.reduce((s, c) => s + c.total, 0);
    if (total === 0) return;

    const catColors = {
      food: '#f97316', transport: '#3b82f6', shopping: '#ec4899',
      bills: '#8b5cf6', education: '#6366f1', healthcare: '#ef4444',
      entertainment: '#f59e0b', rent: '#14b8a6', savings: '#10b981',
      other: '#6b7280'
    };

    let startAngle = -Math.PI / 2;
    categoryData.forEach(cd => {
      const sliceAngle = (cd.total / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = catColors[cd.category] || '#6b7280';
      ctx.fill();
      startAngle += sliceAngle;
    });

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#fff';
    ctx.fill();
  }
};
