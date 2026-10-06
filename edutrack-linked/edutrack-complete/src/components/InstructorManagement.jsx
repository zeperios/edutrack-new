import React, { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, ShieldCheck, UserCheck, UserX, Save, X } from "lucide-react";
import { supabase } from "../lib/supabase";

const emptyForm = {
  full_name: "",
  login_code: "",
  phone: "",
  workplace: "",
  password: "",
  is_active: true,
};

export default function InstructorManagement({ profile }) {
  const [instructors, setInstructors] = useState([]);
  const [groups, setGroups] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedInstructor, setSelectedInstructor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const isAdvisor =
    profile?.account_role === "advisor" || profile?.role === "admin";

  async function load() {
    setBusy(true);
    setMessage("");

    const [u, g, a] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id,full_name,account_role,login_code,phone,workplace,is_active,created_at"
        )
        .eq("account_role", "instructor")
        .order("created_at", { ascending: true }),

      supabase
        .from("study_groups")
        .select("id,name,educator,month,status")
        .order("month", { ascending: false }),

      supabase
        .from("group_instructors")
        .select("id,group_id,instructor_id,active,assigned_at"),
    ]);

    const error = u.error || g.error || a.error;
    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }

    setInstructors(u.data || []);
    setGroups(g.data || []);
    setAssignments(a.data || []);
    setBusy(false);
  }

  useEffect(() => {
    if (isAdvisor) load();
  }, [isAdvisor]);

  const groupMap = useMemo(
    () => Object.fromEntries(groups.map((g) => [g.id, g])),
    [groups]
  );

  function assignedGroupIds(instructorId) {
    return assignments
      .filter((a) => a.instructor_id === instructorId && a.active)
      .map((a) => a.group_id);
  }

  function startAssign(instructor) {
    setSelectedInstructor(instructor);
    setSelectedGroups(assignedGroupIds(instructor.id));
    setMessage("");
  }

  function toggleGroup(groupId) {
    setSelectedGroups((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId]
    );
  }

  async function saveAssignments() {
    if (!selectedInstructor) return;

    setBusy(true);
    setMessage("");

    const { error: deleteError } = await supabase
      .from("group_instructors")
      .delete()
      .eq("instructor_id", selectedInstructor.id);

    if (deleteError) {
      setMessage(deleteError.message);
      setBusy(false);
      return;
    }

    if (selectedGroups.length) {
      const rows = selectedGroups.map((group_id) => ({
        group_id,
        instructor_id: selectedInstructor.id,
        active: true,
      }));

      const { error } = await supabase
        .from("group_instructors")
        .insert(rows);

      if (error) {
        setMessage(error.message);
        setBusy(false);
        return;
      }
    }

    setSelectedInstructor(null);
    await load();
    setMessage("تم حفظ إسناد المجموعات بنجاح.");
  }

  async function createInstructor(e) {
    e.preventDefault();

    if (!form.full_name.trim() || !form.login_code.trim() || !form.password) {
      setMessage("الاسم، رقم الدخول وكلمة المرور حقول إلزامية.");
      return;
    }

    setBusy(true);
    setMessage("");

    const { data, error } = await supabase.functions.invoke(
      "create-instructor",
      {
        body: {
          full_name: form.full_name.trim(),
          login_code: form.login_code.trim(),
          phone: form.phone.trim() || null,
          workplace: form.workplace.trim() || null,
          password: form.password,
          is_active: form.is_active,
        },
      }
    );

    if (error) {
      setMessage(error.message || "تعذر إنشاء حساب المؤطر.");
      setBusy(false);
      return;
    }

    if (data?.error) {
      setMessage(data.error);
      setBusy(false);
      return;
    }

    setForm(emptyForm);
    await load();
    setMessage("تم إنشاء حساب المؤطر بنجاح.");
  }

  async function updateInstructor(e) {
    e.preventDefault();
    if (!editing) return;

    setBusy(true);

    const payload = {
      full_name: editing.full_name.trim(),
      phone: editing.phone?.trim() || null,
      workplace: editing.workplace?.trim() || null,
      is_active: !!editing.is_active,
    };

    const { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", editing.id)
      .eq("account_role", "instructor");

    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }

    setEditing(null);
    await load();
    setMessage("تم تحديث بيانات المؤطر.");
  }

  async function toggleActive(instructor) {
    const next = !instructor.is_active;
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: next })
      .eq("id", instructor.id)
      .eq("account_role", "instructor");

    if (error) {
      setMessage(error.message);
      return;
    }

    await load();
    setMessage(next ? "تم تفعيل الحساب." : "تم تعطيل الحساب.");
  }

  if (!isAdvisor) {
    return (
      <section className="panel" dir="rtl">
        <h2>المؤطرون وإسناد المجموعات</h2>
        <p>هذه الصفحة متاحة للمستشار/المدير فقط.</p>
      </section>
    );
  }

  return (
    <div dir="rtl">
      <section className="panel">
        <div className="page-title-row">
          <div>
            <h2>المؤطرون وإسناد المجموعات</h2>
            <p>إنشاء حسابات المؤطرين وتحديد المجموعات التي يمكن لكل مؤطر إدارتها.</p>
          </div>
          <ShieldCheck size={32} />
        </div>

        {message && <div className="notice">{message}</div>}

        <form className="form" onSubmit={createInstructor}>
          <h3><Plus size={18} /> إضافة مؤطر جديد</h3>

          <div className="fields">
            <label>
              الاسم الكامل*
              <input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
              />
            </label>

            <label>
              رقم/معرّف الدخول*
              <input
                value={form.login_code}
                onChange={(e) => setForm({ ...form, login_code: e.target.value })}
                placeholder="مثال: EDU-001"
                required
              />
            </label>

            <label>
              الهاتف
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>

            <label>
              مقر العمل
              <input
                value={form.workplace}
                onChange={(e) => setForm({ ...form, workplace: e.target.value })}
              />
            </label>

            <label>
              كلمة المرور*
              <input
                type="password"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </label>
          </div>

          <div className="form-actions">
            <button className="primary" disabled={busy}>
              <Save size={17} /> إنشاء الحساب
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h3>قائمة المؤطرين ({instructors.length})</h3>

        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>المؤطر</th>
                <th>رقم الدخول</th>
                <th>الهاتف</th>
                <th>المجموعات المسندة</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>

            <tbody>
              {instructors.map((u) => {
                const ids = assignedGroupIds(u.id);
                return (
                  <tr key={u.id}>
                    <td><b>{u.full_name || "بدون اسم"}</b></td>
                    <td>{u.login_code || "—"}</td>
                    <td>{u.phone || "—"}</td>
                    <td>
                      {ids.length
                        ? ids.map((id) => groupMap[id]?.name || id).join("، ")
                        : "لم تسند أي مجموعة"}
                    </td>
                    <td>
                      {u.is_active ? (
                        <span className="status-good">نشط</span>
                      ) : (
                        <span className="status-bad">معطل</span>
                      )}
                    </td>
                    <td className="actions">
                      <button onClick={() => startAssign(u)} title="إسناد المجموعات">
                        <UserCheck size={17} />
                      </button>
                      <button onClick={() => setEditing({ ...u })} title="تعديل">
                        <Pencil size={17} />
                      </button>
                      <button onClick={() => toggleActive(u)} title={u.is_active ? "تعطيل" : "تفعيل"}>
                        {u.is_active ? <UserX size={17} /> : <UserCheck size={17} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!instructors.length && (
          <div className="empty">لا يوجد مؤطرون بعد.</div>
        )}
      </section>

      {selectedInstructor && (
        <section className="panel">
          <div className="page-title-row">
            <div>
              <h3>إسناد المجموعات إلى: {selectedInstructor.full_name}</h3>
              <p>حدد المجموعات التي سيظهرها هذا المؤطر في حسابه.</p>
            </div>
            <button onClick={() => setSelectedInstructor(null)}>
              <X />
            </button>
          </div>

          <div className="assignment-grid">
            {groups.map((g) => (
              <label className="assignment-card" key={g.id}>
                <input
                  type="checkbox"
                  checked={selectedGroups.includes(g.id)}
                  onChange={() => toggleGroup(g.id)}
                />
                <span>
                  <b>{g.name}</b>
                  <small>{g.educator || "—"}</small>
                </span>
              </label>
            ))}
          </div>

          <div className="form-actions">
            <button className="primary" onClick={saveAssignments} disabled={busy}>
              <Save size={17} /> حفظ الإسناد
            </button>
            <button className="secondary" onClick={() => setSelectedInstructor(null)}>
              إلغاء
            </button>
          </div>
        </section>
      )}

      {editing && (
        <section className="panel">
          <h3>تعديل بيانات المؤطر</h3>
          <form className="form" onSubmit={updateInstructor}>
            <div className="fields">
              <label>
                الاسم الكامل
                <input
                  value={editing.full_name || ""}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                />
              </label>
              <label>
                رقم الدخول
                <input value={editing.login_code || ""} disabled />
              </label>
              <label>
                الهاتف
                <input
                  value={editing.phone || ""}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                />
              </label>
              <label>
                مقر العمل
                <input
                  value={editing.workplace || ""}
                  onChange={(e) => setEditing({ ...editing, workplace: e.target.value })}
                />
              </label>
              <label>
                الحالة
                <select
                  value={editing.is_active ? "active" : "inactive"}
                  onChange={(e) =>
                    setEditing({ ...editing, is_active: e.target.value === "active" })
                  }
                >
                  <option value="active">نشط</option>
                  <option value="inactive">معطل</option>
                </select>
              </label>
            </div>

            <div className="form-actions">
              <button className="primary" disabled={busy}>
                <Save size={17} /> حفظ التعديل
              </button>
              <button type="button" className="secondary" onClick={() => setEditing(null)}>
                إلغاء
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
