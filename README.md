# SaaS Executive Dashboard

An interactive executive reporting dashboard for a B2B SaaS business. Eight tabs cover the reports a CEO, CFO, CRO, and CCO ask for most often, from ARR and retention to unit economics, support, product usage, and cash.

It runs as a static web page with no build step and no backend. All data is synthetic.

## What it shows

| Tab | Reports |
|---|---|
| **Overview** | Eight headline KPIs with on-track / watch / at-risk status, ARR trend, NRR and GRR trend, net new ARR by driver, and an auto-generated "needs attention" list |
| **Revenue & Growth** | ARR bridge (new, expansion, contraction, churn), actual vs plan with a 3-month forecast, ARR by segment and region, bookings by quarter |
| **Retention & Health** | NRR, GRR, logo churn, retention by segment, ARR by health bucket, renewal forecast by confidence, cohort net dollar retention, top at-risk accounts |
| **Sales & GTM** | Pipeline coverage and stage mix, marketing funnel with conversion, win rate, deal size, sales cycle, CAC and payback, quota attainment by AE |
| **Unit Economics** | LTV:CAC, CAC payback, gross and contribution margin, burn multiple, Rule of 40, magic number, burn and cash |
| **CS & Support** | NPS, CSAT, time to value, onboarding completion, ticket volume and backlog, response and resolution time, escalations, executive sponsor coverage, expansion pipeline |
| **Product & Usage** | DAU, MAU, stickiness, feature adoption, activation, time to first key action, renewal rate by usage quartile |
| **Finance & Ops** | Cash, billings and deferred revenue, DSO, receivables aging, headcount by function, ARR per employee, spend vs budget |

## Run it

Open `index.html` in a browser. Charts load Chart.js from a CDN, so you need an internet connection.

To serve it locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Each tab has a shareable link, for example `index.html#retention`. Add `?seed=123` to the URL to generate a different but repeatable dataset.

## Metric dictionary

| Metric | Definition used here |
|---|---|
| ARR | Month-end MRR x 12 |
| NRR | Trailing 12 months, compounding monthly (starting MRR + expansion - contraction - churn) / starting MRR |
| GRR | Same as NRR but excluding expansion |
| Logo churn | Customers lost / customers at start of month, compounded over 12 months |
| CAC (new logo) | 70% of sales and marketing spend / new logos, trailing 12 months |
| CAC payback | Sales and marketing spend / (new + expansion MRR x gross margin), in months |
| LTV | ARPA x gross margin / annual dollar churn (1 - GRR) |
| Burn multiple | Net burn / net new ARR, trailing 12 months |
| Rule of 40 | ARR growth (YoY) + free cash flow margin (trailing 12 months) |
| Magic number | (Quarterly revenue - prior quarterly revenue) x 4 / prior quarter sales and marketing spend |
| Pipeline coverage | Open pipeline / next quarter new + expansion bookings target |
| Stickiness | DAU / MAU |
| DSO | Days sales outstanding, receivables / billings x 30 |
| Runway | Cash / average monthly net burn, last 3 months |

Status thresholds (on track / watch / at risk) are set in `app.js` and are easy to change to match your own targets.

## How it is built

```
index.html   page shell and tab container
styles.css   layout, light and dark themes
data.js      data layer: build(seed) returns every series and metric the UI needs
app.js       UI layer: KPI cards, charts, tables, tab routing (tabs render on first open)
```

The two-layer design is deliberate. The UI never generates data. It only reads from `SaaSData.build()`, so the data layer can be swapped without touching the charts.

## Swapping in real data

Replace `data.js` with a file that exposes `window.SaaSData.build()` and returns the same object shape. The fields are documented by the return statement at the bottom of `build()`. Typical sources:

- **Billing or finance system:** MRR movements, customers, billings, deferred revenue, cash
- **CRM:** pipeline, win rate, funnel, quota
- **CS platform:** health scores, renewals, NPS, success plans
- **Support desk:** tickets, response and resolution times
- **Product analytics:** DAU, MAU, feature adoption, activation

A simple path is a small script that exports one JSON file from your warehouse, then a `data.js` that loads and reshapes it.

## Notes

- All numbers, segments, and account names are fictional. Nothing here reflects a real company.
- Dark mode follows the system setting.
- Built to be read as a reference for which executive reports matter and how they fit together, not as a finished BI product.

## Possible next steps

- Connect the Customer Health Score and Renewal Risk projects as live inputs to the Retention tab
- Add a board-ready PDF export of the Overview tab
- Add period selectors (month, quarter, trailing 12 months)
- Add role-based views (CEO, CFO, CRO, CCO) on top of the shared core
