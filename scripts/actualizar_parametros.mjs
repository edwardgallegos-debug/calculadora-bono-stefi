// Actualiza params.json con la UTM del mes y la UF del ÚLTIMO día del mes (la que usa la liquidación).
// Fuente principal: tablas oficiales del SII (sii.cl/valores_y_fechas); respaldo: mindicador.cl. Si todo falla, no se toca el archivo.
// Uso: node scripts/actualizar_parametros.mjs [AAAA-MM]   (sin argumento: mes actual en Punta Arenas)
import { readFileSync, writeFileSync } from "node:fs";
import { ufDesdeSii, utmDesdeSii } from "./sii.mjs";

// Error que SÍ amerita que el job termine en "failure" (y por lo tanto notifique a Edward):
// indica una anomalía real, no una espera normal. Todo lo demás (red caída, timeout, dato aún
// no publicado por el SII/mindicador) se registra en el log y el job termina en éxito (exit 0),
// sin tocar params.json, para reintentar en la próxima ejecución programada.
class AlertaReal extends Error {}

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

try {
  const { uf, utm, fuente } = await valores(anio, mes, ultimoDia);
  console.log(`Fuente: ${fuente}. UF ${ultimoDia}/${mes}: ${uf}. UTM ${mes}/${anio}: ${utm}`);
  // El SII (y mindicador, su espejo) publican la UF día a día dentro del mes, no el mes completo
  // por adelantado: es normal que a inicios de mes la UF del último día aún no exista en ninguna
  // fuente todavía.
  if (uf == null || Number.isNaN(uf) || utm == null || Number.isNaN(utm)) {
    console.log("Aún no está publicada la UF y/o UTM de este período. Se reintentará en la próxima ejecución programada.");
    process.exit(0);
  }
  // A partir de aquí SÍ tenemos un valor numérico: si está fuera de rango plausible, es señal de
  // un problema real (cambio de formato en la fuente, dato corrupto, etc.) y debe alertar.
  if (!(uf > 30000 && uf < 80000)) throw new AlertaReal("UF fuera de rango: " + uf);
  if (!(utm > 50000 && utm < 120000)) throw new AlertaReal("UTM fuera de rango: " + utm);

  const actual = JSON.parse(readFileSync(ARCHIVO, "utf8"));
  for (const [nom, nuevo, viejo] of [["UF", uf, actual.uf], ["UTM", utm, actual.utm]]) {
    if (Math.abs(nuevo / viejo - 1) > 0.03) throw new AlertaReal(`${nom} cambió más de 3 %: ${viejo} -> ${nuevo}. Revise a mano.`);
  }
  if (periodo < actual.periodo) { console.log("El período pedido es anterior al del archivo; no se cambia nada."); process.exit(0); }
  if (actual.periodo === periodo && actual.uf === uf && actual.utm === utm) { console.log("Sin cambios: " + JSON.stringify(actual)); process.exit(0); }

  const nuevo = { periodo, uf, utm, actualizado: hoy };
  writeFileSync(ARCHIVO, JSON.stringify(nuevo, null, 2) + "\n");
  console.log("Actualizado:", JSON.stringify(nuevo));
} catch (e) {
  if (e instanceof AlertaReal) throw e; // anomalía real: sí debe fallar el job y notificar
  // Cualquier otro problema (red caída, timeout, HTML del SII con formato distinto al esperado,
  // etc.) no es motivo para alarmar cada día: se registra y se reintenta en la próxima corrida.
  console.log("No fue posible obtener los valores esta vez (" + e.message + "). Se reintentará en la próxima ejecución programada.");
}
// Última verificación de extremo a extremo: 2026-10-19
