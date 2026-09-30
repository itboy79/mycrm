// lib/admin.ts — pannello di backend: lead, scouting, azioni (SOP 01-04-10).
// Protetto da AUTOLANDING_ADMIN_PASSWORD (basic auth) — vedi server.ts.
const STILE_ADMIN = `<style>
:root{--blu:#1E4E79;--ink:#22303C;--grigio:#5A6B7A;--fondo:#F4F6F8;--bordo:#C9D3DC;--r:10px;
--verde:#2E6B4F;--rosso:#A2342A;--ambra:#8A6420}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:var(--fondo);color:var(--ink);line-height:1.5}
header{background:var(--blu);color:#fff;padding:.7rem 1.2rem;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
header a{color:#fff;text-decoration:none;opacity:.9;margin-left:.9rem}
main{max-width:78rem;margin:0 auto;padding:1.2rem}
h1{font-size:1.25rem;margin:.4rem 0 1rem}h2{font-size:1.05rem;margin:1.6rem 0 .6rem}
table{border-collapse:collapse;width:100%;background:#fff;border-radius:var(--r);overflow:hidden;font-size:.92rem}
th,td{border-bottom:1px solid var(--bordo);padding:.5rem .65rem;text-align:left;vertical-align:top}
th{background:#EEF2F5;font-size:.8rem;text-transform:uppercase;letter-spacing:.03em}
a{color:var(--blu)}
.pill{display:inline-block;border-radius:999px;padding:.1rem .55rem;font-size:.78rem;font-weight:600;background:#E3ECF2;color:var(--blu)}
.pill--ok{background:#EAF4EE;color:var(--verde)}.pill--ko{background:#F9ECEA;color:var(--rosso)}.pill--warn{background:#FBF3E4;color:var(--ambra)}
.card{background:#fff;border:1px solid var(--bordo);border-radius:var(--r);padding:1.1rem;margin-bottom:1rem}
.griglia{display:grid;grid-template-columns:repeat(auto-fill,minmax(11rem,1fr));gap:.7rem;margin:.8rem 0}
.kpi{background:#fff;border:1px solid var(--bordo);border-radius:var(--r);padding:.7rem .9rem}
.kpi strong{display:block;font-size:1.4rem}
form.inline{display:inline}
select,input,textarea{font:inherit;padding:.45rem;border:1px solid var(--bordo);border-radius:8px;min-height:40px;background:#fff;width:100%}
.btn{display:inline-flex;align-items:center;min-height:42px;padding:.5rem 1rem;border-radius:8px;border:1px solid var(--blu);
background:var(--blu);color:#fff;font-weight:600;cursor:pointer;text-decoration:none}
.btn--ghost{background:#fff;color:var(--blu)}
.muted{color:var(--grigio);font-size:.85rem}
@media (max-width:700px){table{font-size:.8rem}th,td{padding:.35rem .4rem}}
</style>`;

function adminPage(titolo: string, corpo: string): string {
  return `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${titolo} — AutoLanding admin</title>${STILE_ADMIN}</head><body>
<header><strong>AutoLanding · backend</strong>
<nav><a href="/admin">Lead</a><a href="/admin/nuovo">Nuovo lead</a><a href="/admin/scouting">Scouting</a><a href="/">Storefront ↗</a></nav>
</header><main>${corpo}</main></body></html>`;
}

const PILL_STATO: Record<string, string> = {
  active: "pill--ok", paid: "pill--ok", completed: "pill--ok",
  pending_manual: "pill--warn", completing: "pill--warn", opened: "pill--warn",
  refused: "pill--ko", bounced: "pill--ko", invalid: "pill--ko", expired: "pill--ko",
};

