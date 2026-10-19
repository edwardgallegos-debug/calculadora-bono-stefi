// Lectores de las tablas HTML del SII (funciones puras, con prueba en tests/sii.test.mjs).
export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const num = t => parseFloat(t.replace(/\./g, "").replace(",", "."));

// --- Fuente 1: tablas oficiales del SII ---
// UF: <div id='mes_octubre'> ... <th><strong>31</strong></th><td>41.247,63</td>
export function ufDesdeSii(html, mes, dia) {
  const i = html.search(new RegExp(`id=['"]mes_${MESES[mes - 1]}['"]`));
  if (i < 0) return null;
  const resto = html.slice(i + 10);
  const k = resto.search(/class=['"]meses['"]/);
  const bloque = k < 0 ? resto : resto.slice(0, k);
  const re = /<th[^>]*>\s*<strong>(\d+)<\/strong>\s*<\/th>\s*<td[^>]*>\s*([\d.,]*)\s*<\/td>/g;
  let m;
  while ((m = re.exec(bloque))) if (Number(m[1]) === dia) return m[2] ? num(m[2]) : null;
  return null;
}
// UTM: <th>Octubre</th><td>72.151</td>
export function utmDesdeSii(html, mes) {
  const nombre = MESES[mes - 1];
  const m = html.match(new RegExp(`<th[^>]*>\\s*${nombre}\\s*</th>\\s*<td[^>]*>\\s*([\\d.]+)\\s*</td>`, "i"));
  return m ? num(m[1]) : null;
}

