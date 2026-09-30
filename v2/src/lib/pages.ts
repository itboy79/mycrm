// lib/pages.ts — pagine HTML server-side del wizard e del paywall (v2 nibrun).
// Stessa copia amica e design neutro del venditore (blue #1E4E79) delle pagine Python;
// mobile-first, target touch ≥ 48px, focus visibile, zero tracking.

const STILE = `<style>
:root{--blu:#1E4E79;--blu-scuro:#16405F;--ink:#22303C;--grigio:#5A6B7A;--carta:#fff;
--fondo:#F4F6F8;--bordo:#C9D3DC;--r:12px}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
background:var(--fondo);color:var(--ink);line-height:1.55}
main{max-width:34rem;margin:0 auto;padding:0 1rem}
.card{background:var(--carta);border:1px solid var(--bordo);border-radius:var(--r);
padding:1.6rem;margin:1.5rem auto;box-shadow:0 2px 10px rgba(20,40,60,.06)}
h1{font-size:1.3rem;margin:0 0 1rem}h2{font-size:1.05rem;margin:1.4rem 0 .6rem}
p{margin:0 0 .9rem}a{color:var(--blu)}
.help{color:var(--grigio);font-size:.9rem}
label{display:block;font-weight:600;margin:.9rem 0 .25rem}
input,textarea{width:100%;font:inherit;padding:.65rem;min-height:44px;border:1px solid #A08C6F;
border-radius:8px;background:#fff}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;width:100%;
padding:.7rem 1.4rem;border-radius:8px;font-size:1rem;font-weight:600;text-decoration:none;
cursor:pointer;border:1px solid transparent;margin-top:.7rem}
.btn--primary{background:var(--blu);color:#fff}.btn--primary:hover{background:var(--blu-scuro)}
.btn--secondary{background:#fff;color:var(--blu);border-color:var(--blu)}
code{background:var(--fondo);border:1px solid var(--bordo);border-radius:6px;padding:.1rem .4rem;
word-break:break-all}
.ok{background:#EAF4EE;border:1px solid #BFDCCB;border-radius:8px;padding:.9rem;margin-bottom:.9rem}
.warn{background:#FBF3E4;border:1px solid #E5D3A8;border-radius:8px;padding:.9rem;margin-bottom:.9rem}
.err{background:#F9ECEA;border:1px solid #E0B7B0;border-radius:8px;padding:.9rem;margin-bottom:.9rem}
:focus-visible{outline:3px solid #8A6420;outline-offset:2px}
footer{max-width:34rem;margin:1.5rem auto;padding:1rem;color:var(--grigio);font-size:.85rem;text-align:center}
</style>`;

function pagina(titolo: string, corpo: string): string {
  return `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${titolo}</title>${STILE}</head><body>
<a class="skip-link" href="#contenuto" style="position:absolute;left:-9999px">Salta al contenuto</a>
<main>${corpo}</main>
<footer><a href="/privacy">Privacy</a> · <a href="/condizioni">Condizioni</a></footer>
</body></html>`;
}

export function wizardHtml(
  lead: Record<string, unknown>,
  token: string,
  msg: string = "",
): string {
  const v = (k: string) => String(lead[k] ?? "");
  return pagina(
    `Completa i dati — ${v("nome_attivita")}`,
    `<div class="card">
  <h1>Conferma i dati della tua pagina</h1>
  <p class="help">Due minuti e il sito è a posto. Puoi correggere tutto ciò che vuoi.</p>
  ${msg ? `<div class="err">${msg}</div>` : ""}
  <form method="post" action="/complete?token=${token}">
    <label for="f-nome">Nome attività</label>
    <input id="f-nome" name="nome_attivita" value="${v("nome_attivita")}" required>
    <label for="f-ragione">Ragione sociale</label>
    <input id="f-ragione" name="ragione_sociale" value="${v("ragione_sociale")}">
    <label for="f-indirizzo">Indirizzo</label>
    <input id="f-indirizzo" name="indirizzo" value="${v("indirizzo")}">
    <label for="f-citta">Città</label>
    <input id="f-citta" name="citta" value="${v("citta")}">
    <label for="f-cap">CAP</label>
    <input id="f-cap" name="cap" value="${v("cap")}" inputmode="numeric">
    <label for="f-telefono">Telefono</label>
    <input id="f-telefono" name="telefono" type="tel" value="${v("telefono")}">
    <label for="f-email">Email</label>
    <input id="f-email" name="email" type="email" value="${v("email")}">
    <label for="f-servizi">Servizi (separati da virgola)</label>
    <input id="f-servizi" name="servizi" value="${Array.isArray(lead.servizi) ? (lead.servizi as string[]).join(", ") : v("servizi")}">
    <label for="f-orari">Orari</label>
    <input id="f-orari" name="orari" value="${v("orari_compatti")}">
    <p class="help">Es. «mar-dom 12:00-14:30, 19:00-22:30; lun chiuso»</p>
    <label for="f-descrizione">Descrizione</label>
    <textarea id="f-descrizione" name="descrizione" rows="4">${v("descrizione")}</textarea>
    <button class="btn btn--primary" type="submit">Conferma e aggiorna</button>
  </form>
  <p class="help" style="margin-top:.9rem">Non hai più il link per tornare qui? Rispondi a una delle nostre email.</p>
</div>`,
  );
}

