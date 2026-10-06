# EduTrack — النسخة الكاملة

هذه الحزمة تجمع آخر مراحل التطبيق في مشروع واحد:

- React + Vite
- Supabase Auth + RLS
- دخول المستشار بالبريد الإلكتروني
- دخول المؤطر برمز `login_code` أو البريد
- إدارة المؤطرين وإسناد المجموعات
- عزل المؤطر حسب المجموعات المسندة إليه
- إدارة المجموعات والمستفيدين
- الحضور والتقييمات
- التنبيهات
- المذكرة اليومية: 45 + 45 + 30 دقيقة، من الاثنين إلى الجمعة
- رفع صورة المذكرة + OCR عربي داخل المتصفح
- اعتماد/رفض المذكرة من المستشار
- Edge Function لإنشاء المؤطر
- تشديد RLS على الحسابات والمجموعات والبيانات التابعة

## التشغيل

1. انسخ `.env.example` إلى `.env` وضع:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. نفّذ migrations الموجودة في `supabase/migrations` على مشروع Supabase.
3. انشر Edge Function الموجودة في `supabase/functions/create-instructor`.
4. ثبّت الحزم ثم شغّل:
   `npm install`
   `npm run dev`
5. للإنتاج:
   `npm run build`

## ملاحظة أمنية

لا تضع `service_role` داخل `.env` الخاص بالواجهة أو داخل أي ملف `src`.

الحماية الأساسية تعتمد على Supabase RLS، وليست على إخفاء عناصر الواجهة.

## الربط الحالي
هذه النسخة مهيأة لمشروع Supabase:
`aokqwoxlrqenkguqkubc`

تمت إضافة `.env.local` بمفتاح Supabase العام (publishable) فقط. لا تضع `service_role` أو أي secret داخل ملفات Vite أو Git.

## Vercel
1. ارفع المجلد إلى GitHub.
2. في Vercel اختر Import Project.
3. Framework: Vite.
4. Build Command: `npm run build`.
5. Output Directory: `dist`.
6. أضف متغيري البيئة:
   - `VITE_SUPABASE_URL=https://aokqwoxlrqenkguqkubc.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=<Supabase publishable key>`
7. Deploy.
