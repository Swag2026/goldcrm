# Gold Collections

GERP (`swag.gerpsystems.com/external`) ke gold/cash/silver customer balances + collections workflow
(follow-ups, promises, My Day, users). React + Tailwind frontend, FastAPI + Postgres backend.
crmswag1 se alag, sirf gold ke liye.

## Features
- **Overview** (bento dashboard): count-up KPIs + sparklines + change vs last day, receivable trend, paid-down vs new debt, Needs attention (follow-ups / promises / neglected / unassigned), biggest movers, gold concentration, top debtors, collector board, recent activity
- **Customers**: search + filters (gold/cash/silver debtors, we-owe, assigned, status), sort, Excel export, bulk assign (admin)
- **Customer drawer**: balances (debit/credit/balance), notes, status (active/hold/legal), assign, follow-up log, payment promises (mark kept/broken)
- **My Day**: due follow-ups, due promises (7 din), unassigned debtors ("Take it")
- **Gold KPI**: Dashboards KPI PDF ke formulas (sales/purchase/net, green = positive, red = negative)
- **Statement of account**: har customer ka period statement (opening → debit/credit → closing, gold/cash/silver), screen par + Excel + Print/PDF (Arabic bhi). GERP balances se bana summary hai, line-by-line entries API mein nahi
- **Users**: admin/collector roles, disable, reset password
- Arabic/English (RTL), dark mode, mobile friendly

## Run (local)
```bash
# backend (demo data ke liye GERP_MOCK=1; real ke liye .env mein GERP_* bharo)
cd backend && pip install -r requirements.txt
GERP_MOCK=1 ADMIN_PASSWORD=admin12345 uvicorn main:app --port 8000

# frontend
cd frontend && npm install && npm run dev      # http://localhost:5173
```
Default DB local par SQLite (`gold.db`). Tests: `cd backend && python3 test_api.py`
Demo history ke saath dekhna ho: `cd backend && GERP_MOCK=1 DATABASE_URL=sqlite:///./demo.db ADMIN_PASSWORD=admin12345 python3 seed_demo.py`
phir wahi env ke saath uvicorn chalao (seed_demo sirf mock mode mein chalta hai, asli DB ko nahi chhuta).

## Deploy (shared VM, docker-compose)
```bash
cp .env.example .env     # sab values bharo (POSTGRES_PASSWORD, GERP_*, SECRET_KEY, ADMIN_PASSWORD)
docker compose up -d --build
```
API `127.0.0.1:8070` par. Cloudflare Tunnel mein `goldapi.swag.sa -> http://localhost:8070` jodo.
Frontend Vercel par: `VITE_API_URL=https://goldapi.swag.sa`, aur backend `.env` mein `CORS_ORIGINS=https://<frontend-domain>`.
Pehli baar admin = `ADMIN_USERNAME` / `ADMIN_PASSWORD` (ADMIN_PASSWORD khali ho to random password log mein print hota hai: `docker compose logs api`).

## Kaise kaam karta hai
- Backend GERP se `/customer-balances` leta hai (cache `SYNC_TTL_SECONDS`, default 10 min; "Sync now" button se manual, 30s throttle).
  GERP down ho to purana cache chalta hai aur Overview par "Last sync failed" dikhta hai.
- Balance = debit − credit. **Positive = customer humein dena hai (laal)**, negative = hum ne dena hai (neela).
- **Sync overwrite nahi, history banata hai**: current balance update hota hai, par har din ka per-customer snapshot (`customer_snapshots`) alag save hota hai.
  Isi se "kal se change", paid-down, biggest movers aur customer ka balance-history chart bante hain. Din mein kai sync hon to us din ka aakhri wala rehta hai.
  Pehle din koi change nahi dikhta (compare karne ko purana din nahi); doosre din ke sync se sab bhar jata hai.
- Jo customer GERP ki list se gayab ho jaye uska balance zero kar diya jata hai (totals stale na rahein); uski history aur follow-ups safe rehte hain.
- "Paid down" = balance ka ghatna (receivable kam hua). Isme sales return jaise adjustments bhi aa sakte hain, ye payment ka exact record nahi.
- Follow-ups/promises/notes/assignments apne Postgres mein; sync inhe overwrite nahi karta.
- Roz ka total `snapshots` table mein save hota hai (trend chart ke liye); trend 2+ din baad dikhega.
- Collectors sab customers dekh sakte hain; khud ko assign/unassign kar sakte hain. Baaki assignments aur users admin karta hai.

## Dhyan
- Backend 1 worker par chalao (token cache, sync lock, login throttle memory mein hain).
- Kpi: `331110001`, `331110002`, `321110002` GERP API se nahi aate → 0 maane jaate hain. Codes `backend/gerp.py` mein.
- Opening balance KPI page par manual field hai.
- Dashboard ko public mat chhodo: login hai, par Cloudflare Access bhi laga sakte ho.

## Customer naam
GERP mein `customer_name` aur `customer_name_ar` aksar dono Arabic hote hain, bracket mein trade name / English (`( معرض سواج جولد )`). UI naam ko saaf karta hai (extra spaces hataye), bracket wala hissa neeche alag chhoti line mein dikhata hai, aur RTL/LTR mix theek rakhta hai. Search naam, bracket text (English bhi) aur code teeno par chalta hai.

## Multi-company (alag GERP databases)
Har company ka apna GERP database/URL hai (SWAG = swag.gerpsystems.com, LAROUCHE = laroche.gerpsystems.com). App mein sidebar ke upar
company switcher hai; har company ke apne customers, sync, history, Gold KPI, statement, My Day aur overview hote hain.
Follow-ups/notes/assignments customer ke saath company mein hi rehte hain. Users (collectors) sab companies mein common hain.

Config: Railway/`.env` mein ek variable `GERP_COMPANIES` (JSON; passwords sirf server par rehte hain):
```json
[{"key":"swag","name":"SWAG","base":"https://swag.gerpsystems.com/external","username":"external","password":"...","branches":[1,2]},
 {"key":"laroche","name":"LAROUCHE","base":"https://laroche.gerpsystems.com/external","username":"external","password":"...","branches":[1]}]
```
- Order mat badlo, nayi company hamesha **end mein** jodo (customer id = company index x 1,000,000 + GERP id). Pehli company (swag) ke purane ids waise hi rehte hain.
- Purana `GERP_USERNAME/GERP_PASSWORD/GERP_BASE` setup bhi chalta hai (ek company "swag").
- Purana database apne aap migrate hota hai (customers mein `company` column, purani `snapshots` -> `company_snapshots`); data nahi jaata.
- Total (consolidated) database ke liye alag API user + URL chahiye; wo ek aur entry se jud jayega. Total ko SWAG+LAROUCHE ke saath jodna mat (double count).
