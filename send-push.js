// Supabase Edge Function: supabase/functions/send-push/index.ts
// Деплой: supabase functions deploy send-push

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails("mailto:admin@mcearthproject.qzz.io", VAPID_PUBLIC, VAPID_PRIVATE);

serve(async (req) => {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    const { title, body, url } = await req.json();
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: subs } = await sb.from("push_subscriptions").select("subscription");
    if (!subs || subs.length === 0) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

    const payload = JSON.stringify({ title, body, url: url || "/" });
    let sent = 0, failed = 0;

    await Promise.all(subs.map(async (row) => {
        try {
            await webpush.sendNotification(row.subscription, payload);
            sent++;
        } catch (err) {
            failed++;
            // Remove expired/invalid subscriptions
            if (err.statusCode === 410 || err.statusCode === 404) {
                await sb.from("push_subscriptions").delete().eq("subscription", row.subscription);
            }
        }
    }));

    return new Response(JSON.stringify({ sent, failed }), {
        headers: { "Content-Type": "application/json" }
    });
});
