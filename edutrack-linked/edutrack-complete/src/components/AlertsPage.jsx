import React,{useEffect,useMemo,useState} from 'react';
import {AlertTriangle,CheckCircle,RefreshCw,ShieldAlert} from 'lucide-react';
import {supabase} from '../lib/supabase';

const labels={low_attendance:'انخفاض الحضور',repeated_absence:'غياب متكرر',evaluation_decline:'تراجع التقييم',dropout_risk:'خطر الانقطاع',memo_missing:'مذكرة غير مكتملة'};
const sev={critical:'حرج',warning:'تحذير',info:'معلومة'};
export default function AlertsPage({isAdvisor}){
 const [alerts,setAlerts]=useState([]),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 async function load(){const r=await supabase.from('alerts').select('*,study_groups(name),beneficiaries(full_name)').order('detected_at',{ascending:false});if(r.error)setMsg(r.error.message);else setAlerts(r.data||[])}
 useEffect(()=>{load()},[]);
 const open=useMemo(()=>alerts.filter(a=>a.status!=='resolved'),[alerts]);
 async function resolve(id){const r=await supabase.from('alerts').update({status:'resolved',resolved_at:new Date().toISOString()}).eq('id',id).select().single();if(r.error)setMsg(r.error.message);else setAlerts(x=>x.map(a=>a.id===id?r.data:a));}
 async function scan(){setBusy(true);setMsg('جاري تحليل الحضور والتقييمات...');
  const [g,b,a,e]=await Promise.all([
   supabase.from('study_groups').select('id,name'),
   supabase.from('beneficiaries').select('id,group_id,full_name,status'),
   supabase.from('attendance').select('beneficiary_id,group_id,attendance_date,status').order('attendance_date',{ascending:false}).limit(10000),
   supabase.from('evaluations').select('*').order('evaluation_date',{ascending:false}).limit(10000)
  ]);
  if(g.error||b.error||a.error||e.error){setMsg(g.error?.message||b.error?.message||a.error?.message||e.error?.message);setBusy(false);return}
  const groups=Object.fromEntries((g.data||[]).map(x=>[x.id,x.name]));const existing=new Set(alerts.filter(x=>x.status!=='resolved').map(x=>`${x.alert_type}:${x.beneficiary_id||x.group_id}`));const rows=[];
  const avg=x=>{const v=['understanding','reading','writing','participation','comprehension'].map(k=>Number(x?.[k])).filter(Number.isFinite);return v.length?v.reduce((p,c)=>p+c,0)/v.length:0};
  for(const ben of b.data||[]){if(ben.status==='discontinued')continue;const hist=(a.data||[]).filter(x=>x.beneficiary_id===ben.id).slice(0,5);const abs=hist.filter(x=>x.status==='absent').length;if(abs>=3&&!existing.has(`repeated_absence:${ben.id}`))rows.push({group_id:ben.group_id,beneficiary_id:ben.id,alert_type:'repeated_absence',severity:'critical',title:'غياب متكرر',message:`${ben.full_name} لديه ${abs} حالات غياب ضمن آخر 5 سجلات.`});
   const ev=(e.data||[]).filter(x=>x.beneficiary_id===ben.id).slice(0,2);if(ev.length===2){const d=avg(ev[0])-avg(ev[1]);if(d<=-1&&!existing.has(`evaluation_decline:${ben.id}`))rows.push({group_id:ben.group_id,beneficiary_id:ben.id,alert_type:'evaluation_decline',severity:'warning',title:'تراجع في التقييم',message:`تراجع متوسط ${ben.full_name} بمقدار ${Math.abs(d).toFixed(2)} نقطة.`})}
  }
  for(const gr of g.data||[]){const groupAbs=(a.data||[]).filter(x=>x.group_id===gr.id).slice(0,30);if(groupAbs.length>=10){const rate=groupAbs.filter(x=>x.status==='present').length/groupAbs.length;if(rate<.7&&!existing.has(`low_attendance:${gr.id}`))rows.push({group_id:gr.id,alert_type:'low_attendance',severity:'warning',title:'انخفاض حضور المجموعة',message:`نسبة الحضور في آخر ${groupAbs.length} سجلاً هي ${(rate*100).toFixed(0)}%.`})}}
  if(rows.length){const ins=await supabase.from('alerts').insert(rows).select('*,study_groups(name),beneficiaries(full_name)');if(ins.error)setMsg(ins.error.message);else setAlerts(x=>[...(ins.data||[]),...x]);}else setMsg('لا توجد تنبيهات جديدة وفق المعايير الحالية.');setBusy(false);
 }
 return <div dir="rtl"><section className="panel alerts-page"><div className="page-title-row"><div><h2><ShieldAlert size={21}/> التنبيهات والمتابعة</h2><p>رصد الغياب المتكرر، انخفاض الحضور، وتراجع التقييم.</p></div><button className="primary" onClick={scan} disabled={busy}><RefreshCw size={17}/> {busy?'جاري الفحص...':'فحص الآن'}</button></div>{msg&&<div className="notice">{msg}</div>}<div className="cards"><div className="card"><small>التنبيهات المفتوحة</small><strong>{open.length}</strong></div><div className="card"><small>حرجة</small><strong>{open.filter(x=>x.severity==='critical').length}</strong></div><div className="card"><small>تحذيرات</small><strong>{open.filter(x=>x.severity==='warning').length}</strong></div></div></section>
 <section className="panel"><div className="tablewrap"><table><thead><tr><th>النوع</th><th>المستفيد/المجموعة</th><th>التفاصيل</th><th>الخطورة</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>{alerts.length?alerts.map(a=><tr key={a.id}><td>{labels[a.alert_type]||a.alert_type}</td><td>{a.beneficiaries?.full_name||a.study_groups?.name||'—'}</td><td>{a.message}</td><td><span className={'alert-'+a.severity}>{sev[a.severity]}</span></td><td>{a.status==='resolved'?'تم الحل':'مفتوح'}</td><td>{a.status!=='resolved'&&<button className="secondary" onClick={()=>resolve(a.id)}><CheckCircle size={16}/> معالجة</button>}</td></tr>):<tr><td colSpan="6">لا توجد تنبيهات حالياً.</td></tr>}</tbody></table></div></section></div>
}
