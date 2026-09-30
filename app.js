/* Interfaz de la Calculadora de Bono Stefi. La lógica de cálculo está en motor.js. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const CLAVE_PARAMS = "bonoStefi.params.v1";
  const CLAVE_PREV = "bonoStefi.prev.v1";

  // ---------- almacenamiento (puede fallar en modo privado: la app funciona igual) ----------
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  const leer = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };

  // ---------- formato chileno ----------
  const miles = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const clp = n => (n < 0 ? "−$" : "$") + miles(Math.abs(n));
  const signo = (s, n) => s + " " + clp(Math.abs(n));
  const soloDigitos = s => (s || "").replace(/\D/g, "");
  const numero = s => { const d = soloDigitos(s); return d ? parseInt(d, 10) : 0; };
  const decimal = s => { const t = (s || "").trim().replace(/\./g, "").replace(",", "."); const v = parseFloat(t); return isFinite(v) ? v : 0; };
  const fmtDec = n => String(n).replace(".", ",");

  // ---------- parámetros ----------
  let P = Motor.parametrosDefecto();
  const guardados = leer(CLAVE_PARAMS);
  if (guardados) {
    for (const k of Object.keys(guardados)) {
      if (k === "afps") Object.assign(P.afps, guardados.afps);
      else if (k in P && k !== "tramos") P[k] = guardados[k];
    }
  }
  const CAMPOS = [
    ["uf", "UF ($)", "dec"], ["utm", "UTM ($)", "dec"], ["imm", "Ingreso mínimo ($)", "int"],
    ["tope_afp_uf", "Tope AFP/Salud (UF)", "dec"], ["tope_ces_uf", "Tope cesantía (UF)", "dec"],
    ["cot_afp", "Cotización AFP (%)", "dec"], ["cot_salud", "Cotización salud (%)", "dec"],
    ["ces_trab_indef", "Cesantía trabajador (%)", "dec"], ["grat_pct", "Gratificación (%)", "dec"],
    ["grat_tope_imm", "Tope grat. (veces IMM)", "dec"], ["ccaf_pct", "CCAF informativo (%)", "dec"],
    ["grado1a", "Tope zona: grado 1-A ($, opcional)", "int"],
    ["ces_emp_indef", "Cesantía empleador indef. (%)", "dec"], ["ces_emp_fijo", "Cesantía empleador fijo (%)", "dec"],
    ["mutual_pct", "Mutualidad (%)", "dec"], ["aporte_reforma_pct", "Aporte reforma (%)", "dec"], ["sis_pct", "SIS aparte (%)", "dec"],
  ];

  function pintarPie() {
    $("pPeriodo").textContent = P.periodo;
    $("pUf").textContent = "$" + P.uf.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    $("pUtm").textContent = "$" + miles(P.utm);
  }

  function llenarAfps() {
    const sel = $("afp"), actual = sel.value;
    sel.innerHTML = "";
    Object.keys(P.afps).sort().forEach(n => { const o = document.createElement("option"); o.value = o.textContent = n; sel.appendChild(o); });
    sel.value = P.afps[actual] !== undefined ? actual : "Modelo";
  }

  // ---------- campos numéricos con separador de miles ----------
  function conMiles(el) {
    el.addEventListener("input", () => {
      const d = soloDigitos(el.value);
      el.value = d ? miles(parseInt(d, 10)) : "";
    });
  }
  ["liquido", "aumento", "noimp", "desc"].forEach(id => conMiles($(id)));

  // ---------- previsión guardada ----------
  function leerPrevision() {
    return { afp: $("afp").value, salud_tipo: $("salud").value, plan_uf: decimal($("plan").value), contrato: $("contrato").value,
             zona_pct: decimal($("zona").value), zona_tope: null, adicional_tope: null, jubilado: $("jub").checked };
  }
  function guardarPrevision() {
    guardar(CLAVE_PREV, { afp: $("afp").value, salud: $("salud").value, plan: $("plan").value, contrato: $("contrato").value,
                          zona: $("zona").value, jub: $("jub").checked, conGrat: $("conGrat").checked });
  }
  function cargarPrevision() {
    const s = leer(CLAVE_PREV);
    $("zona").value = fmtDec(98);
    if (!s) return;
    if (s.afp && P.afps[s.afp] !== undefined) $("afp").value = s.afp;
    $("salud").value = s.salud || "fonasa"; $("plan").value = s.plan || "";
    $("contrato").value = s.contrato || "indef"; $("zona").value = s.zona !== undefined ? s.zona : fmtDec(98);
    $("jub").checked = !!s.jub; $("conGrat").checked = s.conGrat !== false;
  }
  function actualizarSalud() { $("planWrap").hidden = $("salud").value !== "isapre"; }
  function actualizarAyuda() {
    $("gratAyuda").textContent = $("conGrat").checked
      ? "El sistema suma la gratificación sobre el bono, por eso el bono a ingresar es menor."
      : "El bono no genera gratificación: se ingresa el monto bruto completo.";
  }

  // ---------- resultado ----------
  let ultimo = null;
  function fila(tbody, texto, monto, clase) {
    const tr = document.createElement("tr");
    if (clase) tr.className = clase;
    const a = document.createElement("td"), b = document.createElement("td");
    a.textContent = texto; b.textContent = monto;
    tr.append(a, b); tbody.appendChild(tr);
  }
  function pintar(r) {
    ultimo = r;
    const con = $("conGrat").checked;
    const o = con ? r.con_grat : r.sin_grat, otra = con ? r.sin_grat : r.con_grat;
    const ok = Math.abs(o.diferencia) <= 1;
    $("modo").textContent = "Ingrese como bono imponible · " + (con ? "CON gratificación legal" : "SIN gratificación legal");
    $("montoBono").textContent = clp(o.bono);
    $("montoBono").classList.toggle("aviso", !ok);
    let f = con
      ? "El sistema agregará " + clp(o.grat_extra) + " de gratificación legal, para un bruto adicional de " + clp(o.bruto_total) + ". "
      : "El bono no genera gratificación: el bruto adicional es " + clp(o.bruto_total) + ". ";
    f += "El líquido sube de " + clp(r.liquido_actual) + " a " + clp(o.liquido_final) + " (+" + clp(r.aumento) + ").";
    if (!ok) f = "⚠ El líquido nuevo difiere del objetivo en más de $1; revise los datos. " + f;
    $("frase").textContent = f;
    const tb = $("detalle").tBodies[0];
    tb.innerHTML = "";
    fila(tb, "Líquido actual", clp(r.liquido_actual));
    fila(tb, "Bono a ingresar (imponible)", signo("+", o.bono), "dest");
    if (con) fila(tb, "Gratificación que agrega el sistema", signo("+", o.grat_extra));
    fila(tb, "Total bruto agregado", "= " + clp(o.bruto_total));
    fila(tb, "Descuentos previsionales (AFP, salud, cesantía)", signo("−", o.descuentos_previsionales_extra));
    fila(tb, "Impuesto único adicional", signo("−", o.impuesto_extra));
    fila(tb, "Líquido nuevo", clp(o.liquido_final), "dest");
    fila(tb, "Aumento logrado", signo("+", o.liquido_final - r.liquido_actual));
    fila(tb, "Costo empresa adicional (informativo)", clp(o.costo_empresa_extra), "sec");
    $("alt").textContent = "Para comparar: " + (con ? "sin" : "con") + " gratificación legal el bono a ingresar sería " + clp(otra.bono) +
      ". Sueldo base reconstruido a partir del líquido: " + clp(r.sueldo_base) + ".";
    const ul = $("avisos"); ul.innerHTML = "";
    r.avisos.forEach(a => { const li = document.createElement("li"); li.textContent = a; ul.appendChild(li); });
    $("resultado").hidden = false;
  }

  function mostrarError(msg) { const e = $("error"); e.textContent = msg; e.hidden = !msg; }

  function calcular() {
    mostrarError("");
    const t = leerPrevision();
    if (t.salud_tipo === "isapre" && !(t.plan_uf > 0)) { mostrarError("Para Isapre indique el valor del plan en UF."); return; }
    if (t.salud_tipo !== "isapre") t.plan_uf = 0;
    guardarPrevision();
    try {
      pintar(Motor.calcularBono(numero($("liquido").value), numero($("aumento").value), t, P, numero($("noimp").value), numero($("desc").value)));
      $("resultado").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      $("resultado").hidden = true; ultimo = null;
      mostrarError(e.message);
    }
  }

  // ---------- ajustes ----------
  function abrirAjustes() {
    const cont = $("camposAj"); cont.innerHTML = "";
    CAMPOS.forEach(([clave, txt, tipo]) => {
      const d = document.createElement("div");
      const l = document.createElement("label"); l.textContent = txt; l.htmlFor = "aj_" + clave;
      const i = document.createElement("input"); i.id = "aj_" + clave; i.inputMode = tipo === "int" ? "numeric" : "decimal";
      const v = P[clave];
      i.value = v == null ? "" : (tipo === "int" ? miles(v) : (clave === "uf" ? v.toFixed(2).replace(".", ",") : fmtDec(v)));
      d.append(l, i); cont.appendChild(d);
    });
    const ca = $("camposAfp"); ca.innerHTML = "";
    Object.keys(P.afps).sort().forEach(n => {
      const d = document.createElement("div");
      const l = document.createElement("label"); l.textContent = n; l.htmlFor = "afp_" + n;
      const i = document.createElement("input"); i.id = "afp_" + n; i.inputMode = "decimal"; i.value = fmtDec(P.afps[n]);
      d.append(l, i); ca.appendChild(d);
    });
    $("dlgAjustes").showModal();
  }
  function guardarAjustes() {
    CAMPOS.forEach(([clave, , tipo]) => {
      const txt = $("aj_" + clave).value.trim();
      if (tipo === "int") { const n = numero(txt); P[clave] = clave === "grado1a" ? (n > 0 ? n : null) : n; }
      else { const v = decimal(txt); if (v > 0 || txt === "0") P[clave] = v; }
    });
    Object.keys(P.afps).forEach(n => { P.afps[n] = decimal($("afp_" + n).value); });
    const g = Object.assign({}, P); delete g.tramos;
    guardar(CLAVE_PARAMS, g);
    llenarAfps(); pintarPie();
    $("dlgAjustes").close();
    if (ultimo) calcular();
  }
  function restaurar() {
    if (!confirm("¿Volver a los valores originales de los parámetros?")) return;
    try { localStorage.removeItem(CLAVE_PARAMS); } catch (e) { /* nada */ }
    P = Motor.parametrosDefecto();
    llenarAfps(); pintarPie(); abrirAjustes();
  }

  // ---------- inicio ----------
  llenarAfps(); cargarPrevision(); actualizarSalud(); actualizarAyuda(); pintarPie();
  $("salud").addEventListener("change", () => { actualizarSalud(); });
  $("conGrat").addEventListener("change", () => { actualizarAyuda(); guardarPrevision(); if (ultimo) pintar(ultimo); });
  $("btnCalc").addEventListener("click", calcular);
  ["liquido", "aumento", "noimp", "desc", "plan", "zona"].forEach(id => $(id).addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); calcular(); } }));
  $("btnAjustes").addEventListener("click", abrirAjustes);
  $("btnGuardarAj").addEventListener("click", guardarAjustes);
  $("btnRestaurar").addEventListener("click", restaurar);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => { /* sin modo sin conexión */ }); });
  }
})();
