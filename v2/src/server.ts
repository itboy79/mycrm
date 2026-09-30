// server.ts — AutoLanding v2: il lato pubblico del sistema, su nibrun.
// Contratto dati: lead.yaml su /app/data (identico all'engine Python locale).
// L'engine locale fa render/ciclo/outreach e spinge i file via /api/sync (Bearer).
// Tutto lo stato vive su nibrun: niente Supabase, niente database esterni.
import { Elysia } from "elysia";
import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, statSync } from "node:fs";
import { join, normalize, extname, dirname } from "node:path";
import {
  allSlugs,
  dataDir,
  findLeadByToken,
  isPaid,
  loadLead,
  nota,
  safeSyncPath,
  saveLead,
  transition,
} from "./lib/store";
import {
  bonificoHtml,
  doneHtml,
  erroreHtml,
  indiceHtml,
  optoutConfirmHtml,
  optoutHtml,
  payNonProntoHtml,
  paywallHtml,
  pagatoHtml,
  wizardHtml,
} from "./lib/pages";

const PORT = Number(process.env.PORT ?? process.env.NIBRUN_HTTP_PORT ?? 3000);
const HOSTNAME_PUBBLICO =
  process.env.BASE_URL?.replace(/\/$/, "") ||
  (process.env.NIBRUN_HOSTNAME ? `https://${process.env.NIBRUN_HOSTNAME}` : `http://127.0.0.1:${PORT}`);
const SYNC_TOKEN = process.env.AUTOLANDING_SYNC_TOKEN ?? "";
const STRIPE_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

const VENDITORE = {
  ragione_sociale: process.env.AUTOLANDING_RAGIONE_SOCIALE ?? "AutoLanding Demo SRL",
  iban: process.env.AUTOLANDING_IBAN ?? "IT00A0000000000000000000000 (MOCK)",
  setup: Number(process.env.AUTOLANDING_SETUP_EUR ?? 99),
  mensile: Number(process.env.AUTOLANDING_MENSILE_EUR ?? 19),
};

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".heic": "image/heic",
};

function fileStatico(rel: string): { body: Buffer; type: string } | null {
  const root = join(dataDir(), "sites");
  const pieno = normalize(join(root, rel));
  if (!pieno.startsWith(root)) return null; // path traversal
  if (!existsSync(pieno)) return null;
  return {
    body: readFileSync(pieno),
    type: MIME[extname(pieno).toLowerCase()] ?? "application/octet-stream",
  };
}

