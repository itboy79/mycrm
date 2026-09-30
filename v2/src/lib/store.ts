// lib/store.ts — lettura/scrittura lead.yaml su disco persistente (nibrun /app/data).
// Contratto dati identico all'engine Python (wiki/leads/README.md): stessa fonte, stessi stati.
import { parse, stringify } from "yaml";
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { timingSafeEqual } from "node:crypto";

export function dataDir(): string {
  return (
    process.env.AUTOLANDING_DATA ||
    process.env.NIBRUN_DATA_DIR ||
    "./data"
  );
}

export type Lead = Record<string, unknown> & {
  slug: string;
  stato_pipeline: string;
};

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export function leadPath(slug: string): string {
  if (!SLUG_RE.test(slug)) throw new Error(`slug non valido: ${slug}`);
  return join(dataDir(), "leads", slug, "lead.yaml");
}

export function loadLead(slug: string): Lead | null {
  const p = leadPath(slug);
  if (!existsSync(p)) return null;
  const raw = parse(readFileSync(p, "utf8")) as Lead;
  raw.slug = slug;
  raw.stato_pipeline ||= "new";
  return raw;
}

export function saveLead(lead: Lead): void {
  const p = leadPath(lead.slug);
  mkdirSync(dirname(p), { recursive: true });
  // history append già fatta dal chiamante come riga nel lead (contratto engine)
  writeFileSync(p, stringify(lead), "utf8");
}

export function allSlugs(): string[] {
  const dir = join(dataDir(), "leads");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => SLUG_RE.test(name) && name !== "_fixtures");
}

export function findLeadByToken(token: string): Lead | null {
  if (!token) return null;
  const t = Buffer.from(token);
  for (const slug of allSlugs()) {
    const lead = loadLead(slug);
    const registrato = String((lead?.token_completa as string) ?? "");
    if (
      registrato &&
      registrato.length === t.length &&
      timingSafeEqual(Buffer.from(registrato), t)
    ) {
      return lead;
    }
  }
  return null;
}

const ALLOWED: Record<string, string[]> = {
  new: ["scouted", "invalid"],
  scouted: ["enriched", "invalid", "enrichment_partial"],
  enrichment_partial: ["enriched", "invalid"],
  enriched: ["generated", "invalid"],
  generated: ["approved", "regenerate", "invalid"],
  regenerate: ["generated", "invalid"],
  approved: ["published", "invalid"],
  published: ["contacted", "opened", "completing", "expired"],
  contacted: ["opened", "completing", "refused", "bounced", "expired"],
  opened: ["completing", "refused", "bounced", "expired"],
  completing: ["completed", "refused", "bounced", "expired"],
  completed: ["paid", "pending_manual", "expired"],
  pending_manual: ["paid", "expired"],
  paid: ["active"],
  active: ["suspended", "churned"],
  expired: ["completing", "paid"],
};

export function transition(lead: Lead, nuovo: string, autore: string, nota: string): void {
  const corrente = lead.stato_pipeline;
  if (nuovo === corrente) return;
  if (!(ALLOWED[corrente] ?? []).includes(nuovo)) {
    throw new Error(`transizione non valida ${JSON.stringify(corrente)} -> ${JSON.stringify(nuovo)}`);
  }
  lead.stato_pipeline = nuovo;
  (lead.history ||= []).push({
    stato: nuovo,
    data: new Date().toISOString(),
    autore,
    nota,
  });
}

export function isPaid(lead: Lead): boolean {
  const pagato = (lead.pagato ?? {}) as Record<string, unknown>;
  return Boolean(pagato.metodo);
}

/** Aggiunge una riga history senza cambiare stato (operazioni non-transition). */
export function nota(lead: Lead, autore: string, testo: string): void {
  (lead.history ||= []).push({
    stato: lead.stato_pipeline,
    data: new Date().toISOString(),
    autore,
    nota: testo,
  });
}

/** Percorsi dentro data/ che l'endpoint di sync può scrivere (whitelist, RS-01-style). */
export function safeSyncPath(rel: string): string | null {
  const pulito = rel.replace(/\\/g, "/");
  if (pulito.startsWith("/") || pulito.includes("..")) return null;
  const ok =
    pulito.startsWith("leads/") ||
    pulito.startsWith("sites/") ||
    pulito.startsWith("static/");
  if (!ok) return null;
  const pieno = resolve(join(dataDir(), pulito));
  const root = resolve(dataDir());
  return pieno.startsWith(root + "/") ? pieno : null;
}

/** lead.yaml modificati dopo una data ISO (per il pull dell'engine locale). */
export function changedLeadsSince(since: string): { path: string; modified: string }[] {
  const dir = join(dataDir(), "leads");
  const out: { path: string; modified: string }[] = [];
  const soglia = Date.parse(since);
  if (Number.isNaN(soglia)) return out;
  for (const slug of allSlugs()) {
    const p = join(dir, slug, "lead.yaml");
    if (!existsSync(p)) continue;
    const m = statSync(p).mtime.toISOString();
    if (Date.parse(m) > soglia) out.push({ path: `leads/${slug}/lead.yaml`, modified: m });
  }
  return out;
}
