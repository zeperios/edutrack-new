# EduTrack — إدارة المؤطرين وإسناد المجموعات

## الملفات

- `src/components/InstructorManagement.jsx`
  شاشة الإدارة للمستشار.
- `src/components/instructor-management.css`
  تنسيقات الشاشة.
- `supabase/migrations/20261006_instructor_management.sql`
  أعمدة RLS والفهارس المطلوبة.
- `supabase/functions/create-instructor/index.ts`
  إنشاء حساب Supabase Auth + profile بشكل آمن من الخادم.
- `LOGIN_PATCH.jsx`
  التعديل الصغير المطلوب في شاشة الدخول للسماح للمؤطر بالدخول برقم المعرف.

## 1) قاعدة البيانات

طبّق ملف migration على مشروع Supabase بعد التأكد أن migration
`edutrack_accounts_and_group_assignments` موجودة.

## 2) Edge Function

أنشئ Edge Function باسم:

`create-instructor`

واستخدم الملف:

`supabase/functions/create-instructor/index.ts`

لا تضع أي secret/service-role key في React.

## 3) إضافة الشاشة إلى main.jsx

أعلى `main.jsx`:

```jsx
import InstructorManagement from "./components/InstructorManagement";
```

ثم داخل اختيار الصفحات في Dashboard:

```jsx
{page === "users" && (
  <InstructorManagement profile={profile} />
)}
```

إذا كانت الصفحة `users` موجودة مسبقًا، استبدل `UsersPage(...)` القديمة بهذا المكوّن.

## 4) شاشة الدخول

طبّق التعديلات الموجودة في `LOGIN_PATCH.jsx`.

النتيجة:
- المؤطر يكتب رقم الدخول + كلمة المرور.
- المدير يستطيع الاستمرار بالبريد الإلكتروني.
- البريد الداخلي للمؤطر لا يظهر للمستخدم.

## 5) الإسناد

بعد إنشاء المؤطر:
1. افتح «المؤطرون وإسناد المجموعات».
2. اضغط «إسناد المجموعات».
3. حدد مجموعة أو عدة مجموعات.
4. اضغط «حفظ الإسناد».

الـ RLS في قاعدة البيانات يمنع المؤطر من قراءة/إدارة بيانات المجموعة غير المسندة إليه.

## ملاحظة

المكوّن يفترض أن ملف Supabase الحالي موجود في:

`src/lib/supabase.js`

كما يفترض وجود الجداول:
`profiles`, `study_groups`, `group_instructors`.