export function adminDashboard(
  lead: Record<string, unknown>[],
  filtri: { stato: string; verticale: string; q: string },
): string {
  const stati = [...new Set(lead.map((l) => String(l.stato_pipeline)))].sort();
  const verticali = [...new Set(lead.map((l) => String(l.verticale)))].sort();
  const conteggi: Record<string, number> = {};
  for (const l of lead) conteggi[String(l.stato_pipeline)] = (conteggi[String(l.stato_pipeline)] ?? 0) + 1;
  const kpi = [
    ["lead totali", lead.length],
    ["attivi", conteggi["active"] ?? 0],
    ["in trattativa", (conteggi["contacted"] ?? 0) + (conteggi["completing"] ?? 0) + (conteggi["pending_manual"] ?? 0)],
    ["da approvare", conteggi["generated"] ?? 0],
    ["scout/enrich", (conteggi["new"] ?? 0) + (conteggi["scouted"] ?? 0) + (conteggi["enriched"] ?? 0)],
  ]
    .map(([k, v]) => `<div class="kpi"><span class="muted">${k}</span><strong>${v}</strong></div>`)
    .join("");

  const opzioni = (valori: string[], scelta: string) =>
    valori.map((v) => `<option value="${v}"${v === scelta ? " selected" : ""}>${v}</option>`).join("");

  const righe = lead
    .map((l) => {
      const slug = String(l.slug);
      const stato = String(l.stato_pipeline);
      const pill = PILL_STATO[stato] ?? "";
      const admissible = ["approved", "published", "generated", "invalid", "expired", "active", "suspended", "churned"];
      return `<tr>
  <td><a href="/admin/lead/${slug}">${String(l.nome_attivita ?? slug)}</a><br><span class="muted">${slug}</span></td>
  <td>${l.verticale ?? ""}<br><span class="muted">${l.citta ?? ""}</span></td>
  <td><span class="pill ${pill}">${stato}</span></td>
  <td>${l.email ?? "—"}</td>
  <td><a href="/sites/${slug}/" target="_blank">demo ↗</a></td>
  <td>
    <form class="inline" method="post" action="/admin/lead/${slug}/stato">
      <select name="stato" style="min-width:9rem">${opzioni(admissible, admissible.includes(stato) ? stato : "approved")}</select>
      <button class="btn btn--ghost" type="submit">↦</button>
    </form>
  </td>
</tr>`;
    })
    .join("");

  return adminPage(
    "Lead",
    `<h1>Gestione lead</h1>
<div class="griglia">${kpi}</div>
<form method="get" action="/admin" class="card" style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:end">
  <div style="flex:1;min-width:12rem"><label class="muted">Cerca (nome/città/email)</label>
    <input name="q" value="${filtri.q}" placeholder="es. trattoria, Brescia…"></div>
  <div><label class="muted">Stato</label><select name="stato"><option value="">tutti</option>${opzioni(stati, filtri.stato)}</select></div>
  <div><label class="muted">Verticale</label><select name="verticale"><option value="">tutti</option>${opzioni(verticali, filtri.verticale)}</select></div>
  <button class="btn" type="submit">Filtra</button>
  <a class="btn btn--ghost" href="/admin">Azzera</a>
</form>
<table><thead><tr><th>Attività</th><th>Verticale</th><th>Stato</th><th>Email</th><th>Demo</th><th>Cambia stato</th></tr></thead>
<tbody>${righe || `<tr><td colspan="6" class="muted">Nessun lead con questi filtri.</td></tr>`}</tbody></table>
<p class="muted" style="margin-top:.8rem">Le transizioni qui sono operative (approve/publish/sospendi…): la source of truth resta la history nel lead.yaml, che il sync porta in locale.</p>`,
  );
}