export function doneHtml(lead: Record<string, unknown>, payUrl: string, liveUrl: string): string {
  const nome = String(lead.nome_attivita ?? "");
  return pagina(
    `Fatto! — ${nome}`,
    `<div class="card">
  <h1>Fatto! I dati sono aggiornati</h1>
  <div class="ok"><p>Grazie: la pagina online viene aggiornata con le tue conferme.</p></div>
  ${liveUrl ? `<p><a class="btn btn--secondary" href="${liveUrl}">Guarda il tuo sito</a></p>` : ""}
  ${payUrl ? `<h2>Un ultimo passo, se vuoi</h2>
  <p>Per tenere il sito attivo: <strong>99€ una volta sola</strong>, poi 19€ al mese. Disdici quando vuoi.</p>
  <a class="btn btn--primary" href="${payUrl}">Attiva il tuo sito</a>` : ""}
  <p class="help">Conserva l'email con il link a questa pagina: è il tuo pannello di controllo.</p>
</div>`,
  );
}

export function paywallHtml(
  lead: Record<string, unknown>,
  token: string,
  setup: number,
  mensile: number,
  iban: string,
  intestatario: string,
): string {
  const slug = String(lead.slug ?? "");
  return pagina(
    `Attiva il tuo sito — ${lead.nome_attivita}`,
    `<div class="card">
  <h1>Attiva il tuo sito</h1>
  <p>La pagina è pronta e completa: per tenerla attiva</p>
  <p><strong>${setup}€ una volta sola</strong> (setup) + <strong>${mensile}€ al mese</strong>, tutto compreso. Disdici quando vuoi.</p>
  <h2>Paga con carta (consigliato)</h2>
  <form method="post" action="/pay?token=${token}">
    <input type="hidden" name="metodo" value="carta">
    <button class="btn btn--primary" type="submit">Paga ${setup}€ con carta</button>
  </form>
  <h2>Oppure con bonifico</h2>
  <form method="post" action="/pay?token=${token}">
    <input type="hidden" name="metodo" value="bonifico">
    <button class="btn btn--secondary" type="submit">Voglio pagare con bonifico</button>
  </form>
  <p class="help">IBAN: <code>${iban}</code> · Intestatario: ${intestatario} · Causale: <code>${slug}</code></p>
  <p class="help">La disdetta è sempre possibile a fine periodo pagato, e a fine rapporto il sito è tuo: te lo consegniamo in export.</p>
</div>`,
  );
}

export function bonificoHtml(
  lead: Record<string, unknown>,
  iban: string,
  intestatario: string,
  causale: string,
  setup: number,
): string {
  return pagina(
    `Bonifico — ${lead.nome_attivita}`,
    `<div class="card">
  <h1>Bonifico: i dati per pagare</h1>
  <div class="warn"><p>Il sito resta online e visibile: appena il bonifico arriva (1-2 giorni lavorativi), attiviamo tutto e ti mandiamo la fattura.</p></div>
  <dl>
    <dt>IBAN</dt><dd><code>${iban}</code></dd>
    <dt>Intestatario</dt><dd>${intestatario}</dd>
    <dt>Importo</dt><dd>${setup}€ — una volta sola</dd>
    <dt>Causale</dt><dd><code>${causale}</code> — <em>importante: scrivila per intero</em></dd>
  </dl>
  <p class="help">Questi dati restano su questa pagina finché non sei attivo.</p>
</div>`,
  );
}

