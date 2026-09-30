/*
 * app.js
 * UI layer for the SaaS Executive Dashboard. Reads everything from SaaSData.build().
 * Tabs render lazily the first time they are opened.
 */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const seed = parseInt(params.get('seed') || '20260930', 10) || 20260930;
  const D = window.SaaSData.build(seed);
  const M = D.m;
  const N = D.N;
  const L = D.labels;
  const L12 = L.slice(-12);

  const C = { blue: '#2f6fed', teal: '#12a594', amber: '#f5a524', red: '#e5484d', purple: '#8e4ec6', gray: '#7b8797', green: '#30a46c' };
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const last = (a) => a[a.length - 1];
  const s12 = (a) => a.slice(-12);

  const money = (v, d = 1) => {
    const a = Math.abs(v), s = v < 0 ? '-' : '';
    if (a >= 1e9) return s + '$' + (a / 1e9).toFixed(d) + 'B';
    if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(d) + 'M';
    if (a >= 1e3) return s + '$' + (a / 1e3).toFixed(0) + 'K';
    return s + '$' + Math.round(a);
  };
  const pc = (v, d = 1) => (v * 100).toFixed(d) + '%';
  const num = (v) => Math.round(v).toLocaleString('en-US');

  /* ---------- status and delta helpers ---------- */
  function st(v, good, watch, higher) {
    if (higher === false) return v <= good ? 'good' : v <= watch ? 'watch' : 'risk';
    return v >= good ? 'good' : v >= watch ? 'watch' : 'risk';
  }
  function dpts(cur, prev, unit, higher, span) {
    const d = cur - prev;
    return {
      delta: (d >= 0 ? '▲ ' : '▼ ') + Math.abs(d).toFixed(1) + ' ' + (unit || 'pts') + ' vs ' + (span || '3 mo ago'),
      deltaGood: higher === false ? d <= 0 : d >= 0
    };
  }
  const STATUS_TEXT = { good: 'On track', watch: 'Watch', risk: 'At risk' };

  function kpi(o) {
    const chip = o.status ? '<span class="chip ' + o.status + '">' + STATUS_TEXT[o.status] + '</span>' : '';
    const d = o.delta ? '<div class="delta ' + (o.deltaGood === true ? 'good' : o.deltaGood === false ? 'bad' : '') + '">' + o.delta + '</div>' : '';
    return '<div class="kpi"><div class="kpi-top"><span class="kpi-label">' + o.label + '</span>' + chip + '</div>' +
      '<div class="kpi-value">' + o.value + '</div>' + d + (o.sub ? '<div class="kpi-sub">' + o.sub + '</div>' : '') + '</div>';
  }
  const kpis = (arr) => '<section class="kpis">' + arr.map(kpi).join('') + '</section>';
  const panel = (id, title, sub, h) =>
    '<section class="panel"><h3>' + title + '</h3>' + (sub ? '<p class="sub">' + sub + '</p>' : '') +
    '<div class="chart" style="height:' + (h || 280) + 'px"><canvas id="' + id + '" role="img" aria-label="' + title + '"></canvas></div></section>';
  const box = (title, sub, inner) =>
    '<section class="panel"><h3>' + title + '</h3>' + (sub ? '<p class="sub">' + sub + '</p>' : '') + inner + '</section>';
  const grid = (...p) => '<div class="grid">' + p.join('') + '</div>';

  function table(head, rows, align) {
    const a = align || '';
    const cls = (i) => (a[i] === 'r' ? ' class="r"' : '');
    return '<div class="tablewrap"><table><thead><tr>' + head.map((h, i) => '<th' + cls(i) + '>' + h + '</th>').join('') +
      '</tr></thead><tbody>' + rows.map((r) => '<tr>' + r.map((c, i) => '<td' + cls(i) + '>' + c + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div>';
  }

  /* ---------- chart helpers ---------- */
  let charts = [];
  function theme() {
    const cs = getComputedStyle(document.documentElement);
    const g = (n) => cs.getPropertyValue(n).trim();
    Chart.defaults.color = g('--muted');
    Chart.defaults.borderColor = g('--line');
    Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    Chart.defaults.font.size = 12;
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
  }
  const ds = (label, data, color, extra) => Object.assign({ label, data, borderColor: color, backgroundColor: color, tension: 0.3, pointRadius: 0, borderWidth: 2 }, extra || {});
  const bs = (label, data, color, extra) => Object.assign({ label, data, backgroundColor: color, borderRadius: 3 }, extra || {});

  function mk(id, type, labels, datasets, o) {
    o = o || {};
    const horiz = o.indexAxis === 'y';
    const vfmt = o.fmt || ((v) => v);
    const vAxis = { ticks: { callback: vfmt }, grid: {} };
    if (o.min !== undefined) vAxis.min = o.min;
    if (o.max !== undefined) vAxis.max = o.max;
    const cAxis = { grid: { display: false } };
    if (o.stacked) { vAxis.stacked = true; cAxis.stacked = true; }
    const scales = horiz ? { x: vAxis, y: cAxis } : { x: cAxis, y: vAxis };
    Object.assign(scales, o.scales || {});
    const cfg = {
      type: type,
      data: { labels: labels, datasets: datasets },
      options: {
        indexAxis: o.indexAxis || 'x',
        interaction: { mode: horiz ? 'nearest' : 'index', intersect: false },
        plugins: {
          legend: { display: o.legend !== undefined ? o.legend : datasets.length > 1, position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (c) => {
                const v = horiz ? c.parsed.x : c.parsed.y;
                const f = c.dataset.fmt || vfmt;
                return (c.dataset.label ? c.dataset.label + ': ' : '') + f(v);
              }
            }
          }
        },
        scales: scales
      }
    };
    if (o.mod) o.mod(cfg);
    const ch = new Chart(document.getElementById(id), cfg);
    charts.push(ch);
    return ch;
  }

  function donut(id, labels, data, colors, fmt) {
    const ch = new Chart(document.getElementById(id), {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        cutout: '62%',
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { callbacks: { label: (c) => c.label + ': ' + fmt(c.parsed) } }
        }
      }
    });
    charts.push(ch);
  }

  const right = (fmt, title) => ({ position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: fmt }, title: title ? { display: true, text: title } : undefined });

  /* =========================================================
     TAB: Overview
     ========================================================= */
  function headlineKpis() {
    const n = D.nrrT.length;
    const nrr = last(D.nrrT) * 100, nrr3 = D.nrrT[n - 4] * 100;
    const grr = last(D.grrT) * 100, grr3 = D.grrT[n - 4] * 100;
    const nps = last(D.nps), nps3 = D.nps[8];
    return [
      { label: 'ARR', value: money(last(D.arr)), delta: '▲ ' + pc(M.arrGrowth) + ' YoY', deltaGood: true, sub: 'Annual recurring revenue' },
      Object.assign({ label: 'Net revenue retention', value: nrr.toFixed(1) + '%', status: st(nrr, 100, 95), sub: 'Target 100% or higher', target: 'target 100% or higher' }, dpts(nrr, nrr3)),
      Object.assign({ label: 'Gross revenue retention', value: grr.toFixed(1) + '%', status: st(grr, 90, 82), sub: 'Target 90% or higher', target: 'target 90% or higher' }, dpts(grr, grr3)),
      { label: 'Pipeline coverage', value: M.coverage.toFixed(1) + 'x', status: st(M.coverage, 3, 2.5), sub: 'Target 3.0x or higher', target: 'target 3.0x or higher', delta: 'vs next quarter target', deltaGood: null },
      { label: 'CAC payback', value: M.paybackM.toFixed(1) + ' mo', status: st(M.paybackM, 18, 24, false), sub: 'Target 18 months or less', target: 'target 18 months or less' },
      { label: 'Burn multiple', value: M.burnMult.toFixed(2) + 'x', status: st(M.burnMult, 1.5, 2.5, false), sub: 'Target 1.5x or less', target: 'target 1.5x or less' },
      Object.assign({ label: 'NPS', value: last(D.nps).toFixed(0), status: st(last(D.nps), 40, 25), sub: 'Target 40 or higher', target: 'target 40 or higher' }, dpts(nps, nps3, 'pts')),
      { label: 'Cash runway', value: M.runway.toFixed(0) + ' mo', status: st(M.runway, 24, 12), sub: 'Cash ' + money(last(D.cash)) + ', target 24 months or more', target: 'target 24 months or more' }
    ];
  }

  function overview(el) {
    const k = headlineKpis();
    const flagged = k.filter((x) => x.status && x.status !== 'good');
    const ok = k.filter((x) => x.status === 'good');
    const li = (x) => '<li><span class="chip ' + x.status + '">' + STATUS_TEXT[x.status] + '</span><span><strong>' + x.label + ' ' + x.value + '</strong> (' + x.target + ')</span></li>';
    el.innerHTML = kpis(k) +
      grid(
        panel('ov-arr', 'ARR trend', 'Month-end annual recurring revenue', 280),
        panel('ov-ret', 'Net and gross revenue retention', 'Trailing 12 months', 280)
      ) +
      grid(
        panel('ov-nn', 'Net new ARR by driver', 'Last 12 months, annualized', 280),
        box('Needs attention', 'Headline KPIs outside target',
          flagged.length ? '<ul class="flags">' + flagged.map(li).join('') + '</ul>' : '<p class="sub">All headline KPIs are on target.</p>') +
        box('On track', 'Headline KPIs inside target', ok.length ? '<ul class="flags">' + ok.map(li).join('') + '</ul>' : '<p class="sub">None right now.</p>')
      );
    mk('ov-arr', 'line', L, [ds('ARR', D.arr, C.blue, { fill: true, backgroundColor: 'rgba(47,111,237,0.12)' })], { fmt: (v) => money(v), legend: false });
    const rl = L.slice(11);
    mk('ov-ret', 'line', rl, [
      ds('NRR', D.nrrT.map((v) => v * 100), C.blue),
      ds('GRR', D.grrT.map((v) => v * 100), C.teal)
    ], { fmt: (v) => v.toFixed(0) + '%', min: 75 });
    const neg = (a) => s12(a).map((v) => -v * 12);
    mk('ov-nn', 'bar', L12, [
      bs('New', s12(D.newM).map((v) => v * 12), C.blue),
      bs('Expansion', s12(D.expM).map((v) => v * 12), C.teal),
      bs('Contraction', neg(D.conM), C.amber),
      bs('Churn', neg(D.chnM), C.red)
    ], { stacked: true, fmt: (v) => money(v) });
  }

  /* =========================================================
     TAB: Revenue & growth
     ========================================================= */
  function revenue(el) {
    const q0 = N - 4; // month index at end of prior quarter (Jun '26)
    const S = D.arr[q0], E = D.arr[N - 1];
    const qs = (a) => sum(a.slice(-3)) * 12;
    const n = qs(D.newM), e = qs(D.expM), c = qs(D.conM), x = qs(D.chnM);
    const vsPlan = D.arr[N - 1] / (D.planArr[11]) - 1;
    const segRows = Object.keys(D.seg).map((k) => {
      const a = D.seg[k];
      return [k, money(last(a)), pc(last(a) / last(D.arr), 0), pc(last(a) / a[N - 13] - 1, 0)];
    });

    el.innerHTML = kpis([
      { label: 'ARR', value: money(E), delta: '▲ ' + pc(M.arrGrowth) + ' YoY', deltaGood: true },
      { label: 'Net new ARR (quarter)', value: money(E - S), sub: 'New + expansion - contraction - churn' },
      { label: 'MRR', value: money(last(D.mrr), 2), sub: 'Month-end' },
      { label: 'Bookings (quarter)', value: money(last(D.bookingsQ)), sub: 'New + expansion ARR' },
      { label: 'ARR vs plan', value: (vsPlan >= 0 ? '+' : '') + pc(vsPlan), status: st(vsPlan, -0.02, -0.06), sub: 'Plan assumes 2.75% monthly growth' }
    ]) +
      grid(
        panel('rv-wf', 'ARR bridge, last quarter', 'Starting ARR to ending ARR by driver', 300),
        panel('rv-fc', 'ARR: actual vs plan, with 3-month forecast', 'Forecast extends the last 6 months of growth', 300)
      ) +
      grid(
        panel('rv-seg', 'ARR by segment', 'Month-end, last 12 months', 280),
        panel('rv-bk', 'Bookings by quarter', 'New + expansion ARR', 280)
      ) +
      grid(
        panel('rv-reg', 'ARR by region', 'Share of current ARR', 280),
        box('Segment summary', 'Current ARR and year-over-year growth', table(['Segment', 'ARR', 'Share', 'YoY'], segRows, 'lrrr'))
      );

    const lo = Math.floor((S * 0.92) / 1e6) * 1e6;
    const steps = [[0, S], [S, S + n], [S + n, S + n + e], [S + n + e - c, S + n + e], [S + n + e - c - x, S + n + e - c], [0, E]];
    mk('rv-wf', 'bar', ["Start ARR", 'New', 'Expansion', 'Contraction', 'Churn', 'End ARR'], [{
      label: 'ARR', data: steps, borderRadius: 3,
      backgroundColor: [C.gray, C.blue, C.teal, C.amber, C.red, C.gray]
    }], {
      legend: false, min: lo, fmt: (v) => money(v),
      mod: (cfg) => {
        cfg.options.plugins.tooltip.callbacks.label = (ctx) => {
          const r = ctx.raw;
          return ctx.dataIndex === 0 || ctx.dataIndex === 5 ? money(r[1], 2) : money(r[1] - r[0], 2);
        };
      }
    });

    const fl = L12.concat(D.nextLabels);
    const pad = (n0) => Array(n0).fill(null);
    mk('rv-fc', 'line', fl, [
      ds('Actual', s12(D.arr).concat(pad(3)), C.blue),
      ds('Plan', D.planArr, C.gray, { borderDash: [6, 4] }),
      ds('Forecast', pad(11).concat([last(D.arr)], D.fcstArr), C.teal, { borderDash: [2, 3] })
    ], { fmt: (v) => money(v) });

    mk('rv-seg', 'bar', L12, [
      bs('Enterprise', s12(D.seg.Enterprise), C.blue),
      bs('Mid-Market', s12(D.seg['Mid-Market']), C.teal),
      bs('SMB', s12(D.seg.SMB), C.amber)
    ], { stacked: true, fmt: (v) => money(v) });

    mk('rv-bk', 'bar', D.qLabels, [bs('Bookings', D.bookingsQ, C.blue)], { legend: false, fmt: (v) => money(v) });
    donut('rv-reg', D.regionNames, D.regionShare.map((s) => s * E), [C.blue, C.teal, C.amber, C.purple], (v) => money(v));
  }

  /* =========================================================
     TAB: Retention & health
     ========================================================= */
  function retention(el) {
    const nrr = last(D.nrrT) * 100, grr = last(D.grrT) * 100;
    const nrrSeg = { Enterprise: nrr + 6, 'Mid-Market': nrr - 1, SMB: nrr - 11 };
    const grrSeg = { Enterprise: grr + 5, 'Mid-Market': grr, SMB: grr - 9 };
    const nextQ = D.renewals[0];
    const rows = D.atRiskAccounts.map((a) => [a.name, a.segment, money(a.arr, 2), a.renewal, String(a.score), a.driver]);

    el.innerHTML = kpis([
      { label: 'Net revenue retention', value: nrr.toFixed(1) + '%', status: st(nrr, 100, 95), sub: 'Trailing 12 months' },
      { label: 'Gross revenue retention', value: grr.toFixed(1) + '%', status: st(grr, 90, 82), sub: 'Trailing 12 months' },
      { label: 'Logo churn', value: pc(last(D.logoT)), status: st(last(D.logoT), 0.08, 0.12, false), sub: 'Trailing 12 months' },
      { label: 'At-risk ARR', value: money(M.atRiskArr), status: st(M.atRiskArr / last(D.arr), 0.10, 0.15, false), sub: pc(M.atRiskArr / last(D.arr), 0) + ' of ARR in red accounts' },
      { label: 'Renewing next quarter', value: money(nextQ.total), sub: pc(nextQ.committed / nextQ.total, 0) + ' committed' }
    ]) +
      grid(
        panel('rt-tr', 'NRR and GRR trend', 'Trailing 12 months', 280),
        panel('rt-seg', 'Retention by segment', 'Enterprise retains and expands best', 280)
      ) +
      grid(
        panel('rt-hl', 'ARR by health bucket', 'Customer health score, current ARR', 280),
        panel('rt-rn', 'Renewal forecast', 'Next four quarters by confidence', 280)
      ) +
      grid(
        panel('rt-co', 'Cohort net dollar retention', 'Indexed to 100 at signing, by signing quarter', 300),
        box('Top at-risk accounts', 'Fictional accounts, sorted by ARR',
          table(['Account', 'Segment', 'ARR', 'Renewal', 'Health', 'Risk driver'], rows, 'llrrrl'))
      );

    mk('rt-tr', 'line', L.slice(11), [
      ds('NRR', D.nrrT.map((v) => v * 100), C.blue),
      ds('GRR', D.grrT.map((v) => v * 100), C.teal)
    ], { fmt: (v) => v.toFixed(0) + '%', min: 75 });
    const sk = Object.keys(nrrSeg);
    mk('rt-seg', 'bar', sk, [
      bs('NRR', sk.map((k) => nrrSeg[k]), C.blue),
      bs('GRR', sk.map((k) => grrSeg[k]), C.teal)
    ], { fmt: (v) => v.toFixed(0) + '%', min: 60 });
    donut('rt-hl', D.healthLabels, D.healthArr, [C.green, C.amber, C.red], (v) => money(v));
    mk('rt-rn', 'bar', D.renewQLabels, [
      bs('Committed', D.renewals.map((r) => r.committed), C.teal),
      bs('Likely', D.renewals.map((r) => r.likely), C.amber),
      bs('At risk', D.renewals.map((r) => r.atRisk), C.red)
    ], { stacked: true, fmt: (v) => money(v) });
    const maxLen = Math.max.apply(null, D.cohorts.map((c) => c.points.length));
    const palette = [C.blue, C.teal, C.amber, C.purple, C.red, C.gray];
    mk('rt-co', 'line', Array.from({ length: maxLen }, (_, i) => 'Q+' + i),
      D.cohorts.map((c, i) => ds(c.name, c.points, palette[i], { spanGaps: false })),
      { fmt: (v) => v.toFixed(0), min: 80 });
  }

  /* =========================================================
     TAB: Sales & go-to-market
     ========================================================= */
  function sales(el) {
    const wr = last(D.winRateQ);
    const f = D.funnel;
    const frows = f.map((x, i) => [x.name, num(x.n), x.conv === null ? '' : pc(x.conv, 0), i === 0 ? '' : pc(x.n / f[0].n, 1)]);
    el.innerHTML = kpis([
      { label: 'Pipeline coverage', value: M.coverage.toFixed(1) + 'x', status: st(M.coverage, 3, 2.5), sub: 'Pipeline ' + money(sum(D.pipeline)) + ' vs target ' + money(M.nextTarget) },
      Object.assign({ label: 'Win rate', value: pc(wr, 0), sub: 'Opportunities to closed won' }, dpts(wr * 100, D.winRateQ[6] * 100, 'pts', true, 'last quarter')),
      { label: 'Avg new-logo deal', value: money(last(D.newAcv)), sub: 'Annual contract value' },
      { label: 'Sales cycle', value: Math.round(last(D.salesCycle)) + ' days', delta: '▲ ' + Math.round(last(D.salesCycle) - D.salesCycle[0]) + ' days vs 12 mo ago', deltaGood: false },
      { label: 'CAC (new logo)', value: money(M.cacLogo), sub: 'Fully loaded, trailing 12 months' },
      { label: 'CAC payback', value: M.paybackM.toFixed(1) + ' mo', status: st(M.paybackM, 18, 24, false), sub: 'Target 18 months or less' },
      { label: 'Quota attainment', value: pc(M.teamAttain, 0), status: st(M.teamAttain, 0.95, 0.80), sub: 'AE team average' }
    ]) +
      grid(
        panel('sl-pl', 'Pipeline by stage', 'Open pipeline against next quarter target', 290),
        box('Marketing funnel, last quarter', 'Stage volumes and conversion',
          table(['Stage', 'Volume', 'Stage conv.', 'Of leads'], frows, 'lrrr'))
      ) +
      grid(
        panel('sl-wr', 'Win rate by quarter', 'Closed won / opportunities', 260),
        panel('sl-dc', 'Deal size and sales cycle', 'Last 12 months', 260)
      ) +
      grid(panel('sl-qa', 'Quota attainment by AE', 'Dashed line marks 100% of quota', 280));

    mk('sl-pl', 'bar', D.stageNames, [bs('Pipeline', D.pipeline, C.blue)], { indexAxis: 'y', legend: false, fmt: (v) => money(v) });
    mk('sl-wr', 'bar', D.qLabels, [bs('Win rate', D.winRateQ.map((v) => v * 100), C.teal)], { legend: false, fmt: (v) => v.toFixed(0) + '%', min: 0 });
    mk('sl-dc', 'line', L12, [
      ds('Avg deal size', s12(D.newAcv), C.blue, { fmt: (v) => money(v) }),
      ds('Sales cycle (days)', D.salesCycle, C.amber, { yAxisID: 'y1', fmt: (v) => v.toFixed(0) + ' days' })
    ], { fmt: (v) => money(v), scales: { y1: right((v) => v + 'd') } });
    mk('sl-qa', 'bar', D.reps.map((r) => r.name), [
      bs('Attainment', D.reps.map((r) => r.att * 100), C.blue),
      { type: 'line', label: 'Quota', data: D.reps.map(() => 100), borderColor: C.red, borderDash: [6, 4], pointRadius: 0, borderWidth: 1.5 }
    ], { fmt: (v) => v.toFixed(0) + '%', legend: false, min: 0 });
  }

  /* =========================================================
     TAB: Unit economics
     ========================================================= */
  function unit(el) {
    const r40 = M.ruleOf40 * 100;
    const nrows = [
      ['ARPA (annual revenue per account)', money(M.arpa, 1)],
      ['Gross margin (trailing 12 months)', pc(M.gmT)],
      ['Annual dollar churn (1 - GRR)', pc(1 - last(D.grrT))],
      ['LTV = ARPA x GM / churn', money(M.ltv)],
      ['CAC (new logo, fully loaded)', money(M.cacLogo)],
      ['LTV : CAC', M.ltvCac.toFixed(1) + 'x']
    ];
    el.innerHTML = kpis([
      { label: 'LTV : CAC', value: M.ltvCac.toFixed(1) + 'x', status: st(M.ltvCac, 3, 2), sub: 'Target 3x or higher' },
      { label: 'CAC payback', value: M.paybackM.toFixed(1) + ' mo', status: st(M.paybackM, 18, 24, false), sub: 'Target 18 months or less' },
      { label: 'Gross margin', value: pc(M.gmT), status: st(M.gmT, 0.75, 0.68), sub: 'Target 75% or higher' },
      { label: 'Burn multiple', value: M.burnMult.toFixed(2) + 'x', status: st(M.burnMult, 1.5, 2.5, false), sub: 'Net burn / net new ARR' },
      { label: 'Rule of 40', value: r40.toFixed(0), status: st(r40, 40, 20), sub: 'ARR growth + FCF margin' },
      { label: 'Magic number', value: M.magic.toFixed(2), status: st(M.magic, 0.7, 0.5), sub: 'Target 0.7 or higher' },
      { label: 'Cash runway', value: M.runway.toFixed(0) + ' mo', status: st(M.runway, 24, 12) }
    ]) +
      grid(
        panel('ue-gm', 'Gross and contribution margin', 'Contribution = gross profit less sales and marketing', 280),
        panel('ue-bm', 'Burn multiple by quarter', 'Lower is better', 280)
      ) +
      grid(
        panel('ue-r40', 'Rule of 40', 'Trailing 12 months: ARR growth + FCF margin', 280),
        panel('ue-mg', 'Magic number by quarter', 'Annualized revenue growth / prior quarter S&M', 280)
      ) +
      grid(
        panel('ue-cash', 'Net burn and cash balance', 'Monthly', 280),
        box('LTV : CAC build', 'How the headline ratio is calculated', table(['Input', 'Value'], nrows, 'lr'))
      );

    const pct = (v) => (v * 100).toFixed(0) + '%';
    mk('ue-gm', 'line', L, [ds('Gross margin', D.gm.map((v) => v * 100), C.blue), ds('Contribution margin', D.contribMargin.map((v) => v * 100), C.teal)], { fmt: (v) => v.toFixed(0) + '%' });
    mk('ue-bm', 'bar', D.qLabels, [bs('Burn multiple', D.burnMultQ, C.amber)], { legend: false, fmt: (v) => v.toFixed(1) + 'x' });
    mk('ue-r40', 'line', L.slice(12), [
      ds('Rule of 40 score', D.rule40.map((r) => r.score * 100), C.blue),
      ds('ARR growth', D.rule40.map((r) => r.growth * 100), C.teal),
      ds('FCF margin', D.rule40.map((r) => r.margin * 100), C.red)
    ], { fmt: (v) => v.toFixed(0) });
    mk('ue-mg', 'bar', D.qLabels.slice(1), [bs('Magic number', D.magicQ.slice(1), C.purple)], { legend: false, fmt: (v) => v.toFixed(2) });
    mk('ue-cash', 'bar', L, [
      bs('Net burn', D.burn, C.red, { fmt: (v) => money(v, 2) }),
      { type: 'line', label: 'Cash', data: D.cash, borderColor: C.blue, backgroundColor: C.blue, yAxisID: 'y1', pointRadius: 0, tension: 0.3, borderWidth: 2, fmt: (v) => money(v) }
    ], { fmt: (v) => money(v), scales: { y1: right((v) => money(v)) } });
    void pct;
  }

  /* =========================================================
     TAB: Customer success & support
     ========================================================= */
  function cs(el) {
    const sp = D.sponsor;
    el.innerHTML = kpis([
      Object.assign({ label: 'NPS', value: last(D.nps).toFixed(0), status: st(last(D.nps), 40, 25) }, dpts(last(D.nps), D.nps[0], 'pts', true, '12 mo ago')),
      Object.assign({ label: 'CSAT', value: last(D.csat).toFixed(0) + '%' }, dpts(last(D.csat), D.csat[0], 'pts', true, '12 mo ago')),
      Object.assign({ label: 'Time to value', value: Math.round(last(D.ttv)) + ' days' }, dpts(last(D.ttv), D.ttv[0], 'days', false, '12 mo ago')),
      Object.assign({ label: 'Onboarding completion', value: last(D.onboardDone).toFixed(0) + '%' }, dpts(last(D.onboardDone), D.onboardDone[0], 'pts', true, '12 mo ago')),
      { label: 'Ticket backlog', value: num(last(D.backlog)), status: st(last(D.backlog), 150, 250, false), sub: 'Open tickets' },
      { label: 'First response', value: last(D.frt).toFixed(1) + ' hrs', status: st(last(D.frt), 4, 8, false), sub: 'Target 4 hours or less' }
    ]) +
      grid(
        panel('cs-nps', 'NPS and CSAT', 'Last 12 months', 260),
        panel('cs-ttv', 'Time to value and onboarding completion', 'Faster onboarding, higher completion', 260)
      ) +
      grid(
        panel('cs-tk', 'Ticket volume and backlog', 'Monthly tickets opened and open backlog', 260),
        panel('cs-rt', 'Response and resolution time', 'Hours, last 12 months', 260)
      ) +
      grid(
        panel('cs-es', 'Escalation rate', 'Share of tickets escalated', 260),
        panel('cs-sp', 'Executive sponsor coverage', 'Share of accounts with an engaged sponsor', 260)
      ) +
      grid(panel('cs-ex', 'Expansion pipeline by quarter', 'Identified expansion opportunity, by type', 280));

    mk('cs-nps', 'line', L12, [
      ds('NPS', D.nps, C.blue, { fmt: (v) => v.toFixed(0) }),
      ds('CSAT (%)', D.csat, C.teal, { yAxisID: 'y1', fmt: (v) => v.toFixed(0) + '%' })
    ], { fmt: (v) => v.toFixed(0), scales: { y1: right((v) => v + '%') } });
    mk('cs-ttv', 'line', L12, [
      ds('Time to value (days)', D.ttv, C.amber, { fmt: (v) => v.toFixed(0) + ' days' }),
      ds('Onboarding completion (%)', D.onboardDone, C.teal, { yAxisID: 'y1', fmt: (v) => v.toFixed(0) + '%' })
    ], { fmt: (v) => v.toFixed(0), scales: { y1: right((v) => v + '%') } });
    mk('cs-tk', 'bar', L12, [
      bs('Tickets', D.tickets, C.blue, { fmt: (v) => num(v) }),
      { type: 'line', label: 'Backlog', data: D.backlog, borderColor: C.red, backgroundColor: C.red, yAxisID: 'y1', pointRadius: 0, tension: 0.3, borderWidth: 2, fmt: (v) => num(v) }
    ], { fmt: (v) => num(v), scales: { y1: right((v) => num(v)) } });
    mk('cs-rt', 'line', L12, [
      ds('First response', D.frt, C.teal, { fmt: (v) => v.toFixed(1) + ' hrs' }),
      ds('Resolution', D.resolution, C.purple, { yAxisID: 'y1', fmt: (v) => v.toFixed(0) + ' hrs' })
    ], { fmt: (v) => v.toFixed(1), scales: { y1: right((v) => v.toFixed(0)) } });
    mk('cs-es', 'line', L12, [ds('Escalation rate', D.escalations, C.red)], { legend: false, fmt: (v) => v.toFixed(1) + '%', min: 0 });
    const sk = Object.keys(sp);
    mk('cs-sp', 'bar', sk, [bs('Coverage', sk.map((k) => sp[k] * 100), C.blue)], { legend: false, fmt: (v) => v.toFixed(0) + '%', min: 0, max: 100 });
    mk('cs-ex', 'bar', D.qLabels, [
      bs('Seat and usage upsell', D.expansionPipe.map((p) => p.upsell), C.blue),
      bs('Cross-sell', D.expansionPipe.map((p) => p.cross), C.teal),
      bs('New department', D.expansionPipe.map((p) => p.newDept), C.amber)
    ], { stacked: true, fmt: (v) => money(v) });
  }

  /* =========================================================
     TAB: Product & usage
     ========================================================= */
  function product(el) {
    el.innerHTML = kpis([
      { label: 'DAU / MAU', value: pc(last(D.stick), 0), status: st(last(D.stick), 0.30, 0.20), sub: 'Stickiness, target 30% or higher' },
      { label: 'Daily active users', value: num(last(D.dau)) },
      { label: 'Monthly active users', value: num(last(D.mau)) },
      Object.assign({ label: 'Activation rate', value: last(D.activation).toFixed(0) + '%', sub: 'New accounts reaching key milestone in 14 days' }, dpts(last(D.activation), D.activation[0], 'pts', true, '12 mo ago')),
      Object.assign({ label: 'Time to first key action', value: last(D.firstAction).toFixed(0) + ' hrs' }, dpts(last(D.firstAction), D.firstAction[0], 'hrs', false, '12 mo ago'))
    ]) +
      grid(
        panel('pr-au', 'Active users', 'DAU and MAU, last 12 months', 260),
        panel('pr-st', 'Stickiness (DAU / MAU)', 'Share of monthly users active on a given day', 260)
      ) +
      grid(
        panel('pr-ft', 'Feature adoption', 'Share of accounts using each feature in the last 30 days', 300),
        panel('pr-ac', 'Activation rate and time to first key action', 'Last 12 months', 300)
      ) +
      grid(panel('pr-rn', 'Renewal rate by usage quartile', 'Low product usage is the strongest renewal risk signal', 280));

    mk('pr-au', 'line', L12, [ds('MAU', D.mau, C.blue, { fmt: (v) => num(v) }), ds('DAU', D.dau, C.teal, { fmt: (v) => num(v) })], { fmt: (v) => num(v) });
    mk('pr-st', 'line', L12, [ds('Stickiness', D.stick.map((v) => v * 100), C.purple)], { legend: false, fmt: (v) => v.toFixed(0) + '%', min: 0 });
    mk('pr-ft', 'bar', D.features.map((f) => f[0]), [bs('Adoption', D.features.map((f) => f[1]), C.blue)], { indexAxis: 'y', legend: false, fmt: (v) => v.toFixed(0) + '%', max: 100 });
    mk('pr-ac', 'line', L12, [
      ds('Activation (%)', D.activation, C.teal, { fmt: (v) => v.toFixed(0) + '%' }),
      ds('First key action (hrs)', D.firstAction, C.amber, { yAxisID: 'y1', fmt: (v) => v.toFixed(0) + ' hrs' })
    ], { fmt: (v) => v.toFixed(0), scales: { y1: right((v) => v.toFixed(0)) } });
    mk('pr-rn', 'bar', ['Q1 (lowest usage)', 'Q2', 'Q3', 'Q4 (highest usage)'], [bs('Renewal rate', D.renewByUsage.map((v) => v * 100), C.blue)], { legend: false, fmt: (v) => v.toFixed(0) + '%', min: 50, max: 100 });
  }

  /* =========================================================
     TAB: Finance & operations
     ========================================================= */
  function finance(el) {
    const hc = last(D.hcQ);
    const brows = D.budgetRows.map((b) => {
      const v = b.actual / b.budget - 1;
      return [b.name, money(b.actual, 2), money(b.budget, 2), (v >= 0 ? '+' : '') + pc(v)];
    });
    el.innerHTML = kpis([
      { label: 'Cash', value: money(last(D.cash)), status: st(M.runway, 24, 12), sub: M.runway.toFixed(0) + ' months of runway' },
      Object.assign({ label: 'DSO', value: last(D.dso).toFixed(0) + ' days', status: st(last(D.dso), 45, 60, false), sub: 'Days sales outstanding' }, dpts(last(D.dso), D.dso[0], 'days', false, '12 mo ago')),
      { label: 'Billings (month)', value: money(last(D.billings), 2) },
      { label: 'Deferred revenue', value: money(last(D.deferred)) },
      { label: 'Headcount', value: num(hc.total), sub: 'Quarter end' },
      { label: 'ARR per employee', value: money(last(D.revPerEmp)), sub: 'Target $200K or higher' }
    ]) +
      grid(
        panel('fn-cash', 'Cash position', 'Month-end balance', 260),
        panel('fn-bill', 'Billings and deferred revenue', 'Last 12 months', 260)
      ) +
      grid(
        panel('fn-dso', 'DSO trend', 'Days sales outstanding', 260),
        panel('fn-ar', 'Receivables aging', 'Open AR of ' + money(M.arTotal, 1) + ' by bucket', 260)
      ) +
      grid(
        panel('fn-hc', 'Headcount by function', 'Quarter end', 280),
        panel('fn-rpe', 'ARR per employee and loaded cost per head', 'Quarter end', 280)
      ) +
      grid(
        panel('fn-bud', 'Spend vs budget, last quarter', 'Actual and budget by category', 280),
        box('Budget variance', 'Positive means over budget', table(['Category', 'Actual', 'Budget', 'Variance'], brows, 'lrrr'))
      );

    mk('fn-cash', 'line', L, [ds('Cash', D.cash, C.blue, { fill: true, backgroundColor: 'rgba(47,111,237,0.12)' })], { legend: false, fmt: (v) => money(v), min: 0 });
    mk('fn-bill', 'bar', L12, [
      bs('Billings', s12(D.billings), C.blue, { fmt: (v) => money(v, 2) }),
      { type: 'line', label: 'Deferred revenue', data: s12(D.deferred), borderColor: C.teal, backgroundColor: C.teal, yAxisID: 'y1', pointRadius: 0, tension: 0.3, borderWidth: 2, fmt: (v) => money(v) }
    ], { fmt: (v) => money(v), scales: { y1: right((v) => money(v)) } });
    mk('fn-dso', 'line', L12, [ds('DSO', D.dso, C.amber)], { legend: false, fmt: (v) => v.toFixed(0), min: 0 });
    mk('fn-ar', 'bar', D.arAging.labels, [bs('Open AR', D.arAging.values, C.blue)], { legend: false, fmt: (v) => money(v) });
    mk('fn-hc', 'bar', D.qLabels, [
      bs('Sales and marketing', D.hcQ.map((h) => h.sales), C.blue),
      bs('Customer success and support', D.hcQ.map((h) => h.cs), C.teal),
      bs('Engineering and product', D.hcQ.map((h) => h.eng), C.purple),
      bs('G&A', D.hcQ.map((h) => h.ga), C.gray)
    ], { stacked: true, fmt: (v) => num(v) });
    mk('fn-rpe', 'line', D.qLabels, [
      ds('ARR per employee', D.revPerEmp, C.blue, { fmt: (v) => money(v) }),
      ds('Loaded cost per head', D.costPerHead, C.red, { fmt: (v) => money(v) })
    ], { fmt: (v) => money(v), min: 0 });
    mk('fn-bud', 'bar', D.budgetRows.map((b) => b.name), [
      bs('Actual', D.budgetRows.map((b) => b.actual), C.blue),
      bs('Budget', D.budgetRows.map((b) => b.budget), C.gray)
    ], { fmt: (v) => money(v) });
  }

  /* =========================================================
     Tab shell
     ========================================================= */
  const TABS = [
    ['overview', 'Overview', overview],
    ['revenue', 'Revenue & Growth', revenue],
    ['retention', 'Retention & Health', retention],
    ['sales', 'Sales & GTM', sales],
    ['economics', 'Unit Economics', unit],
    ['success', 'CS & Support', cs],
    ['product', 'Product & Usage', product],
    ['finance', 'Finance & Ops', finance]
  ];
  const nav = document.getElementById('tabs');
  const main = document.getElementById('panels');
  let rendered = {};
  let active = null;

  TABS.forEach(function (t) {
    const b = document.createElement('button');
    b.type = 'button'; b.id = 'tab-' + t[0]; b.textContent = t[1];
    b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', 'panel-' + t[0]);
    b.addEventListener('click', function () { show(t[0], true); });
    nav.appendChild(b);
    const p = document.createElement('div');
    p.id = 'panel-' + t[0]; p.className = 'tabpanel'; p.setAttribute('role', 'tabpanel');
    p.setAttribute('aria-labelledby', 'tab-' + t[0]); p.hidden = true;
    main.appendChild(p);
  });

  nav.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = TABS.findIndex((t) => t[0] === active);
    const j = (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
    show(TABS[j][0], true);
    document.getElementById('tab-' + TABS[j][0]).focus();
  });

  function show(id, push) {
    const tab = TABS.find((t) => t[0] === id) || TABS[0];
    id = tab[0];
    TABS.forEach(function (t) {
      const sel = t[0] === id;
      const b = document.getElementById('tab-' + t[0]);
      b.setAttribute('aria-selected', sel ? 'true' : 'false');
      b.tabIndex = sel ? 0 : -1;
      document.getElementById('panel-' + t[0]).hidden = !sel;
    });
    active = id;
    if (!rendered[id]) {
      theme();
      tab[2](document.getElementById('panel-' + id));
      rendered[id] = true;
    }
    if (push && location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
  }

  function rerenderAll() {
    charts.forEach((c) => c.destroy());
    charts = [];
    rendered = {};
    show(active || TABS[0][0], false);
  }

  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', rerenderAll);
  }

  show(location.hash.replace('#', '') || 'overview', false);
  window.addEventListener('hashchange', function () { show(location.hash.replace('#', ''), false); });
})();
