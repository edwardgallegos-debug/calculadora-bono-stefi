// node tests/sii.test.mjs  — prueba los lectores con HTML del mismo formato que publica el SII.
import assert from "node:assert/strict";
import { ufDesdeSii, utmDesdeSii } from "../scripts/sii.mjs";

const celda = (d, v) => `<th width='40'><strong>${d}</strong></th>\n<td width='200'>${v}</td>`;
const mesUf = (nombre, titulo, valores) => `<div class='meses' id='mes_${nombre}'>\n<div class='table-responsive'>\n<table class='table table-hover table-bordered'>\n<tbody>\n   <tr>\n      <th colspan='6'><h2>${titulo}</h2></th>\n   </tr>\n` +
  valores.map(([d, v]) => `<tr>\n${celda(d, v)}\n</tr>`).join("\n") + "\n</tbody></table></div></div>\n";
const html = "<html>" + mesUf("noviembre", "Noviembre", [[1, "41.252,94"], [2, ""]]) +
  mesUf("octubre", "Octubre", [[1, "41.065,38"], [30, "41.242,32"], [31, "41.247,63"]]) +
  mesUf("septiembre", "Septiembre", [[30, "41.057,20"]]) + "</html>";

assert.equal(ufDesdeSii(html, 10, 31), 41247.63);
assert.equal(ufDesdeSii(html, 9, 30), 41057.2);
assert.equal(ufDesdeSii(html, 11, 2), null, "celda vacía = aún no publicado");
assert.equal(ufDesdeSii(html, 12, 31), null, "mes inexistente");

const utm = "<table><tr> <th>Septiembre</th> <td>71.721</td> <td>860.652</td></tr> <tr> <th>Octubre</th> <td>72.151</td> <td>865.812</td></tr> <tr> <th>Noviembre</th> <td>72.440</td></tr></table>";
assert.equal(utmDesdeSii(utm, 10), 72151);
assert.equal(utmDesdeSii(utm, 11), 72440);
assert.equal(utmDesdeSii(utm, 12), null);
console.log("sii.test.mjs: OK");
