# v2 — AutoLanding su nibrun

Variante standalone (non tocca né `backend/` né `frontend/` né alcun file originale
dello starter): il lato **pubblico** di [AutoLanding](https://github.com/itboy79/autolanding),
un sistema che genera landing bilingue IT/EN per attività commerciali italiane senza sito
e le vende con cold email contenente il link alla pagina già fatta.

## Cosa serve
- dati su `/app/data` (nibrun): `leads/<slug>/lead.yaml` + `sites/<slug>/**` + `static/*.html`
- nessun database esterno, niente Supabase: i lead sono file YAML, il disco di nibrun è la verità
- l'engine di generazione resta **locale** (Python, repo autolanding) e spinge i file via `/api/sync`

## Rotte
| Rotta | Cosa |
|---|---|
| `GET /` | indice delle demo |
| `GET /sites/:slug/**` | landing renderizzate (statiche, dal disco) |
| `GET /complete?token=` + `POST` | wizard di completamento (token, precompilato) |
| `GET /pay?token=` + `POST` | paywall 99€+19€: carta (mock) o bonifico |
| `POST /stripe/webhook` | firma HMAC verificata se `STRIPE_WEBHOOK_SECRET` è impostato |
| `GET /optout` + `POST` | opt-out con conferma (GET non muta, suppression permanente) |
| `GET /go?slug=&m=` | redirect demo + tracking click onesto (niente pixel/cookie) |
| `GET /health` | healthcheck |
| `POST /api/sync`, `GET /api/sync/changes|lead` | sync Bearer per l'engine locale |

## Build e deploy

```sh
bun install
bun run build                 # → dist/app (linux x86_64, cross-compile)
nib run ./v2/dist/app --name autolanding --port 3000 \
  --data-folder ./v2/seed \
  --env AUTOLANDING_SYNC_TOKEN=<token>
# redeploy (nominare SEMPRE l'app):
nib run ./v2/dist/app --app autolanding
```

Variabili: `AUTOLANDING_SYNC_TOKEN` (sync engine↔nibrun), `AUTOLANDING_RAGIONE_SOCIALE`,
`AUTOLANDING_IBAN`, `AUTOLANDING_SETUP_EUR`, `AUTOLANDING_MENSILE_EUR`,
`STRIPE_WEBHOOK_SECRET` (in produzione), `AUTOLANDING_MOCK=1` per esplicitare il mock.

## Loop completo

1. Locale: `engine ciclo` → render/validate/deploy locale → review batch → outreach
2. `engine sync-nibrun` → spinge lead.yaml + siti su nibrun
3. Il lead completa su nibrun (wizard) → `engine sync-nibrun --pull` → re-render → push
4. La pagina pubblica si aggiorna senza toccare nibrun a mano