function paginaStatica(nome: string): string | null {
  const p = join(dataDir(), "static", nome);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

function html(corpor: string, status = 200): Response {
  return new Response(corpor, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function json(corpor: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpor), { status, headers: { "Content-Type": "application/json" } });
}

function confrontoSicuro(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function webhookFirmato(payload: string, header: string): boolean {
  // stesso schema del webhook Python: HMAC-SHA256 su "{t}.{payload}", header "t=...,v1=..."
  try {
    const elementi = Object.fromEntries(
      header.split(",").map((parte) => parte.split("=", 2) as [string, string]),
    );
    const atteso = createHmac("sha256", STRIPE_SECRET)
      .update(`${elementi.t}.${payload}`)
      .digest("hex");
    return confrontoSicuro(atteso, elementi.v1 ?? "");
  } catch {
    return false;
  }
}

function logAttivita(slug: string, evento: string, mezzo: string): void {
  const file = join(dataDir(), "attivita.jsonl");
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(
    file,
    JSON.stringify({ ts: new Date().toISOString(), slug, evento, mezzo }) + "\n",
  );
}

function syncAutorizzato(request: Request): boolean {
  if (!SYNC_TOKEN) return false;
  return confrontoSicuro(`Bearer ${SYNC_TOKEN}`, request.headers.get("Authorization") ?? "");
}

function marcaAttivo(lead: Lead): void {
  saveLead(lead);
  if (lead.stato_pipeline === "paid") transition(lead, "active", "stripe-webhook-v2", "attivato");
  saveLead(lead);
}

const app = new Elysia()
  .onError(({ code, error }) => { console.error("[onError]", code, error);
    html(
      erroreHtml(
        code === "NOT_FOUND"
          ? "La pagina che cerchi non esiste (o il link è scaduto). Riparti dall'email che ti abbiamo inviato."
          : "Errore nostro, non tuo: riprova tra poco.",
      ),
      code === "NOT_FOUND" ? 404 : 500,
    );
  })

  // ------------------------------------------------------------ indice demo
  .get("/", () => {
    const siti = allSlugs()
      .map((slug) => {
        const lead = loadLead(slug);
        return lead ? { slug, nome: String(lead.nome_attivita ?? slug) } : null;
      })
      .filter((s): s is { slug: string; nome: string } => s !== null);
    return html(indiceHtml(siti));
  })

  .get("/health", () => json({ status: "ok", service: "autolanding-v2", host: HOSTNAME_PUBBLICO }))

  // --------------------------------------------------- siti renderizzati
  .get("/sites/:slug/*", ({ params, request }) => {
    const slug = params.slug;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return html(erroreHtml("link non valido"), 404);
    const wildcard = new URL(request.url).pathname.replace(`/sites/${slug}/`, "");
    const sotto = wildcard === "" || wildcard.endsWith("/") ? `${wildcard}index.html` : wildcard;
    const file = fileStatico(`${slug}/${sotto}`);
    if (file === null) return html(erroreHtml("Pagina demo non trovata (o scaduta)."), 404);
    return new Response(file.body, {
      headers: { "Content-Type": file.type, "X-Content-Type-Options": "nosniff" },
    });
  })

  // --------------------------------------------------- pagine legali statiche
  .get("/privacy", () => html(paginaStatica("privacy.html") ?? erroreHtml("Privacy non disponibile in questo ambiente")))
  .get("/cookie", () => html(paginaStatica("cookie.html") ?? erroreHtml("Cookie policy non disponibile")))
  .get("/condizioni", () => html(paginaStatica("condizioni.html") ?? erroreHtml("Condizioni non disponibili")))

  // --------------------------------------------------- wizard completamento
  .get("/complete", ({ query }) => {
    const token = query.token ?? "";
    const lead = findLeadByToken(token);
    if (lead === null) {
      return html(
        erroreHtml("Questo link non è più valido (scaduto o revocato). Scrivici: te ne mandiamo uno nuovo."),
        403,
      );
    }
    const orari = Array.isArray(lead.orari)
      ? (lead.orari as Record<string, string>[])
          .map((o) => `${o.giorni ?? ""} ${o.apertura ?? ""}-${o.chiusura ?? ""}`.trim())
          .join("; ")
      : "";
    return html(wizardHtml({ ...lead, orari_compatti: orari }, token));
  })
  .post("/complete", ({ body, query }) => {
    const token = query.token ?? "";
    const lead = findLeadByToken(token);
    if (lead === null) return html(erroreHtml("Link non valido."), 403);
    const dati = (body ?? {}) as Record<string, string>;
    const whitelist = [
      "nome_attivita", "ragione_sociale", "indirizzo", "citta", "cap",
      "telefono", "email", "descrizione", "servizi", "orari", "fascia_prezzo",
    ];
    for (const campo of whitelist) {
      const valore = dati[campo];
      if (valore && valore.trim()) {
        if (campo === "servizi") {
          lead.servizi = valore.split(",").map((x) => x.trim()).filter(Boolean);
        } else if (campo === "orari") {
          lead.orari_compatti = valore.trim();
        } else {
          lead[campo] = valore.trim();
        }
      }
    }
    lead.completato_via = "web-v2";
    const stato = lead.stato_pipeline;
    try {
      if (["published", "contacted", "opened", "expired"].includes(stato)) {
        transition(lead, "completing", "wizard-web-v2", "il lead ha aperto il wizard");
        saveLead(lead);
      }
      if (!["completed", "pending_manual", "paid", "active"].includes(lead.stato_pipeline)) {
        transition(lead, "completed", "wizard-web-v2", "dati confermati dal wizard v2");
      } else {
        nota(lead, "wizard-web-v2", "dati aggiornati (già attivo)");
      }
      saveLead(lead);
    } catch (exc) {
      return html(erroreHtml(String(exc), `/complete?token=${token}`), 400);
    }
    logAttivita(lead.slug, "completamento", "web-v2");
    const payUrl = isPaid(lead) ? "" : `/pay?token=${token}`;
    return html(doneHtml(lead, payUrl, String(lead.live_url ?? "")));
  })

  // --------------------------------------------------- paywall + chiusura
  .get("/pay", ({ query }) => {
    const token = query.token ?? "";
    const lead = findLeadByToken(token);
    if (lead === null) return html(erroreHtml("Link non valido."), 403);
    if (!["completed", "pending_manual", "paid", "active"].includes(lead.stato_pipeline)) {
      return html(payNonProntoHtml(`/complete?token=${token}`));
    }
    if (isPaid(lead)) return html(pagatoHtml(lead, String(lead.live_url ?? "")));
    return html(
      paywallHtml(lead, token, VENDITORE.setup, VENDITORE.mensile, VENDITORE.iban, VENDITORE.ragione_sociale),
    );
  })
  .post("/pay", ({ body, query }) => {
    const token = query.token ?? "";
    const lead = findLeadByToken(token);
    if (lead === null) return html(erroreHtml("Link non valido."), 403);
    const metodo = ((body ?? {}) as Record<string, string>).metodo ?? "";
    if (metodo === "carta") {
      // mock-stripe: in questo ambiente non ci sono chiavi, il pagamento è simulato
      lead.pagato = {
        metodo: "carta",
        importo: String(VENDITORE.setup),
        data: new Date().toISOString(),
        rif: `cs_mock_${token.slice(0, 12)}`,
      };
      if (lead.stato_pipeline !== "paid" && lead.stato_pipeline !== "active") {
        transition(lead, "paid", "stripe-webhook-v2", `pagamento carta ${VENDITORE.setup}€ (mock)`);
      }
      marcaAttivo(lead);
      logAttivita(lead.slug, "pagamento", "carta-mock");
      return html(pagatoHtml(lead, String(lead.live_url ?? "")));
    }
    if (metodo === "bonifico") {
      if (lead.stato_pipeline === "completed") {
        transition(lead, "pending_manual", "pay-v2", "bonifico richiesto dal lead");
        saveLead(lead);
      }
      return html(bonificoHtml(lead, VENDITORE.iban, VENDITORE.ragione_sociale, lead.slug, VENDITORE.setup));
    }
    return html(erroreHtml("metodo non valido", `/pay?token=${token}`), 400);
  })

  // --------------------------------------------------- webhook Stripe
  .post("/stripe/webhook", ({ request, body }) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
    if (!secret) return json({ error: "webhook non configurato: impostare STRIPE_WEBHOOK_SECRET" }, 503);
    const firma = request.headers.get("Stripe-Signature") ?? "";
    const payload = String(body ?? "");
    if (!webhookFirmato(payload, firma)) return json({ error: "firma non valida" }, 400);
    try {
      const evento = JSON.parse(payload) as {
        type?: string;
        data?: { object?: { client_reference_id?: string; id?: string } };
      };
      if (!["checkout.session.completed", "invoice.paid", "payment_intent.succeeded"].includes(evento.type ?? "")) {
        return json({ ignorato: evento.type });
      }
      const slug = evento.data?.object?.client_reference_id;
      if (!slug) throw new Error("evento senza client_reference_id");
      const lead = loadLead(slug);
      if (lead === null) throw new Error(`lead sconosciuto: ${slug}`);
      if (!isPaid(lead)) {
        lead.pagato = {
          metodo: "carta",
          importo: String(VENDITORE.setup),
          data: new Date().toISOString(),
          rif: evento.data?.object?.id ?? "",
        };
        saveLead(lead);
      }
      if (lead.stato_pipeline !== "paid" && lead.stato_pipeline !== "active") {
        transition(lead, "paid", "stripe-webhook-v2", "pagamento confermato via webhook");
      }
      marcaAttivo(lead);
      logAttivita(slug, "pagamento", "stripe");
      return json({ received: true, slug, stato: lead.stato_pipeline });
    } catch (exc) {
      return json({ error: String(exc) }, 400);
    }
  })

  // --------------------------------------------------- optout (GET conferma, POST agisce)
  .get("/optout", ({ query }) => {
    const lead = findLeadByToken(query.token ?? "");
    if (lead === null) return html(erroreHtml("Token sconosciuto."), 404);
    return html(optoutConfirmHtml(query.token ?? ""));
  })
  .post("/optout", ({ query }) => {
    const lead = findLeadByToken(query.token ?? "");
    if (lead === null) return html(erroreHtml("Token sconosciuto."), 404);
    lead.suppression = true;
    if (["published", "contacted", "opened"].includes(lead.stato_pipeline)) {
      saveLead(lead);
      transition(lead, "refused", "optout", "opt-out confermato: suppression permanente");
    } else {
      nota(lead, "optout", "suppression permanente");
    }
    saveLead(lead);
    logAttivita(lead.slug, "optout", "email");
    return html(optoutHtml());
  })

  // --------------------------------------------------- tracking click onesto
  .get("/go", ({ query, set }) => {
    const slug = query.slug ?? "";
    const lead = loadLead(slug);
    if (lead === null || !lead.live_url) return html(erroreHtml("link non valido"), 404);
    logAttivita(slug, "click_demo", (query.m ?? "").slice(0, 12));
    set.redirect = String(lead.live_url);
  })

  // --------------------------------------------------- sync dall'engine locale
  .post("/api/sync", ({ request, body }) => {
    if (!syncAutorizzato(request)) {
      return json({ error: "non autorizzato" }, SYNC_TOKEN ? 401 : 503);
    }
    const files = ((body as { files?: { path: string; content_b64?: string }[] })?.files ?? []) as {
      path: string;
      content_b64?: string;
    }[];
    let scritti = 0;
    for (const f of files) {
      const pieno = safeSyncPath(f.path);
      if (pieno === null || typeof f.content_b64 !== "string") continue;
      mkdirSync(normalize(pieno.replace(/\/[^/]*$/, "")), { recursive: true });
      writeFileSync(pieno, Buffer.from(f.content_b64, "base64"));
      scritti += 1;
    }
    logAttivita("sync", "push", `${scritti} file`);
    return json({ ok: true, scritti });
  })
  .get("/api/sync/lead", ({ request, query }) => {
    if (!syncAutorizzato(request)) {
      return json({ error: "non autorizzato" }, SYNC_TOKEN ? 401 : 503);
    }
    const pieno = safeSyncPath(query.path ?? "");
    if (pieno === null || !existsSync(pieno)) return json({ error: "path non valido" }, 404);
    return new Response(readFileSync(pieno), {
      headers: { "Content-Type": "text/yaml; charset=utf-8" },
    });
  })
  .get("/api/sync/changes", ({ request, query }) => {
    if (!syncAutorizzato(request)) {
      return json({ error: "non autorizzato" }, SYNC_TOKEN ? 401 : 503);
    }
    const soglia = query.since ?? "";
    const cambiati = allSlugs()
      .map((slug) => {
        const p = join(dataDir(), "leads", slug, "lead.yaml");
        return existsSync(p) ? { slug, modified: statSync(p).mtime.toISOString() } : null;
      })
      .filter((x): x is { slug: string; modified: string } => x !== null)
      .filter((x) => !soglia || x.modified > soglia);
    return json({ changed: cambiati });
  });

app.listen(PORT);
console.log(`[autolanding-v2] in ascolto su :${PORT} (data: ${dataDir()}, pubblico: ${HOSTNAME_PUBBLICO})`);
