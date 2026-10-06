import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock3, FileImage, FileText, Save, Send, Upload, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './daily-memo.css';

const LESSONS = [
  { key: 'lesson1', label: 'الحصة 1', minutes: 45 },
  { key: 'lesson2', label: 'الحصة 2', minutes: 45 },
  { key: 'lesson3', label: 'الحصة 3', minutes: 30 },
];
const empty = {
  memo_date: new Date().toISOString().slice(0, 10),
  lesson1_topic: '', lesson1_steps: '', lesson1_completed: false, lesson1_notes: '',
  lesson2_topic: '', lesson2_steps: '', lesson2_completed: false, lesson2_notes: '',
  lesson3_topic: '', lesson3_steps: '', lesson3_completed: false, lesson3_notes: '',
  general_notes: '', rejection_reason: '', status: 'draft', original_image_path: null,
  ocr_text: '', ocr_status: 'not_run', ocr_error: ''
};
const isWeekday = value => { if (!value) return false; const day = new Date(`${value}T12:00:00`).getDay(); return day >= 1 && day <= 5; };
const statusLabel = s => ({draft:'مسودة',review:'قيد المراجعة',approved:'معتمدة',rejected:'مرفوضة'})[s] || s;

export default function DailyMemo({ group, user, isAdvisor }) {
  const [memo, setMemo] = useState({ ...empty });
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [msg, setMsg] = useState('');
  const [rejection, setRejection] = useState('');
  const fileRef = useRef(null);
  const editable = isAdvisor ? memo.status !== 'approved' : ['draft','rejected'].includes(memo.status);
  const completedMinutes = useMemo(() => LESSONS.reduce((sum,l)=>sum+(memo[`${l.key}_completed`]?l.minutes:0),0),[memo]);

  async function load() {
    const r=await supabase.from('daily_memos').select('*').eq('group_id',group.id).order('memo_date',{ascending:false});
    if(r.error){setMsg(r.error.message);return;}
    const rows=r.data||[]; setHistory(rows);
    const current=rows.find(x=>x.memo_date===memo.memo_date);
    setMemo(current||{...empty,memo_date:memo.memo_date});
  }
  useEffect(()=>{load();},[group.id]);
  function changeDate(value){ const found=history.find(x=>x.memo_date===value); setMemo(found||{...empty,memo_date:value}); setMsg(isWeekday(value)?'':'المذكرة اليومية تُسجل من الاثنين إلى الجمعة فقط.'); }
  function update(k,v){setMemo(x=>({...x,[k]:v}));}

  async function save(status='draft', extra={}) {
    if(!isWeekday(memo.memo_date)){setMsg('لا يمكن حفظ مذكرة ليوم السبت أو الأحد.');return null;}
    setBusy(true);setMsg('');
    const payload={...memo,...extra,group_id:group.id,instructor_id:isAdvisor&&memo.instructor_id?memo.instructor_id:user.id,status,
      rejection_reason:status==='rejected'?(rejection.trim()||memo.rejection_reason||null):null,
      approved_by:status==='approved'?user.id:null,approved_at:status==='approved'?new Date().toISOString():null};
    ['id','created_at','updated_at'].forEach(k=>delete payload[k]);
    const r=await supabase.from('daily_memos').upsert(payload,{onConflict:'group_id,memo_date'}).select().single();
    setBusy(false); if(r.error){setMsg(r.error.message);return null;}
    setMemo(r.data);setRejection('');setMsg(status==='draft'?'تم حفظ المسودة.':status==='review'?'تم إرسال المذكرة للمراجعة.':status==='approved'?'تم اعتماد المذكرة.':'تم رفض المذكرة وإرجاعها للمؤطر.');await load();return r.data;
  }

  async function runOCR(file) {
    if(!file)return;
    if(!isWeekday(memo.memo_date)){setMsg('اختر يومًا من الاثنين إلى الجمعة قبل رفع الصورة.');return;}
    if(file.size>10*1024*1024){setMsg('حجم الصورة يتجاوز 10MB.');return;}
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setMsg('صيغة الصورة يجب أن تكون JPG أو PNG أو WEBP.');return;}
    setOcrBusy(true);setOcrProgress(0);setMsg('جاري رفع الصورة ثم استخراج النص...');
    try {
      const ext=file.name.split('.').pop()?.toLowerCase()||'jpg';
      const path=`${group.id}/${user.id}/${memo.memo_date}-${Date.now()}.${ext}`;
      const up=await supabase.storage.from('daily-memo-images').upload(path,file,{contentType:file.type,upsert:true});
      if(up.error)throw up.error;
      const T=window.Tesseract;
      if(!T)throw new Error('محرك OCR غير متاح. تحقق من اتصال الإنترنت ثم أعد المحاولة.');
      const worker=await T.createWorker('ara',1,{logger:m=>{if(m.status==='recognizing text')setOcrProgress(Math.round((m.progress||0)*100));}});
      const result=await worker.recognize(file); await worker.terminate();
      const text=(result?.data?.text||'').replace(/\r/g,'').trim();
      const ocrStatus=text?'needs_review':'failed';
      setMemo(x=>({...x,original_image_path:path,ocr_text:text,ocr_status:ocrStatus,ocr_error:text?'': 'لم يتم العثور على نص واضح.'}));
      setMsg(text?'تم استخراج النص. راجعه ونظمه قبل الإرسال للمراجعة.':'لم يتم استخراج نص واضح من الصورة. يمكنك إدخال المذكرة يدويًا.');
    } catch(e) { setMsg(e.message||'فشل OCR'); setMemo(x=>({...x,ocr_status:'failed',ocr_error:e.message||'فشل OCR'})); }
    finally{setOcrBusy(false);}
  }

  function normalizeOCR() {
    const text=(memo.ocr_text||'').trim();
    if(!text)return setMsg('لا يوجد نص مستخرج لتنظيمه.');
    const lines=text.split('\n').map(x=>x.trim()).filter(Boolean);
    const buckets=[[],[],[]]; let current=0;
    for(const line of lines){
      const m=line.match(/(?:الحصة|حصة)\s*([123])/i);
      if(m){current=Math.max(0,Math.min(2,Number(m[1])-1));continue;}
      buckets[current].push(line);
    }
    const next={...memo};
    LESSONS.forEach((l,i)=>{const val=buckets[i].join('\n'); if(val){next[`${l.key}_steps`]=val; if(!next[`${l.key}_topic`])next[`${l.key}_topic`]=lines.find(x=>x.length<90&&!/الحصة|حصة/.test(x))||'';}});
    next.ocr_status='completed';setMemo(next);setMsg('تم تنظيم النص في حقول الحصص. راجع المحتوى يدويًا قبل الإرسال.');
  }

  async function saveDraft(){await save('draft');}
  async function sendReview(){if(!memo.ocr_text && !memo.lesson1_topic && !memo.lesson2_topic && !memo.lesson3_topic){setMsg('أدخل محتوى المذكرة أو ارفع صورة قبل الإرسال.');return;}await save('review');}
  async function approve(){await save('approved');}
  async function reject(){if(!rejection.trim()){setMsg('اكتب سبب الرفض قبل الإرجاع للمؤطر.');return;}await save('rejected');}

  return <section className="panel daily-memo" dir="rtl">
    <div className="page-title-row"><div><h3><FileText size={19}/> المذكرة اليومية</h3><p className="muted">الاثنين–الجمعة · الحصة 1: 45 د · الحصة 2: 45 د · الحصة 3: 30 د · المجموع: ساعتان</p></div><label>التاريخ <input type="date" value={memo.memo_date} onChange={e=>changeDate(e.target.value)} /></label></div>
    <div className="memo-summary"><div><Clock3 size={18}/><span>المدة اليومية<strong>120 دقيقة</strong></span></div><div><CheckCircle2 size={18}/><span>المدة المنجزة<strong>{completedMinutes} / 120 دقيقة</strong></span></div><div><span>الحالة<strong>{statusLabel(memo.status)}</strong></span></div></div>
    {!isWeekday(memo.memo_date)&&<div className="memo-warning">⚠️ اختر يومًا من الاثنين إلى الجمعة.</div>}{msg&&<div className="notice">{msg}</div>}{memo.status==='rejected'&&<div className="memo-rejection"><b>سبب الرفض:</b> {memo.rejection_reason||'لم يُذكر سبب.'}</div>}

    <div className="memo-ocr panel-lite">
      <div className="memo-ocr-head"><div><h4><FileImage size={18}/> صورة المذكرة وOCR</h4><p>ارفع الصورة الأصلية؛ سيتم حفظها في Storage الخاص بالمشروع ثم استخراج النص بالعربية. النص يبقى للمراجعة ولا يُعتمد تلقائيًا.</p></div><button className="secondary" disabled={ocrBusy||!editable} onClick={()=>fileRef.current?.click()}><Upload size={17}/> {ocrBusy?'جاري المعالجة…':'رفع صورة المذكرة'}</button><input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>runOCR(e.target.files?.[0])}/></div>
      {ocrBusy&&<div className="ocr-progress"><div style={{width:`${ocrProgress}%`}}></div><span>{ocrProgress}%</span></div>}
      {memo.original_image_path&&<small>الصورة الأصلية محفوظة: {memo.original_image_path}</small>}
      <label>النص المستخرج من OCR<textarea disabled={!editable} value={memo.ocr_text||''} onChange={e=>update('ocr_text',e.target.value)} placeholder="سيظهر هنا النص المستخرج من الصورة..." /></label>
      <div className="form-actions"><button className="secondary" disabled={!memo.ocr_text||!editable} onClick={normalizeOCR}>تنظيم النص في الحصص</button><span className="ocr-status">OCR: {memo.ocr_status==='needs_review'?'يحتاج مراجعة':memo.ocr_status==='completed'?'تم التنظيم':memo.ocr_status==='failed'?'فشل':'لم يُشغّل'}</span></div>
      {memo.ocr_error&&<div className="memo-warning">{memo.ocr_error}</div>}
    </div>

    <div className="memo-lessons">{LESSONS.map(lesson=><article className="memo-lesson" key={lesson.key}><div className="memo-lesson-head"><h4>{lesson.label}</h4><span>{lesson.minutes} دقيقة</span></div><div className="fields"><label>موضوع الحصة<input disabled={!editable} value={memo[`${lesson.key}_topic`]||''} onChange={e=>update(`${lesson.key}_topic`,e.target.value)} placeholder="موضوع الدرس" /></label><label>الخطوات الإجرائية<textarea disabled={!editable} value={memo[`${lesson.key}_steps`]||''} onChange={e=>update(`${lesson.key}_steps`,e.target.value)} placeholder="ما تم إنجازه خطوة بخطوة" /></label><label>ملاحظات الحصة<textarea disabled={!editable} value={memo[`${lesson.key}_notes`]||''} onChange={e=>update(`${lesson.key}_notes`,e.target.value)} /></label></div><label className="memo-check"><input type="checkbox" disabled={!editable} checked={!!memo[`${lesson.key}_completed`]} onChange={e=>update(`${lesson.key}_completed`,e.target.checked)} /> تم إنجاز الحصة بالكامل</label></article>)}</div>
    <label className="memo-general">ملاحظات عامة<textarea disabled={!editable} value={memo.general_notes||''} onChange={e=>update('general_notes',e.target.value)} placeholder="ملاحظات المؤطر أو الصعوبات أو التوصيات" /></label>
    <div className="form-actions">{!isAdvisor&&editable&&<><button className="secondary" disabled={busy} onClick={saveDraft}><Save size={17}/> حفظ مسودة</button><button className="primary" disabled={busy} onClick={sendReview}><Send size={17}/> إرسال للمراجعة</button></>}{isAdvisor&&memo.status!=='approved'&&<><button className="primary" disabled={busy} onClick={approve}><CheckCircle2 size={17}/> اعتماد المذكرة</button><button className="secondary danger" disabled={busy} onClick={reject}><XCircle size={17}/> رفض وإرجاع للمؤطر</button></>}</div>
    {isAdvisor&&memo.status!=='approved'&&<label className="memo-reject-input">سبب الرفض عند الحاجة<textarea value={rejection} onChange={e=>setRejection(e.target.value)} placeholder="اذكر ما يحتاج إلى تصحيح قبل الاعتماد" /></label>}
    <div className="memo-history"><h4>سجل المذكرات</h4><div className="tablewrap"><table><thead><tr><th>التاريخ</th><th>المدة المنجزة</th><th>OCR</th><th>الحالة</th><th>الملاحظات</th></tr></thead><tbody>{history.map(row=><tr key={row.id}><td>{row.memo_date}</td><td>{LESSONS.reduce((s,l)=>s+(row[`${l.key}_completed`]?l.minutes:0),0)} / 120 دقيقة</td><td>{row.ocr_status==='completed'?'منظم':row.ocr_status==='needs_review'?'مراجعة':'—'}</td><td>{statusLabel(row.status)}</td><td>{row.general_notes||'—'}</td></tr>)}</tbody></table></div>{!history.length&&<div className="empty">لا توجد مذكرات مسجلة بعد.</div>}</div>
  </section>;
}
