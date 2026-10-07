import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Save, UserPlus, Check, X, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import DailyMemo from './DailyMemo';

const blank={full_name:'',registration_date:new Date().toISOString().slice(0,10),status:'active',instructor_notes:'',advisor_notes:''};
const scoreFields=[['understanding','الفهم'],['reading','القراءة'],['writing','الكتابة'],['participation','المشاركة'],['comprehension','الاستيعاب']];
const emptyEval={understanding:'',reading:'',writing:'',participation:'',comprehension:'',progress_note:''};

function avg(row){const v=scoreFields.map(([k])=>Number(row?.[k])).filter(Number.isFinite);return v.length?v.reduce((a,b)=>a+b,0)/v.length:0;}
function Score({value,onChange}){return <input type="number" min="0" max="10" step="0.5" value={value} onChange={e=>onChange(e.target.value)} required/>}

export default function GroupDetails({group,user,isAdvisor,onBack}){
 const [beneficiaries,setBeneficiaries]=useState([]),[attendance,setAttendance]=useState({}),[evaluations,setEvaluations]=useState([]),[form,setForm]=useState(blank),[selected,setSelected]=useState(null),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[evalForm,setEvalForm]=useState(emptyEval),[evalBeneficiary,setEvalBeneficiary]=useState(''),[evalDate,setEvalDate]=useState(new Date().toISOString().slice(0,10));
 async function load(){
  const b=await supabase.from('beneficiaries').select('*').eq('group_id',group.id).order('full_name');
  if(b.error){setMsg(b.error.message);return}
  setBeneficiaries(b.data||[]);
  const a=await supabase.from('attendance').select('beneficiary_id,status,reason,notes').eq('group_id',group.id).eq('attendance_date',date);
  if(a.error){setMsg(a.error.message);return}
  setAttendance(Object.fromEntries((a.data||[]).map(x=>[x.beneficiary_id,x])));
const ev = await supabase.from('evaluations').select('*').eq('group_id', group.id).order('evaluation_date', { ascending: false });  if(ev.error){setMsg(ev.error.message);return}
  setEvaluations(ev.data||[]);
 }
 useEffect(()=>{load()},[group.id,date]);
 const active=useMemo(()=>beneficiaries.filter(x=>x.status!=='discontinued'),[beneficiaries]);
 const present=active.filter(b=>attendance[b.id]?.status==='present').length;
 const absent=active.filter(b=>attendance[b.id]?.status==='absent').length;
 const groupAverage=useMemo(()=>{const v=evaluations.map(avg).filter(x=>x>0);return v.length?v.reduce((a,b)=>a+b,0)/v.length:0},[evaluations]);
 const selectedHistory=useMemo(()=>evaluations.filter(x=>x.beneficiary_id===evalBeneficiary).sort((a,b)=>String(b.evaluation_date).localeCompare(String(a.evaluation_date))),[evaluations,evalBeneficiary]);
 const currentEval=selectedHistory[0]; const previousEval=selectedHistory[1];
 const currentAvg=currentEval?avg(currentEval):0, previousAvg=previousEval?avg(previousEval):0;
 async function add(e){e.preventDefault();if(!form.full_name.trim())return;setBusy(true);const r=await supabase.from('beneficiaries').insert({...form,group_id:group.id,full_name:form.full_name.trim()}).select().single();setBusy(false);if(r.error){setMsg(r.error.message);return}setBeneficiaries(x=>[...x,r.data].sort((a,b)=>a.full_name.localeCompare(b.full_name,'ar')));setForm(blank);setMsg('تمت إضافة المستفيد.');}
 async function mark(id,status){setBusy(true);const payload={beneficiary_id:id,group_id:group.id,attendance_date:date,status,recorded_by:user.id};const r=await supabase.from('attendance').upsert(payload,{onConflict:'beneficiary_id,attendance_date'}).select().single();setBusy(false);if(r.error){setMsg(r.error.message);return}setAttendance(x=>({...x,[id]:r.data}));}
 async function discontinue(id){const r=await supabase.from('beneficiaries').update({status:'discontinued',discontinuation_date:date}).eq('id',id).select().single();if(r.error){setMsg(r.error.message);return}setBeneficiaries(x=>x.map(b=>b.id===id?r.data:b));}
 async function saveNotes(){if(!selected)return;const r=await supabase.from('beneficiaries').update({instructor_notes:selected.instructor_notes,advisor_notes:selected.advisor_notes}).eq('id',selected.id).select().single();if(r.error){setMsg(r.error.message);return}setBeneficiaries(x=>x.map(b=>b.id===selected.id?r.data:b));setSelected(null);setMsg('تم حفظ الملاحظات.');}
async function saveEvaluation(e) {
  e.preventDefault();

  if (!evalBeneficiary) return;

  const scores = Object.fromEntries(
    scoreFields.map(([key]) => [
      key,
      Number(evalForm[key] || 0)
    ])
  );

  const payload = {
    beneficiary_id: evalBeneficiary,
    group_id: group.id,
    evaluation_date: evalDate,
    recorded_by: user.id,
    ...scores,
    progress_note: evalForm.progress_note?.trim() || null
  };

  setBusy(true);

  const r = await supabase
    .from('evaluations')
    .insert(payload)
    .select()
    .single();

  setBusy(false);

  if (r.error) {
    setMsg(r.error.message);
    return;
  }

  setEvaluations(x => [r.data, ...x]);
  setEvalForm(emptyEval);
  setMsg('?? ??? ??????? ?????.');
} {
  e.preventDefault();

  if (!evalBeneficiary) return;

  const scores = Object.fromEntries(
    scoreFields.map(([key]) => [
      key,
      Number(evalForm[key] || 0)
    ])
  );

  const payload = {
    beneficiary_id: evalBeneficiary,
    group_id: group.id,
    evaluation_date: evalDate,
    recorded_by: user.id,
    ...scores,
    progress_note: evalForm.progress_note?.trim() || null
  };

  setBusy(true);

  const r = await supabase
    .from('evaluations')
    .insert(payload)
    .select()
    .single();

  setBusy(false);

  if (r.error) {
    setMsg(r.error.message);
    return;
  }

  setEvaluations(x => [r.data, ...x]);
  setEvalForm(emptyEval);
  setMsg('تم حفظ التقييم بنجاح.');
}  {}; setBusy(true);const r=await supabase.from('evaluations').insert(payload).select().single();setBusy(false);if(r.error){setMsg(r.error.message);return}setEvaluations(x=>[r.data,...x]);setEvalForm(emptyEval);setMsg('تم حفظ التقييم بنجاح.');
 }
 function selectEval(id){setEvalBeneficiary(id);const latest=evaluations.find(x=>x.beneficiary_id===id);if(latest)setEvalForm({understanding:latest.understanding,reading:latest.reading,writing:latest.writing,participation:latest.participation,comprehension:latest.comprehension,progress_note:latest.progress_note||''});else setEvalForm(emptyEval);}
 return <div dir="rtl">
  <section className="panel"><div className="page-title-row"><div><h2>{group.name}</h2><p>{group.educator} — {group.month}</p></div><button className="secondary" onClick={onBack}><ArrowRight size={17}/> العودة للمجموعات</button></div>{msg&&<div className="notice">{msg}</div>}
   <div className="cards"><div className="card"><small>المسجلون فعلياً</small><strong>{beneficiaries.length}</strong></div><div className="card"><small>حضور {date}</small><strong>{present}</strong></div><div className="card"><small>غياب {date}</small><strong>{absent}</strong></div><div className="card"><small>المنقطعون</small><strong>{beneficiaries.filter(b=>b.status==='discontinued').length}</strong></div></div>
  </section>
  <section className="panel form"><h3><UserPlus size={18}/> إضافة مستفيد</h3><div className="fields"><label>الاسم الكامل*<input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></label><label>تاريخ التسجيل<input type="date" value={form.registration_date} onChange={e=>setForm({...form,registration_date:e.target.value})}/></label></div><button className="primary" onClick={add} disabled={busy}><Save size={17}/> حفظ المستفيد</button></section>
  <section className="panel"><div className="page-title-row"><h3>الحضور اليومي</h3><label>التاريخ <input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></div><div className="tablewrap"><table><thead><tr><th>المستفيد</th><th>الحالة</th><th>الحضور</th><th>إجراء</th></tr></thead><tbody>{active.map(b=><tr key={b.id}><td>{b.full_name}</td><td>{b.status==='active'?'نشط':'غائب'}</td><td>{attendance[b.id]?.status==='present'?'حاضر':attendance[b.id]?.status==='absent'?'غائب':'—'}</td><td className="actions"><button title="حاضر" onClick={()=>mark(b.id,'present')} disabled={busy}><Check/></button><button title="غائب" onClick={()=>mark(b.id,'absent')} disabled={busy}><X/></button><button onClick={()=>setSelected({...b})}>ملاحظات</button>{isAdvisor&&<button onClick={()=>discontinue(b.id)}>انقطاع</button>}</td></tr>)}</tbody></table></div></section>
  {selected&&<section className="panel form"><h3>ملاحظات: {selected.full_name}</h3><div className="fields"><label>ملاحظات المؤطر<textarea value={selected.instructor_notes||''} onChange={e=>setSelected({...selected,instructor_notes:e.target.value})}/></label>{isAdvisor&&<label>ملاحظات المستشار<textarea value={selected.advisor_notes||''} onChange={e=>setSelected({...selected,advisor_notes:e.target.value})}/></label>}</div><button className="primary" onClick={saveNotes}><Save size={17}/> حفظ</button><button className="secondary" onClick={()=>setSelected(null)}>إلغاء</button></section>}
  <section className="panel"><div className="page-title-row"><h3><BarChart3 size={19}/> التقييم والتقدم</h3><strong>متوسط المجموعة: {groupAverage.toFixed(2)}/10</strong></div>
   <form className="form" onSubmit={saveEvaluation}><div className="fields"><label>المستفيد*<select value={evalBeneficiary} onChange={e=>selectEval(e.target.value)} required><option value="">اختر المستفيد</option>{beneficiaries.map(b=><option key={b.id} value={b.id}>{b.full_name}</option>)}</select></label><label>تاريخ التقييم*<input type="date" value={evalDate} onChange={e=>setEvalDate(e.target.value)} required/></label></div>
   <div className="fields">{scoreFields.map(([k,label])=><label key={k}>{label} (0–10)<Score value={evalForm[k]} onChange={v=>setEvalForm({...evalForm,[k]:v})}/></label>)}</div>
   <label>ملاحظة التقدم<textarea value={evalForm.progress_note} onChange={e=>setEvalForm({...evalForm,progress_note:e.target.value})} placeholder="نقاط القوة، الصعوبات، والتوصية التعليمية..."/></label><button className="primary" disabled={busy}><Save size={17}/> حفظ التقييم</button></form>
   {evalBeneficiary&&<div className="cards"><div className="card"><small>آخر متوسط</small><strong>{currentAvg?currentAvg.toFixed(2):'—'}</strong></div><div className="card"><small>التقييم السابق</small><strong>{previousAvg?previousAvg.toFixed(2):'—'}</strong></div><div className="card"><small>التغير</small><strong>{currentEval&&previousEval?`${currentAvg-previousAvg>=0?'+':''}${(currentAvg-previousAvg).toFixed(2)}`:'—'}</strong></div></div>}
   <div className="tablewrap"><table><thead><tr><th>المستفيد</th><th>آخر تقييم</th><th>المتوسط</th><th>السابق</th><th>التغير</th></tr></thead><tbody>{beneficiaries.map(b=>{const h=evaluations.filter(x=>x.beneficiary_id===b.id).sort((a,z)=>String(z.evaluation_date).localeCompare(String(a.evaluation_date)));const c=h[0],p=h[1];const ca=avg(c),pa=avg(p);return <tr key={b.id}><td>{b.full_name}</td><td>{c?.evaluation_date||'—'}</td><td>{c?ca.toFixed(2):'—'}</td><td>{p?pa.toFixed(2):'—'}</td><td>{c&&p?`${ca-pa>=0?'+':''}${(ca-pa).toFixed(2)}`:'—'}</td></tr>})}</tbody></table></div>
  </section>
  <DailyMemo group={group} user={user} isAdvisor={isAdvisor}/>
 </div>;
}
