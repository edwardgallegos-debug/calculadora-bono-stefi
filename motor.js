/* Motor de cálculo (port fiel de app/motor.py y app/bono.py del Ajustador de Liquidaciones).
   Sin dependencias: funciona en el navegador (iPhone) y en Node para pruebas. Montos en pesos chilenos enteros. */
(function (raiz) {
  "use strict";

  // Redondeo al entero más cercano con 0,5 hacia arriba (como Decimal ROUND_HALF_UP de Python), usando la
  // representación decimal más corta del número para evitar errores de coma flotante.
  function redondear(x) {
    if (!isFinite(x)) return 0;
    const neg = x < 0;
    let s = String(Math.abs(x));
    if (/e/i.test(s)) return (neg ? -1 : 1) * Math.round(Math.abs(x));
    const i = s.indexOf(".");
    let ent = i < 0 ? s : s.slice(0, i);
    const frac = i < 0 ? "" : s.slice(i + 1);
    let n = parseInt(ent, 10);
    if (frac.length && frac.charCodeAt(0) >= 53) n += 1;   // primer decimal >= 5
    return neg ? -n : n;
  }

  const AFPS_DEFECTO = { Capital: 1.44, Cuprum: 1.44, Habitat: 1.27, Modelo: 0.58, PlanVital: 1.16, ProVida: 1.45, Uno: 0.46 };
  const TRAMOS_IUSC = [[13.5, 0.0, 0.0], [30.0, 0.04, 0.54], [50.0, 0.08, 1.74], [70.0, 0.135, 4.49],
                       [90.0, 0.23, 11.14], [120.0, 0.304, 17.8], [310.0, 0.35, 23.32], [Infinity, 0.40, 38.82]];

  function parametrosDefecto() {
    return {
      periodo: "2026-09", uf: 41057.20, utm: 71721.0, imm: 553553,
      tope_afp_uf: 90.0, tope_ces_uf: 135.2, cot_afp: 10.0, cot_salud: 7.0, ces_trab_indef: 0.6,
      grat_pct: 25.0, grat_tope_imm: 4.75, ccaf_pct: 4.2, grado1a: null, trib_plan_completo: true,
      ces_emp_indef: 2.4, ces_emp_fijo: 3.0, mutual_pct: 0.93, aporte_reforma_pct: 3.5, sis_pct: 0.0,
      afps: Object.assign({}, AFPS_DEFECTO), tramos: TRAMOS_IUSC.map(t => t.slice()),
    };
  }

  function trabajadorDefecto() {
    return { afp: "Modelo", salud_tipo: "fonasa", plan_uf: 0, contrato: "indef", zona_pct: 98, zona_tope: null,
             adicional_tope: null, jubilado: false };
  }

  const suma = (a, f) => a.reduce((s, h) => s + f(h), 0);

  function impuestoUnico(base, p) {
    if (base <= 0 || p.utm <= 0) return 0;
    const u = base / p.utm;
    for (const [hasta, factor, rebajaUtm] of p.tramos) {
      if (u <= hasta) return Math.max(0, redondear(base * factor - rebajaUtm * p.utm));
    }
    return 0;
  }

  function rebajaZonaExtrema(trib, zonaPct, p, tope) {
    if (zonaPct <= 0 || trib <= 0) return 0;
    let rebaja = redondear(trib * zonaPct / (100 + zonaPct));
    if (p.grado1a) rebaja = Math.min(rebaja, redondear(p.grado1a * zonaPct / 100));
    if (tope) rebaja = Math.min(rebaja, tope);
    return rebaja;
  }

  // haberes: [{nombre, tipo: "imp"|"noimp"|"desc"|"post", monto, grat}]
  function calcular(haberes, t, p, gratAuto) {
    if (gratAuto === undefined) gratAuto = true;
    const r = {};
    const baseGrat = suma(haberes.filter(h => h.tipo === "imp" && h.grat), h => h.monto);
    r.grat_tope = redondear(p.grat_tope_imm * p.imm / 12);
    r.grat = 0; r.grat_limitada = false;
    if (gratAuto) {
      const bruta = redondear(baseGrat * p.grat_pct / 100);
      r.grat = Math.min(bruta, r.grat_tope);
      r.grat_limitada = bruta > r.grat_tope;
    }
    r.imp = suma(haberes.filter(h => h.tipo === "imp"), h => h.monto) + r.grat;
    r.noimp = suma(haberes.filter(h => h.tipo === "noimp"), h => h.monto);
    r.otros = suma(haberes.filter(h => h.tipo === "desc"), h => h.monto);
    r.post = suma(haberes.filter(h => h.tipo === "post"), h => h.monto);
    r.haberes = r.imp + r.noimp;

    r.base_afp = Math.min(r.imp, redondear(p.tope_afp_uf * p.uf));
    r.base_ces = Math.min(r.imp, redondear(p.tope_ces_uf * p.uf));

    r.afp_pct = t.jubilado ? 0 : (p.afps[t.afp] || 0);
    r.capital = t.jubilado ? 0 : redondear(r.base_afp * p.cot_afp / 100);
    r.comision = redondear(r.base_afp * r.afp_pct / 100);
    r.afp = r.capital + r.comision;

    r.salud_legal = redondear(r.base_afp * p.cot_salud / 100);
    r.ccaf = 0;
    if (t.salud_tipo === "isapre") {
      r.salud = Math.max(r.salud_legal, redondear(t.plan_uf * p.uf));
    } else {
      r.salud = r.salud_legal;
      r.ccaf = redondear(r.base_afp * p.ccaf_pct / 100);
    }

    r.ces_pct = (t.contrato === "indef" && !t.jubilado) ? p.ces_trab_indef : 0;
    r.ces = redondear(r.base_ces * r.ces_pct / 100);

    let dedSalud = r.salud_legal;
    if (p.trib_plan_completo) {
      const adicional = r.salud - r.salud_legal;
      dedSalud += (t.adicional_tope == null) ? adicional : Math.min(adicional, t.adicional_tope);
    }
    r.trib = Math.max(0, r.imp - r.afp - dedSalud - r.ces);
    r.rebaja_zona = rebajaZonaExtrema(r.trib, t.zona_pct, p, t.zona_tope);
    r.base_impuesto = Math.max(0, r.trib - r.rebaja_zona);
    r.impuesto = impuestoUnico(r.base_impuesto, p);

    r.desc_legales = r.afp + r.salud + r.ces + r.impuesto;
    r.descuentos = r.desc_legales + r.otros;
    r.subtotal = r.haberes - r.descuentos;
    r.liquido = r.subtotal + r.post;

    const cesEmp = t.contrato === "indef" ? p.ces_emp_indef : p.ces_emp_fijo;
    if (t.jubilado) {
      r.aportes_empleador = redondear(r.base_afp * p.mutual_pct / 100);
    } else {
      r.aportes_empleador = redondear(r.base_ces * cesEmp / 100)
        + redondear(r.base_afp * (p.mutual_pct + p.aporte_reforma_pct + p.sis_pct) / 100);
    }
    r.costo_empresa = r.haberes + r.aportes_empleador;
    return r;
  }

  // Menor bruto de un nuevo haber imponible que sube el líquido exactamente `aumento` (bisección entera).
  function resolverBruto(haberes, t, p, gratAuto, nombre, tipo, grat, aumento) {
    const antes = calcular(haberes, t, p, gratAuto).liquido;
    const objetivo = antes + aumento;
    const liquido = x => calcular(haberes.concat([{ nombre, tipo, monto: x, grat }]), t, p, gratAuto).liquido;
    let lo = 0, hi = Math.max(1000, aumento * 2);
    while (liquido(hi) < objetivo) {
      hi *= 2;
      if (hi > 1e10) throw new Error("No se encontró solución: revise los parámetros.");
    }
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (liquido(mid) >= objetivo) hi = mid; else lo = mid + 1;
    }
    let x = lo;
    if (x > 0 && Math.abs(liquido(x - 1) - objetivo) < Math.abs(liquido(x) - objetivo)) x -= 1;
    return { bruto: x, liquido_antes: antes, liquido_objetivo: objetivo, liquido_final: liquido(x) };
  }

  function baseDeHaberes(sueldo, noimp, descuentos) {
    const h = [{ nombre: "Sueldo Base", tipo: "imp", monto: sueldo, grat: true }];
    if (noimp) h.push({ nombre: "No imponibles", tipo: "noimp", monto: noimp, grat: false });
    if (descuentos) h.push({ nombre: "Descuentos fijos", tipo: "desc", monto: descuentos, grat: false });
    return h;
  }

  function sueldoBaseDesdeLiquido(liquido, t, p, noimp, descuentos) {
    const liq = s => calcular(baseDeHaberes(s, noimp, descuentos), t, p).liquido;
    if (liquido <= liq(0)) {
      throw new Error("El líquido ingresado es menor o igual a lo que quedaría sin sueldo base (revise los no imponibles y los descuentos fijos).");
    }
    let lo = 0, hi = Math.max(1000000, liquido * 3);
    while (liq(hi) < liquido) hi *= 2;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (liq(mid) >= liquido) hi = mid; else lo = mid + 1;
    }
    if (lo > 0 && Math.abs(liq(lo - 1) - liquido) < Math.abs(liq(lo) - liquido)) lo -= 1;
    return lo;
  }

  const miles = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  function calcularBono(liquidoActual, aumento, t, p, noimp, descuentos) {
    noimp = noimp || 0; descuentos = descuentos || 0;
    if (!(liquidoActual > 0)) throw new Error("Ingrese el sueldo líquido actual.");
    if (!(aumento > 0)) throw new Error("El aumento del líquido debe ser mayor que cero.");
    const base = sueldoBaseDesdeLiquido(liquidoActual, t, p, noimp, descuentos);
    const haberes = baseDeHaberes(base, noimp, descuentos);
    const antes = calcular(haberes, t, p);
    const objetivo = liquidoActual + aumento;
    const avisos = [];
    if (Math.abs(antes.liquido - liquidoActual) > 1) {
      avisos.push("El líquido reconstruido ($" + miles(antes.liquido) + ") no coincide con el ingresado ($" + miles(liquidoActual) + ").");
    }
    function opcion(conGrat) {
      const s = resolverBruto(haberes, t, p, true, "Bono de ajuste", "imp", conGrat, aumento);
      const despues = calcular(haberes.concat([{ nombre: "Bono de ajuste", tipo: "imp", monto: s.bruto, grat: conGrat }]), t, p);
      const gratExtra = despues.grat - antes.grat;
      return {
        con_gratificacion: conGrat, bono: s.bruto, grat_extra: gratExtra, bruto_total: s.bruto + gratExtra,
        liquido_final: despues.liquido, diferencia: despues.liquido - objetivo,
        impuesto_extra: despues.impuesto - antes.impuesto,
        descuentos_previsionales_extra: (despues.afp + despues.salud + despues.ces) - (antes.afp + antes.salud + antes.ces),
        costo_empresa_extra: despues.costo_empresa - antes.costo_empresa,
        grat_topada: conGrat && antes.grat >= antes.grat_tope && antes.grat_tope > 0,
      };
    }
    const con = opcion(true), sin = opcion(false);
    if (con.grat_topada) avisos.push("La gratificación del trabajador ya está en su tope legal: el bono con gratificación no la aumenta.");
    return { liquido_actual: liquidoActual, aumento, liquido_objetivo: objetivo, sueldo_base: base,
             liquido_reconstruido: antes.liquido, antes, con_grat: con, sin_grat: sin, avisos };
  }

  const api = { redondear, parametrosDefecto, trabajadorDefecto, calcular, resolverBruto, sueldoBaseDesdeLiquido, calcularBono, AFPS_DEFECTO };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else raiz.Motor = api;
})(typeof self !== "undefined" ? self : this);