export function adminLeadDetail(lead: Record<string, unknown>): string {
  const slug = String(lead.slug);
  const campi = [
    "ragione_sociale", "categoria", "indirizzo", "cap", "telefono", "email",
    "descrizione", "live_url", "token_completa",
  ];
  const righeCampi = campi
    .map((c) => `<dt>${c}</dt><dd>${String(lead[c] ?? "—")}</dd>`)
    .join("");
  const storia = ((lead.history ?? []) as Record<string, string>[])
    .slice(-8)
    .reverse()
    .map((h) => `<li><code>${h.data?.slice(0, 16) ?? ""}</code> ${h.stato} — ${h.nota ?? ""} <span class="muted">(${h.autore ?? ""})</span></li>`)
    .join("");
  return adminPage(
    String(lead.nome_attivita ?? slug),
    `<h1>${lead.nome_attivita ?? slug} <span class="pill ${PILL_STATO[String(lead.stato_pipeline)] ?? ""}">${lead.stato_pipeline}</span></h1>
<div class="card">
  <dl>${righeCampi}</dl>
  <p class="muted">Verticale: ${lead.verticale} · Città: ${lead.citta ?? "—"} · Recensioni: ${((lead.recensioni ?? {}) as Record<string, unknown>).media ?? "—"} (${((lead.recensioni ?? {}) as Record<string, unknown>).numero ?? 0})</p>
</div>
<div class="card">
  <h2 style="margin-top:0">Modifica campi (whitelist wizard)</h2>
  <form method="post" action="/admin/lead/${slug}/modifica">
    <label>Descrizione</label><textarea name="descrizione" rows="3">${String(lead.descrizione ?? "")}</textarea>
    <label>Telefono</label><input name="telefono" value="${String(lead.telefono ?? "")}">
    <label>Email</label><input name="email" value="${String(lead.email ?? "")}">
    <button class="btn" type="submit">Salva</button>
  </form>
</div>
<div class="card">
  <h2 style="margin-top:0">Azioni</h2>
  ${lead.suppression ? `<p class="pill pill--ko">SUPPRESSION ATTIVA</p>` : `<form class="inline" method="post" action="/admin/lead/${slug}/suppression"><button class="btn btn--ghost" type="submit">Metto in suppression (mai più contattato)</button></form>`}
  <p class="muted">Render e outreach restano nel repo locale (engine): qui governi lo stato e i dati, il sync porta tutto indietro.</p>
</div>
<div class="card">
  <h2 style="margin-top:0">History (ultime 8)</h2>
  <ul style="padding-left:1.1rem">${storia || "<li class='muted'>nessuna</li>"}</ul>
</div>`,
  );
}

export function adminNuovo(): string {
  return adminPage(
    "Nuovo lead",
    `<h1>Nuovo lead manuale</h1>
<div class="card">
  <p class="muted">Per lo scouting automatico usa la scheda Scouting. Questo form crea un lead già arricchito (stato: enriched), pronto per generare.</p>
  <form method="post" action="/admin/nuovo">
    <label>Nome attività *</label><input name="nome_attivita" required>
    <label>Verticale *</label><select name="verticale"><option>ristorazione</option><option>saloni</option><option>artigiani</option></select>
    <label>Categoria</label><input name="categoria" placeholder="Ristorante italiano, Idraulico…">
    <label>Città *</label><input name="citta" required>
    <label>Indirizzo</label><input name="indirizzo">
    <label>Telefono</label><input name="telefono">
    <label>Email (aziendale!)</label><input name="email" type="email">
    <label>Descrizione</label><textarea name="descrizione" rows="2"></textarea>
    <button class="btn" type="submit">Crea lead (enriched)</button>
  </form>
</div>`,
  );
}

export function adminScouting(
  missioni: { zona: string; verticale: string; n: number; stato: string; creata: string }[],
): string {
  const righe = missioni
    .map(
      (m) =>
        `<tr><td>${m.zona}</td><td>${m.verticale}</td><td>${m.n}</td>
<td><span class="pill ${m.stato === "pending" ? "pill--warn" : "pill--ok"}">${m.stato}</span></td>
<td><span class="muted">${m.creata.slice(0, 16)}</span></td></tr>`,
    )
    .join("");
  return adminPage(
    "Scouting",
    `<h1>Missioni di scouting</h1>
<div class="card">
  <p>Una missione = «trova N attività per verticale in zona». La crei qui, la consuma l'agente in locale
  (<code>engine scouting-pull</code> — segue SOP 01 su Google Maps) e i lead tornano col sync.</p>
  <form method="post" action="/admin/scouting" style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:end">
    <div style="flex:1;min-width:10rem"><label>Zona *</label><input name="zona" placeholder="Brescia" required></div>
    <div><label>Verticale</label><select name="verticale"><option>ristorazione</option><option>saloni</option><option>artigiani</option></select></div>
    <div><label>Quante</label><input name="n" type="number" value="10" min="1" max="30" style="width:6rem"></div>
    <button class="btn" type="submit">Crea missione</button>
  </form>
</div>
<table><thead><tr><th>Zona</th><th>Verticale</th><th>N</th><th>Stato</th><th>Creata</th></tr></thead>
<tbody>${righe || `<tr><td colspan="5" class="muted">Nessuna missione: creane una e poi lancia <code>engine scouting-pull</code> in locale.</td></tr>`}</tbody></table>`,
  );
}

export function adminMessaggio(titolo: string, testo: string, torna = "/admin"): string {
  return adminPage(titolo, `<div class="card"><p>${testo}</p><p><a class="btn btn--ghost" href="${torna}">Torna al pannello</a></p></div>`);
}
