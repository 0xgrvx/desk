// Hand-drawn canvas charts, devicePixelRatio aware. No chart library.
const Charts = {
  setup(cv) { const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1; cv.width = r.width * d; cv.height = r.height * d;
    const c = cv.getContext('2d'); c.scale(d, d); return [c, r.width, r.height]; },
  line(cv, pts, start, marks) {
    const [c, w, h] = this.setup(cv); c.clearRect(0, 0, w, h);
    const top = 40, bot = h - 8;
    if (!pts.length) { c.setLineDash([4, 4]); c.strokeStyle = 'rgba(235,235,245,.3)'; c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
      c.setLineDash([]); c.fillStyle = 'rgba(235,235,245,.6)'; c.font = '15px -apple-system'; c.textAlign = 'center'; c.fillText('Waiting for the first trade', w / 2, h / 2 - 12); return; }
    const vs = pts.map(p => p.value).concat([start]); let lo = Math.min(...vs), hi = Math.max(...vs); if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    const t0 = pts[0].ts, t1 = pts[pts.length - 1].ts || t0 + 1;
    const X = t => (t1 === t0 ? w : (t - t0) / (t1 - t0) * w), Y = v => bot - (v - lo) / (hi - lo) * (bot - top);
    c.setLineDash([4, 4]); c.strokeStyle = 'rgba(235,235,245,.3)'; c.beginPath(); c.moveTo(0, Y(start)); c.lineTo(w, Y(start)); c.stroke(); c.setLineDash([]);
    const g = c.createLinearGradient(0, top, 0, bot); g.addColorStop(0, 'rgba(0,211,90,.28)'); g.addColorStop(1, 'rgba(0,211,90,0)');
    c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(X(p.ts), Y(p.value)) : c.moveTo(X(p.ts), Y(p.value)));
    c.strokeStyle = '#00d35a'; c.lineWidth = 2; c.stroke(); c.lineTo(X(t1), bot); c.lineTo(X(t0), bot); c.fillStyle = g; c.fill();
    const rows = []; c.font = '600 12px -apple-system';
    (marks || []).forEach(m => { if (m.ts < t0) return; const x = Math.min(w - 60, Math.max(0, X(m.ts) - 30)), tw = c.measureText(m.text).width + 12;
      let row = 0; while ((rows[row] || []).some(r => x < r[1] && x + tw > r[0])) row++; (rows[row] = rows[row] || []).push([x, x + tw]);
      const y = 4 + row * 20; c.fillStyle = { bought: '#0a84ff', win: '#00d35a', loss: '#ff453a' }[m.kind]; c.beginPath(); c.roundRect(x, y, tw, 18, 9); c.fill();
      c.fillStyle = '#000'; c.textAlign = 'left'; c.fillText(m.text, x + 6, y + 13); });
  },
  candles(cv, cs, line) {
    const [c, w, h] = this.setup(cv); c.clearRect(0, 0, w, h); if (!cs.length) { c.fillStyle = 'rgba(235,235,245,.6)'; c.font = '15px -apple-system'; c.textAlign = 'center'; c.fillText('No candles yet', w / 2, h / 2); return; }
    const vh = h * .2, ph = h - vh - 6; let lo = Math.min(...cs.map(k => k.l)), hi = Math.max(...cs.map(k => k.h)); if (line) { lo = Math.min(lo, line); hi = Math.max(hi, line); }
    if (hi - lo < 1e-12) { hi *= 1.01; lo *= .99; } const Y = v => ph - (v - lo) / (hi - lo) * ph, bw = w / Math.max(cs.length, 20), mv = Math.max(...cs.map(k => k.v), 1);
    cs.forEach((k, i) => { const x = i * bw + bw / 2, col = k.c >= k.o ? '#00d35a' : '#ff453a'; c.strokeStyle = c.fillStyle = col;
      c.beginPath(); c.moveTo(x, Y(k.h)); c.lineTo(x, Y(k.l)); c.stroke(); c.fillRect(x - bw * .35, Math.min(Y(k.o), Y(k.c)), bw * .7, Math.max(1, Math.abs(Y(k.o) - Y(k.c))));
      c.globalAlpha = .4; c.fillRect(x - bw * .35, h - k.v / mv * vh, bw * .7, k.v / mv * vh); c.globalAlpha = 1; });
    if (line) { c.setLineDash([5, 4]); c.strokeStyle = '#ff9f0a'; c.beginPath(); c.moveTo(0, Y(line)); c.lineTo(w, Y(line)); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#ff9f0a'; c.font = '12px -apple-system'; c.fillText('Risk trailing stop', 4, Y(line) - 4); }
  },
  ring(cv, score) { const [c, w, h] = this.setup(cv), r = Math.min(w, h) / 2 - 8; c.lineWidth = 10; c.strokeStyle = '#2c2c2e'; c.beginPath(); c.arc(w / 2, h / 2, r, 0, 7); c.stroke();
    if (score != null) { c.strokeStyle = score >= (window.MINSCORE || 70) ? '#00d35a' : '#ff9f0a'; c.lineCap = 'round'; c.beginPath(); c.arc(w / 2, h / 2, r, -Math.PI / 2, -Math.PI / 2 + score / 100 * Math.PI * 2); c.stroke(); }
    c.fillStyle = '#fff'; c.font = '700 30px -apple-system'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(score == null ? '–' : score, w / 2, h / 2); }
};