export function pagatoHtml(lead: Record<string, unknown>, liveUrl: string): string {
  return pagina(
    `Benvenuto a bordo — ${lead.nome_attivita}`,
    `<div class="card">
  <h1>Benvenuto a bordo 🎉</h1>
  <div class="ok"><p>Pagamento ricevuto: il sito di <strong>${lead.nome_attivita}</strong> è attivo.</p></div>
  ${liveUrl ? `<p><a class="btn btn--primary" href="${liveUrl}">Apri il tuo sito</a></p>` : ""}
  <h2>Cosa succede ora</h2>
  <p>• Fattura del setup entro 24 ore<br>• Ogni mese: 19€, addebito automatico<br>• Modifiche future dal link che hai già</p>
  <p class="help">Domande? Rispondi a una delle nostre email: risponde una persona.</p>
</div>`,
  );
}

export function payNonProntoHtml(completeUrl: string): string {
  return pagina(
    "Prima il sito, poi il prezzo",
    `<div class="card">
  <h1>Prima il sito, poi il prezzo</h1>
  <p>L'offerta si sblocca dopo la conferma dei tuoi dati: due minuti, poi vedi tutto — prezzo compreso.</p>
  <a class="btn btn--primary" href="${completeUrl}">Completa i dati (2 minuti)</a>
</div>`,
  );
}

export function erroreHtml(messaggio: string, tornaUrl?: string): string {
  return pagina(
    "Da correggere",
    `<div class="card">
  <h1>${tornaUrl ? "Un attimo: un dato da correggere" : "Non trovato"}</h1>
  <div class="err"><p>${messaggio}</p></div>
  ${tornaUrl ? `<a class="btn btn--primary" href="${tornaUrl}">Torna indietro</a>` : `<p>Se vieni da una nostra email, riaprila e usa il link: dura tutto il periodo della demo.</p>`}
</div>`,
  );
}

export function optoutConfirmHtml(token: string): string {
  return pagina(
    "Conferma disiscrizione",
    `<div class="card">
  <h1>Confermi la disiscrizione?</h1>
  <p>Non riceveremo più nessun messaggio e la pagina demo verrà disattivata.</p>
  <form method="post" action="/optout?token=${token}">
    <button class="btn btn--primary" type="submit">Sì, disiscrivimi</button>
  </form>
  <p class="help" style="margin-top:.9rem"><a href="/">Annulla e torna indietro</a></p>
</div>`,
  );
}

export function optoutHtml(): string {
  return pagina(
    "Non ti scriviamo più",
    `<div class="card">
  <h1>Ricevuto: non ti scriviamo più</h1>
  <div class="ok"><p>Rimosso subito e per sempre dalla nostra lista.</p></div>
  <p class="help">Se cambi idea in futuro, ci trovi qui: <a href="/">AutoLanding</a>.</p>
</div>`,
  );
}

export function indiceHtml(siti: { slug: string; nome: string }[]): string {
  const righe = siti
    .map(
      (s) =>
        `<li style="margin:.4rem 0"><a href="/sites/${s.slug}/">${s.nome || s.slug}</a></li>`,
    )
    .join("");
  return pagina(
    "AutoLanding — pagine demo",
    `<div class="card">
  <h1>AutoLanding — pagine demo</h1>
  <p>Le pagine dimostrative preparete per le attività di questo ambiente.</p>
  <ul style="padding-left:1.2rem">${righe}</ul>
  <p class="help">Le demo sono online 14 giorni e non indicizzate su Google.</p>
</div>`,
  );
}

