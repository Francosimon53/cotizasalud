import { getFPLpct } from "./data";
export function generateQuote(county: any, household: any[], income: number) {
  const pct = getFPLpct(income, household.length);
  const age0 = household[0]?.age || 30;
  let aptc = 0;
  if (pct >= 100) {
    const c = Math.min(pct, 400);
    const r = c <= 150 ? .02 : c <= 200 ? .04 : c <= 250 ? .06 : c <= 300 ? .075 : .085;
    aptc = Math.max(0, Math.round((450 + (age0 - 21) * 8) - (income * r) / 12));
  }
  const metals = [
    { m:"bronze",x:.7,ded:7500,oop:9450,pcp:40,sp:80,rx:25,er:500,rat:3.5,hsa:true },
    { m:"bronze",x:.75,ded:6500,oop:9200,pcp:45,sp:75,rx:20,er:450,rat:3,hsa:true },
    { m:"silver",x:1.0,ded:5000,oop:8700,pcp:35,sp:65,rx:15,er:400,rat:4,hsa:false },
    { m:"silver",x:1.05,ded:4500,oop:8500,pcp:30,sp:60,rx:15,er:375,rat:4.5,hsa:false },
    { m:"silver",x:.95,ded:5500,oop:9000,pcp:40,sp:70,rx:20,er:425,rat:3.5,hsa:false },
    { m:"gold",x:1.25,ded:1500,oop:7500,pcp:25,sp:50,rx:10,er:350,rat:4,hsa:false },
    { m:"gold",x:1.3,ded:1200,oop:7000,pcp:20,sp:45,rx:10,er:300,rat:4.5,hsa:false },
    { m:"platinum",x:1.5,ded:500,oop:4000,pcp:15,sp:35,rx:5,er:200,rat:4.5,hsa:false },
  ];
  const issuers = ["Blue Cross Blue Shield","Ambetter","Molina Healthcare","Oscar Health","Aetna CVS Health"];
  const variants = ["Value","Standard","Plus","Select","Essential"];
  const plans: any[] = [];
  metals.forEach((lv, li) => {
    const issuer = issuers[li % issuers.length];
    const variant = variants[li % variants.length];
    const prem = Math.max(50, Math.round((300 + (age0-21)*7) * lv.x + li*18));
    const after = Math.max(0, prem - aptc);
    const ded = Math.max(0, lv.ded + Math.round((Math.random()-.5)*400));
    plans.push({
      id: "P"+li, name: issuer+" "+variant+" "+lv.m.charAt(0).toUpperCase()+lv.m.slice(1),
      issuer, metal: lv.m, premium: prem, aptc, afterSubsidy: after,
      deductible: ded, oopMax: lv.oop, pcp: lv.pcp, specialist: lv.sp,
      genericRx: lv.rx, er: lv.er, rating: lv.rat, hsa: lv.hsa,
      yLow: after*12+Math.round(ded*.05), yMed: after*12+Math.round(ded*.4),
      yHigh: after*12+Math.min(lv.oop, ded+3000),
    });
  });
  return { plans, aptc, fplPct: pct };
}
