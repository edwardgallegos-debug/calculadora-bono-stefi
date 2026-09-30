const M=require("../motor.js");
const d=require("./paridad.json");const p=M.parametrosDefecto();let mal=0;
d.casos.forEach((c,i)=>{const e=d.esperado[i];let g;
 try{const r=M.calcularBono(c.liq,c.aum,Object.assign(M.trabajadorDefecto(),c.t),p,c.noimp,c.desc);
  g=[r.sueldo_base,r.con_grat.bono,r.con_grat.grat_extra,r.con_grat.liquido_final,r.sin_grat.bono,r.sin_grat.liquido_final,r.con_grat.impuesto_extra,r.con_grat.costo_empresa_extra];}catch(x){g="ERR"}
 if(JSON.stringify(g)!==JSON.stringify(e)){mal++;if(mal<6)console.log(i,c,e,g)}});
console.log("casos",d.casos.length,"diferencias",mal);