// --------------------------------------------------------------- storefront
export function storefrontHtml(
  siti: { slug: string; nome: string; citta: string; verticale: string; stato: string }[],
  setup: number,
  mensile: number,
): string {
  const badgeVerticale: Record<string, string> = {
    ristorazione: "🍽 Ristorazione",
    saloni: "✂️ Saloni",
    artigiani: "🔧 Artigiani",
  };
  const schede = siti
    .map((s) => {
      const attivo = s.stato === "active" || s.stato === "paid";
      return `<article class="scheda">
  <div class="scheda-testa">
    <span class="badge-v">${badgeVerticale[s.verticale] ?? s.verticale}</span>
    <span class="citta">${s.citta}</span>
  </div>
  <h3>${s.nome}</h3>
  <div class="scheda-azioni">
    <a class="mini-btn" href="/sites/${s.slug}/">Apri la demo</a>
    ${attivo
      ? `<span class="già">✓ già attivo</span>`
      : `<a class="mini-btn mini-btn--buy" href="/acquista/${s.slug}">Acquista questa pagina</a>`}
  </div>
</article>`;
    })
    .join("\n");

  return pagina2(
    "AutoLanding — il tuo sito è già pronto",
    `<header class="hero-m">
  <h1>Il tuo sito è già online.<br>Te lo facciamo trovare.</h1>
  <p class="lead-m">Costruiamo in anticipo la pagina web delle attività della tua zona:
  sito vero, in <strong>italiano e inglese</strong>, con orari, mappa, menu o servizi e contatti.
  Se è la tua, la attivi in due minuti.</p>
  <div class="prezzo">
    <div><strong>${setup}€</strong> una volta sola (setup)</div>
    <div><strong>${mensile}€/mese</strong> tutto compreso · disdici quando vuoi</div>
  </div>
</header>
<section class="sezione-m">
  <h2>Pagine pronte in questa zona</h2>
  <p class="help">Ogni pagina è costruita sui dati pubblici dell'attività. La vedi prima di pagare: se non ti piace, non compri niente.</p>
  <div class="griglia-schede">${schede || "<p>Nessuna pagina demo al momento: torna a trovarci.</p>"}</div>
</section>
<section class="sezione-m sezione-m--alt">
  <h2>Come funziona</h2>
  <ol class="passi">
    <li><strong>Trova la tua pagina</strong> nell'elenco (o apri il link che ti abbiamo mandato)</li>
    <li><strong>Conferma i dati in 2 minuti</strong> dal telefono: nome, orari, servizi, foto</li>
    <li><strong>Attivi: 99€ + 19€/mese</strong> — sito online, indicizzato su Google, fattura regolare</li>
  </ol>
  <p class="help">Siti semplici e onesti: una pagina che fa il suo lavoro, non un cantiere. A fine rapporto te lo consegniamo in export: resta tuo.</p>
</section>
<section class="sezione-m">
  <h2>Domande frequenti</h2>
  <p><strong>È una truffa? Come fate a conoscere la mia attività?</strong><br>
  I dati della demo vengono da fonti pubbliche (schede, directory). Guarda la pagina: se qualcosa non torna, non pagare — scrivici e la correggiamo.</p>
  <p><strong>Perché così poco?</strong><br>
  Perché il sito lo costruisce un sistema automatico e lo controlla una persona: niente incontri, niente cantieri, una pagina che funziona.</p>
  <p><strong>Il sito resta mio?</strong><br>
  Sì. Le foto e i testi sono tuoi, e se vai via ricevi l'export completo della pagina.</p>
  <p><strong>E se smetto di pagare?</strong><br>
  Resta online fino a fine periodo pagato. Dopo 3 mensilità non incassate si sospende: lo riattivi saldando, senza penali.</p>
</section>
<section class="sezione-m sezione-m--cta">
  <h2>La tua attività non è nell'elenco?</h2>
  <p>Scrivici: costruiamo la pagina anche per te, la vedi prima di pagare. <a href="mailto:info@example-domain.it">info@example-domain.it</a></p>
</section>`,
  );
}

