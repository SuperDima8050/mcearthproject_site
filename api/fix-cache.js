// /api/fix-cache.js
// Одноразовая функция: перезаливает все файлы в бакете Supabase "icons"
// с длинным Cache-Control, чтобы браузеры их кэшировали и переставали
// качать заново каждый визит. Ссылки в index.html не меняются.
//
// После того как один раз успешно отработает — УДАЛИ этот файл из
// репозитория (он никому не должен быть доступен постоянно).

export default async function handler(req, res) {
    const SUPABASE_URL = "https://sqlylxcnoqehorlgmztm.supabase.co";
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    const BUCKET = "icons";
    const CACHE_CONTROL = "max-age=31536000, immutable";

    if (!SERVICE_KEY) {
        return res.status(500).json({ error: "SUPABASE_SERVICE_KEY не задан в Environment Variables" });
    }

    const headers = {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
    };

    async function listAllFiles(prefix = "") {
        const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ prefix, limit: 1000 }),
        });
        const entries = await resp.json();
        let files = [];
        for (const entry of entries) {
            const fullPath = prefix ? prefix + entry.name : entry.name;
            if (entry.id == null && entry.metadata == null) {
                files = files.concat(await listAllFiles(fullPath + "/"));
            } else {
                files.push(fullPath);
            }
        }
        return files;
    }

    async function reupload(path) {
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
        const fileResp = await fetch(publicUrl);
        if (!fileResp.ok) return { path, ok: false, reason: `download ${fileResp.status}` };

        const contentType = fileResp.headers.get("content-type") || "application/octet-stream";
        const buffer = await fileResp.arrayBuffer();

        const uploadResp = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
            method: "POST",
            headers: {
                ...headers,
                "Content-Type": contentType,
                "cache-control": CACHE_CONTROL,
                "x-upsert": "true",
            },
            body: buffer,
        });

        if (uploadResp.ok) return { path, ok: true };
        return { path, ok: false, reason: `upload ${uploadResp.status}` };
    }

    try {
        const files = await listAllFiles();
        const results = [];
        for (const path of files) {
            results.push(await reupload(path));
        }
        const okCount = results.filter(r => r.ok).length;
        return res.status(200).json({
            total: files.length,
            success: okCount,
            details: results,
        });
    } catch (err) {
        return res.status(500).json({ error: String(err) });
    }
}
