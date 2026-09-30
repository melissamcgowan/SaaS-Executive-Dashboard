/*
 * data.js
 * Seeded synthetic data model for the SaaS Executive Dashboard.
 *
 * This is the "data layer". Everything the UI needs comes from build(seed).
 * To connect real data later, replace this file with one that returns the
 * same shape (see README, "Swapping in real data").
 *
 * All values are synthetic. Company and account names are fictional.
 */
(function (root) {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function build(seed) {
    const rnd = mulberry32(seed >>> 0);
    const between = (a, b) => a + (b - a) * rnd();
    const sum = (a) => a.reduce((x, y) => x + y, 0);
    const r12 = (a) => a.slice(-12);
    const pad = (n) => String(n).padStart(2, '0');
    const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

    const N = 24; // months of history, Oct 2024 through Sep 2026
    const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthLabel = (k) => {
      const d = new Date(2024, 9 + k, 1);
      return mn[d.getMonth()] + " '" + String(d.getFullYear()).slice(2);
    };
    const labels = Array.from({ length: N }, (_, i) => monthLabel(i));
    const nextLabels = [N, N + 1, N + 2].map(monthLabel);
    const qLabels = ["Q4 '24", "Q1 '25", "Q2 '25", "Q3 '25", "Q4 '25", "Q1 '26", "Q2 '26", "Q3 '26"];
    const t = (i) => i / (N - 1);
    const tr = (a, b, n, noise) =>
      Array.from({ length: n }, (_, i) => a + (b - a) * (n === 1 ? 1 : i / (n - 1)) + between(-noise, noise));
    const grp3 = (a) => { const o = []; for (let i = 0; i < a.length; i += 3) o.push(sum(a.slice(i, i + 3))); return o; };

    /* ---------- MRR movements ---------- */
    const startM = [], newM = [], expM = [], conM = [], chnM = [], mrr = [];
    let cur = 1.0e6;
    for (let i = 0; i < N; i++) {
      const s = cur;
      const n = s * between(0.017, 0.029);
      const e = s * between(0.014, 0.022);
      const c = s * between(0.003, 0.006);
      const x = s * between(0.007, 0.012);
      cur = s + n + e - c - x;
      startM.push(s); newM.push(n); expM.push(e); conM.push(c); chnM.push(x); mrr.push(cur);
    }
    const arr = mrr.map((v) => v * 12);
    const netNewArr = newM.map((n, i) => (n + expM[i] - conM[i] - chnM[i]) * 12);

    /* ---------- customers ---------- */
    const cust = [], newLogos = [], lostLogos = [], newAcv = [];
    let cc = 600;
    for (let i = 0; i < N; i++) {
      const acv = 19000 + i * 230 + between(-900, 900);
      const nl = Math.max(1, Math.round((newM[i] * 12) / acv));
      const ll = Math.round(cc * between(0.008, 0.013));
      cc = cc + nl - ll;
      cust.push(cc); newLogos.push(nl); lostLogos.push(ll); newAcv.push(acv);
    }
    const custStart = [600].concat(cust.slice(0, -1));
    const logoChurnM = lostLogos.map((l, i) => l / custStart[i]);

    /* ---------- retention (trailing 12 months, compounded monthly) ---------- */
    const grrM = startM.map((s, i) => 1 - (conM[i] + chnM[i]) / s);
    const nrrM = startM.map((s, i) => 1 + (expM[i] - conM[i] - chnM[i]) / s);
    const logoKeepM = logoChurnM.map((v) => 1 - v);
    const ttmProd = (a, i) => a.slice(i - 11, i + 1).reduce((p, v) => p * v, 1);
    const grrT = [], nrrT = [], logoT = [];
    for (let i = 11; i < N; i++) {
      grrT.push(ttmProd(grrM, i));
      nrrT.push(ttmProd(nrrM, i));
      logoT.push(1 - ttmProd(logoKeepM, i));
    }

    /* ---------- segments and regions ---------- */
    const entS = arr.map((_, i) => 0.47 + 0.08 * t(i));
    const smbS = arr.map((_, i) => 0.21 - 0.06 * t(i));
    const seg = {
      Enterprise: arr.map((v, i) => v * entS[i]),
      'Mid-Market': arr.map((v, i) => v * (1 - entS[i] - smbS[i])),
      SMB: arr.map((v, i) => v * smbS[i])
    };
    const regionNames = ['North America', 'EMEA', 'APAC', 'LATAM'];
    const regionShare = [0.52, 0.29, 0.14, 0.05];

    /* ---------- P&L, cash, efficiency ---------- */
    const gm = [], opexR = [];
    for (let i = 0; i < N; i++) {
      gm.push(0.74 + 0.05 * t(i) + between(-0.008, 0.008));
      opexR.push(1.38 - 0.40 * t(i) + between(-0.03, 0.03));
    }
    const rev = mrr.slice();
    const cogs = rev.map((r, i) => r * (1 - gm[i]));
    const sm = rev.map((r, i) => r * opexR[i] * 0.46);
    const rd = rev.map((r, i) => r * opexR[i] * 0.34);
    const ga = rev.map((r, i) => r * opexR[i] * 0.20);
    const opex = sm.map((v, i) => v + rd[i] + ga[i]);
    const grossProfit = rev.map((r, i) => r - cogs[i]);
    const opInc = grossProfit.map((g, i) => g - opex[i]);
    const fcf = opInc.map((v, i) => v + rev[i] * 0.04); // small benefit from annual prepay
    const burn = fcf.map((v) => -v);
    const cash = [];
    let cs = 22e6;
    for (let i = 0; i < N; i++) { cs -= burn[i]; cash.push(cs); }
    const contribMargin = rev.map((r, i) => (r - cogs[i] - sm[i]) / r);

    const revQ = grp3(rev), smQ = grp3(sm), burnQ = grp3(burn), nnQ = grp3(netNewArr);
    const bookingsQ = grp3(newM).map((v, i) => (v + grp3(expM)[i]) * 12);
    const magicQ = revQ.map((v, i) => (i === 0 ? null : ((v - revQ[i - 1]) * 4) / smQ[i - 1]));
    const burnMultQ = burnQ.map((b, i) => b / nnQ[i]);

    const arrGrowth = arr[N - 1] / arr[N - 13] - 1;
    const fcfMargin = sum(r12(fcf)) / sum(r12(rev));
    const gmT = sum(r12(grossProfit)) / sum(r12(rev));
    const burnMult = sum(r12(burn)) / sum(r12(netNewArr));
    const cacLogo = (sum(r12(sm)) * 0.7) / sum(r12(newLogos));
    const paybackM = sum(r12(sm)) / ((sum(r12(newM)) + sum(r12(expM))) * gmT);
    const arpa = arr[N - 1] / cust[N - 1];
    const churnA = Math.max(0.05, 1 - grrT[grrT.length - 1]);
    const ltv = (arpa * gmT) / churnA;
    const ltvCac = ltv / cacLogo;
    const runway = cash[N - 1] / (sum(burn.slice(-3)) / 3);
    const rule40 = [];
    for (let i = 12; i < N; i++) {
      const g = arr[i] / arr[i - 12] - 1;
      const fm = sum(fcf.slice(i - 11, i + 1)) / sum(rev.slice(i - 11, i + 1));
      rule40.push({ growth: g, margin: fm, score: g + fm });
    }
    const ruleOf40 = arrGrowth + fcfMargin;

    /* ---------- plan and forecast ---------- */
    const planFull = Array.from({ length: N + 3 }, (_, i) => 1.0e6 * Math.pow(1.0275, i + 1) * 12);
    const planArr = planFull.slice(N - 12);
    const gRecent = Math.pow(mrr[N - 1] / mrr[N - 7], 1 / 6) - 1;
    const fcstArr = [1, 2, 3].map((k) => arr[N - 1] * Math.pow(1 + gRecent, k));

    /* ---------- sales and marketing ---------- */
    const nextTarget = bookingsQ[7] * 1.12;
    const coverage = between(3.2, 3.7);
    const stageNames = ['Discovery', 'Qualified', 'Evaluation', 'Proposal', 'Negotiation', 'Verbal commit'];
    const stageShare = [0.30, 0.24, 0.19, 0.14, 0.09, 0.04];
    const pipeline = stageShare.map((s) => nextTarget * coverage * s);
    const winRateQ = tr(0.21, 0.25, 8, 0.012);
    const salesCycle = tr(64, 72, 12, 2.5);
    const wonQ = sum(newLogos.slice(-3));
    const opps = wonQ / winRateQ[7];
    const sqls = opps / 0.55;
    const mqls = sqls / 0.38;
    const leads = mqls / 0.30;
    const funnel = [
      { name: 'Leads', n: leads, conv: null },
      { name: 'MQLs', n: mqls, conv: 0.30 },
      { name: 'SQLs', n: sqls, conv: 0.38 },
      { name: 'Opportunities', n: opps, conv: 0.55 },
      { name: 'Closed won', n: wonQ, conv: winRateQ[7] }
    ];
    const reps = Array.from({ length: 8 }, (_, i) => ({ name: 'AE ' + (i + 1), att: between(0.62, 1.34) }))
      .sort((a, b) => b.att - a.att);
    const teamAttain = sum(reps.map((r) => r.att)) / reps.length;

    /* ---------- health and renewals ---------- */
    const healthShare = { Healthy: 0.68, Watch: 0.19, 'At risk': 0.13 };
    const healthArr = Object.keys(healthShare).map((k) => arr[N - 1] * healthShare[k]);
    const atRiskArr = arr[N - 1] * healthShare['At risk'];
    const renewShare = [0.22, 0.26, 0.27, 0.25];
    const renewQLabels = ["Q4 '26", "Q1 '27", "Q2 '27", "Q3 '27"];
    const renewals = renewShare.map((s) => {
      const total = arr[N - 1] * s;
      const committed = total * between(0.60, 0.70);
      const likely = total * between(0.18, 0.22);
      return { total, committed, likely, atRisk: total - committed - likely };
    });
    const names = ['Brightpath Health', 'Harborline Freight', 'Kestrel Analytics', 'Lumen Ridge Retail',
      'Northgate Energy', 'Orchard & Vale', 'Pinecrest Education', 'Summit Fleet Services'];
    const drivers = ['Usage down 38% in 60 days', 'Champion left the company', 'Open P1 escalation',
      'Low adoption of core module', 'Budget freeze reported', 'Competitor evaluation in progress',
      'No executive sponsor engaged', 'Onboarding gaps unresolved'];
    const segs = ['Enterprise', 'Mid-Market', 'Enterprise', 'Mid-Market', 'Enterprise', 'Mid-Market', 'Mid-Market', 'Enterprise'];
    const atRiskAccounts = names.map((nm, i) => ({
      name: nm,
      segment: segs[i],
      arr: between(120000, 900000),
      renewal: iso(new Date(2026, 8, 30 + Math.round(between(8, 120)))),
      score: Math.round(between(28, 49)),
      driver: drivers[i]
    })).sort((a, b) => b.arr - a.arr);

    const cohorts = Array.from({ length: 6 }, (_, c) => {
      const pts = [100];
      for (let k = 1; k < 8 - c; k++) pts.push(pts[k - 1] * (1 + between(-0.035, 0.024)));
      return { name: qLabels[c] + ' cohort', points: pts };
    });

    /* ---------- customer success and support ---------- */
    const nps = tr(34, 44, 12, 1.8);
    const csat = tr(86, 91, 12, 0.7);
    const ttv = tr(62, 47, 12, 2);
    const onboardDone = tr(71, 84, 12, 1.5);
    const tickets = tr(1450, 1720, 12, 70).map(Math.round);
    const frt = tr(3.4, 2.2, 12, 0.25);
    const resolution = tr(31, 24, 12, 1.8);
    const backlog = tr(210, 165, 12, 14).map(Math.round);
    const escalations = tr(3.1, 2.4, 12, 0.25);
    const sponsor = { Enterprise: 0.71, 'Mid-Market': 0.48, SMB: 0.12 };
    const expQ = grp3(expM).map((v) => v * 12 * 3);
    const expansionPipe = expQ.map((v) => {
      const a = between(0.46, 0.54), b = between(0.26, 0.32);
      return { upsell: v * a, cross: v * b, newDept: v * (1 - a - b) };
    });

    /* ---------- product usage ---------- */
    const dau = tr(9800, 15400, 12, 350);
    const mau = tr(31000, 44000, 12, 700);
    const stick = dau.map((d, i) => d / mau[i]);
    const activation = tr(54, 67, 12, 1.8);
    const firstAction = tr(41, 26, 12, 2.5);
    const features = [
      ['Dashboards', 91], ['Reporting', 78], ['Workflow automation', 64], ['API integrations', 57],
      ['Mobile app', 46], ['Admin and SSO', 43], ['AI assistant', 38], ['Advanced analytics', 29]
    ].map(([n, v]) => [n, Math.max(5, Math.min(99, v + between(-2, 2)))]);
    const renewByUsage = [0.71, 0.84, 0.92, 0.97].map((v) => v + between(-0.012, 0.012));

    /* ---------- finance and operations ---------- */
    const deferred = arr.map((v) => v * (0.30 + between(-0.015, 0.015)));
    const billings = rev.map((r, i) => r + (deferred[i] - (i ? deferred[i - 1] : arr[0] * 0.30)));
    const dso = tr(52, 44, 12, 1.8);
    const arTotal = billings[N - 1] * (dso[11] / 30);
    const agingRaw = [0.71, 0.15, 0.08, 0.04, 0.02].map((v) => v * between(0.94, 1.06));
    const agingSum = sum(agingRaw);
    const arAging = {
      labels: ['Current', '1-30 days', '31-60 days', '61-90 days', '90+ days'],
      values: agingRaw.map((v) => (v / agingSum) * arTotal)
    };
    const hcM = arr.map((v, i) => Math.round(v / (135000 + i * 2000 + between(-2500, 2500))));
    const hcIdx = [2, 5, 8, 11, 14, 17, 20, 23];
    const hcQ = hcIdx.map((i) => {
      const total = hcM[i], tt = t(i);
      const sales = Math.round(total * (0.30 - 0.01 * tt));
      const cs2 = Math.round(total * (0.16 + 0.015 * tt));
      const eng = Math.round(total * (0.39 - 0.005 * tt));
      return { total, sales, cs: cs2, eng, ga: total - sales - cs2 - eng };
    });
    const revPerEmp = hcIdx.map((i, k) => arr[i] / hcQ[k].total);
    const costPerHead = hcIdx.map((i, k) => {
      const lo = Math.max(0, i - 11);
      const exp = sum(cogs.slice(lo, i + 1)) + sum(opex.slice(lo, i + 1));
      const months = i - lo + 1;
      return (exp * (12 / months)) / hcQ[k].total;
    });
    const qa = (a) => sum(a.slice(-3));
    const budgetRows = [
      ['COGS', qa(cogs)], ['Sales and marketing', qa(sm)], ['Research and development', qa(rd)], ['General and admin', qa(ga)]
    ].map(([name, actual]) => ({ name, actual, budget: actual / (1 + between(-0.06, 0.05)) }));

    return {
      seed, N, labels, nextLabels, qLabels,
      mrr, arr, newM, expM, conM, chnM, netNewArr, startM,
      cust, newLogos, lostLogos, newAcv,
      grrT, nrrT, logoT,
      seg, regionNames, regionShare,
      gm, contribMargin, rev, cogs, sm, rd, ga, opex, opInc, fcf, burn, cash,
      revQ, bookingsQ, magicQ, burnMultQ, burnQ, nnQ,
      rule40, planArr, fcstArr,
      stageNames, pipeline, winRateQ, salesCycle, funnel, reps,
      healthLabels: Object.keys(healthShare), healthArr,
      renewQLabels, renewals, atRiskAccounts, cohorts,
      nps, csat, ttv, onboardDone, tickets, frt, resolution, backlog, escalations, sponsor, expansionPipe,
      dau, mau, stick, activation, firstAction, features, renewByUsage,
      deferred, billings, dso, arAging, hcQ, revPerEmp, costPerHead, budgetRows,
      m: {
        arrGrowth, fcfMargin, gmT, burnMult, cacLogo, paybackM, arpa, ltv, ltvCac, runway, ruleOf40,
        coverage, nextTarget, atRiskArr, teamAttain, magic: magicQ[7], arTotal
      }
    };
  }

  const api = { build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SaaSData = api;
})(typeof window !== 'undefined' ? window : globalThis);