function pagina2(titolo: string, corpo: string): string {
  return `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titolo}</title><style>
:root{--blu:#1E4E79;--blu-scuro:#16405F;--ink:#22303C;--grigio:#5A6B7A;--carta:#fff;
--fondo:#F4F6F8;--bordo:#C9D3DC;--r:12px;--oro:#B9863C}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
background:var(--fondo);color:var(--ink);line-height:1.55}
main{max-width:62rem;margin:0 auto;padding:0 1rem}
h1{font-size:1.7rem;line-height:1.25;margin:0 0 .8rem}h2{font-size:1.25rem;margin:0 0 .8rem}
h3{margin:0 0 .5rem;font-size:1.05rem}p{margin:0 0 .9rem}a{color:var(--blu)}
.help{color:var(--grigio);font-size:.9rem}
.hero-m{background:linear-gradient(180deg,#fff, var(--fondo));padding:3rem 0 2rem;text-align:center}
.hero-m .lead-m{max-width:40rem;margin:0 auto 1.2rem;font-size:1.05rem}
.prezzo{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap}
.prezzo div{background:#fff;border:2px solid var(--blu);border-radius:var(--r);padding:.7rem 1.2rem}
.sezione-m{padding:2rem 0}
.sezione-m--alt{background:#fff;border-top:1px solid var(--bordo);border-bottom:1px solid var(--bordo)}
.sezione-m--cta{text-align:center;padding-bottom:3rem}
.griglia-schede{display:grid;grid-template-columns:repeat(auto-fill,minmax(16rem,1fr));gap:1rem}
.scheda{background:var(--carta);border:1px solid var(--bordo);border-radius:var(--r);padding:1.1rem;
display:flex;flex-direction:column;gap:.6rem}
.scheda-testa{display:flex;justify-content:space-between;align-items:center;font-size:.85rem;color:var(--grigio)}
.badge-v{background:#E3ECF2;color:var(--blu);border-radius:999px;padding:.15rem .6rem;font-weight:600}
.scheda-azioni{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-top:auto}
.mini-btn{display:inline-flex;align-items:center;min-height:40px;padding:.45rem .9rem;border-radius:8px;
border:1px solid var(--blu);color:var(--blu);text-decoration:none;font-weight:600;font-size:.9rem}
.mini-btn--buy{background:var(--blu);color:#fff}
.già{color:var(--grigio);font-size:.85rem}
.passi{padding-left:1.2rem}.passi li{margin-bottom:.7rem}
:focus-visible{outline:3px solid #8A6420;outline-offset:2px}
footer{max-width:62rem;margin:1.5rem auto;padding:1rem;color:var(--grigio);font-size:.85rem;text-align:center}
@media (max-width:500px){h1{font-size:1.35rem}.hero-m{padding:2rem 0 1.4rem}}
</style></head><body>
<main>${corpo}</main>
<footer>AutoLanding · <a href="/privacy">Privacy</a> · <a href="/cookie">Cookie</a> · <a href="/condizioni">Condizioni</a></footer>
</body></html>`;
}

export function acquistaHtml(
  lead: Record<string, unknown>,
  setup: number,
  mensile: number,
  iban: string,
  intestatario: string,
): string {
  const slug = String(lead.slug ?? "");
  const nome = String(lead.nome_attivita ?? slug);
  const attivo = String(lead.stato_pipeline) === "active" || String(lead.stato_pipeline) === "paid";
  return pagina2(
    `Acquista la pagina di ${nome}`,
    `<main><div class="card" style="max-width:40rem">
  <h1>${nome} — ${lead.citta ?? ""}</h1>
  ${attivo
    ? `<div class="ok"><p>Questa pagina è già attiva e online.</p></div>`
    : `<div class="warn"><p>Sei il titolare di <strong>${nome}</strong>? Questa pagina è stata costruita sui suoi dati pubblici ed è già online in anteprima. Se è tua, attivala: resta tua, con disdetta libera.</p></div>
  <p><a class="btn btn--secondary" href="/sites/${slug}/">Rivedi la pagina demo</a></p>
  <h2>Attiva ora: ${setup}€ + ${mensile}€/mese</h2>
  <p><strong>Paga con carta</strong> (attivazione immediata)</p>
  <form method="post" action="/acquista/${slug}">
    <input type="hidden" name="metodo" value="carta">
    <button class="btn btn--primary" type="submit">Paga ${setup}€ con carta</button>
  </form>
  <p style="margin-top:1rem"><strong>Oppure bonifico</strong> (1-2 giorni lavorativi)</p>
  <form method="post" action="/acquista/${slug}">
    <input type="hidden" name="metodo" value="bonifico">
    <button class="btn btn--secondary" type="submit">Paga con bonifico</button>
  </form>
  <p class="help" style="margin-top:.9rem">IBAN: <code>${iban}</code> · Intestatario: ${intestatario} · Causale: <code>${slug}</code></p>
  <p class="help">Dopo il pagamento: fattura entro 24h, il sito viene indicizzato su Google e ricevi il link per le modifiche future. Nota: per il primo contatto ti chiederemo di confermare la titolarità.</p>`}
</div></main>`,
  );
}
