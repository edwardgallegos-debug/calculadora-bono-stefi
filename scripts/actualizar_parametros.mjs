// Actualiza params.json con la UTM del mes y la UF del ÚLTIMO día del mes (la que usa la liquidación).
// Fuente principal: tablas oficiales del SII (sii.cl/valores_y_fechas); respaldo: mindicador.cl. Si todo falla, no se toca el archivo.
// Uso: node scripts/actualizar_parametros.mjs [AAAA-MM]   (sin argumento: mes actual en Punta Arenas)
import { readFileSync, writeFileSync } from "node:fs";
import { ufDesdeSii, utmDesdeSii } from "./sii.mjs";

const ARCHIVO = new URL("../params.json", import.meta.url);
const esperar = ms => new Promise(r => setTimeout(r, ms));

function periodoActual() {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Punta_Arenas", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return { periodo: f.slice(0, 7), hoy: f };
}

async function pedir(url, tipo, intentos = 4, timeoutMs = 30000) {
  let ultimo;
  for (let i = 1; i <= intentos; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { "User-Agent": "Mozilla/5.0 (compatible; stefi-calculator-actualizador)" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return tipo === "json" ? await r.json() : await r.text();
    } catch (e) { ultimo = e; console.log(`Intento ${i}/${intentos} falló para ${url}: ${e.message}`); await esperar(i * 3000); }
  }
  throw new Error("No se pudo leer " + url + ": " + ultimo.message);
}

async function valores(anio, mes, ultimoDia) {
  try {
    const uf = ufDesdeSii(await pedir(`https://www.sii.cl/valores_y_fechas/uf/uf${anio}.htm`, "texto"), mes, ultimoDia);
    const utm = utmDesdeSii(await pedir(`https://www.sii.cl/valores_y_fechas/utm/utm${anio}.htm`, "texto"), mes);
    if (uf && utm) return { uf, utm, fuente: "SII" };
    console.log("El SII no trae todavía ambos valores para el período.");
  } catch (e) { console.log("Fuente SII falló:", e.message); }
  // --- Fuente 2 (respaldo): mindicador.cl ---
  const dd = n => String(n).padStart(2, "0");
  const uf = (await pedir(`https://mindicador.cl/api/uf/${dd(ultimoDia)}-${dd(mes)}-${anio}`, "json", 2, 20000)).serie?.[0]?.valor;
  const utm = (await pedir(`https://mindicador.cl/api/utm/01-${dd(mes)}-${anio}`, "json", 2, 20000)).serie?.[0]?.valor;
  return { uf, utm, fuente: "mindicador" };
}

const arg = process.argv[2];
const { periodo: periodoHoy, hoy } = periodoActual();
const periodo = arg || periodoHoy;
if (!/^\d{4}-\d{2}$/.test(periodo)) throw new Error("Período inválido: " + periodo);
const [anio, mes] = periodo.split("-").map(Number);
const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
const { uf, utm, fuente } = await valores(anio, mes, ultimoDia);
console.log(`Fuente: ${fuente}. UF ${ultimoDia}/${mes}: ${uf}. UTM ${mes}/${anio}: ${utm}`);
if (!(uf > 30000 && uf < 80000)) throw new Error("UF fuera de rango o ausente: " + uf);
if (!(utm > 50000 && utm < 120000)) throw new Error("UTM fuera de rango o ausente: " + utm);

const actual = JSON.parse(readFileSync(ARCHIVO, "utf8"));
for (const [nom, nuevo, viejo] of [["UF", uf, actual.uf], ["UTM", utm, actual.utm]]) {
  if (Math.abs(nuevo / viejo - 1) > 0.03) throw new Error(`${nom} cambió más de 3 %: ${viejo} -> ${nuevo}. Revise a mano.`);
}
if (periodo < actual.periodo) { console.log("El período pedido es anterior al del archivo; no se cambia nada."); process.exit(0); }
if (actual.periodo === periodo && actual.uf === uf && actual.utm === utm) { console.log("Sin cambios: " + JSON.stringify(actual)); process.exit(0); }

const nuevo = { periodo, uf, utm, actualizado: hoy };
writeFileSync(ARCHIVO, JSON.stringify(nuevo, null, 2) + "\n");
console.log("Actualizado:", JSON.stringify(nuevo));
