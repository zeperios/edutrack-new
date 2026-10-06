import { withSupabase } from "npm:@supabase/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    // The caller must be an advisor. The RLS-backed client checks the actual profile.
    const { data: caller, error: callerError } = await ctx.supabase
      .from("profiles")
      .select("id,account_role,is_active")
      .eq("id", ctx.userClaims?.sub)
      .single();

    if (callerError || !caller || caller.account_role !== "advisor" || !caller.is_active) {
      return json({ error: "غير مصرح. هذه العملية متاحة للمستشار فقط." }, 403);
    }

    const body = await req.json();

    const full_name = String(body.full_name ?? "").trim();
    const login_code = String(body.login_code ?? "").trim();
    const phone = body.phone ? String(body.phone).trim() : null;
    const workplace = body.workplace ? String(body.workplace).trim() : null;
    const password = String(body.password ?? "");
    const is_active = body.is_active !== false;

    if (!full_name || !login_code || password.length < 8) {
      return json({ error: "الاسم ورقم الدخول وكلمة مرور من 8 أحرف على الأقل مطلوبة." }, 400);
    }

    // Internal email: the instructor logs in with login_code in the app.
    // This address is never shown to the instructor.
    const safeCode = login_code.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
    const auth_email = `instructor-${safeCode}@edutrack.local`;

    const { data: existing } = await ctx.supabaseAdmin
      .from("profiles")
      .select("id")
      .or(`login_code.eq.${login_code},auth_email.eq.${auth_email}`)
      .maybeSingle();

    if (existing) {
      return json({ error: "رقم/معرّف الدخول مستخدم مسبقًا." }, 409);
    }

    const { data: created, error: createError } =
      await ctx.supabaseAdmin.auth.admin.createUser({
        email: auth_email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });

    if (createError || !created.user) {
      return json({ error: createError?.message || "تعذر إنشاء حساب المصادقة." }, 400);
    }

    const { error: profileError } = await ctx.supabaseAdmin
      .from("profiles")
      .insert({
        id: created.user.id,
        full_name,
        role: "user",
        account_role: "instructor",
        login_code,
        auth_email,
        phone,
        workplace,
        is_active,
      });

    if (profileError) {
      // Compensating action: remove the Auth account if the profile could not be created.
      await ctx.supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return json({ error: profileError.message }, 400);
    }

    return json({
      ok: true,
      instructor_id: created.user.id,
      login_code,
    });
  }),
};
