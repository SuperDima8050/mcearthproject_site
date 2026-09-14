// /api/fix-cache.js
// Безопасный скрипт для обновления Cache-Control в бакете "icons"

module.exports = async function handler(req, res) {
    const SUPABASE_URL = "https://sqlylxcnoqehorlgmztm.supabase.co";
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    const BUCKET = "icons";
    // Устанавливаем кэш на 1 год (31536000 секунд)
    const CACHE_CONTROL = "max-age=31536000, immutable";

    if (!SERVICE_KEY) {
        return res.status(500).json({ error: "SUPABASE_SERVICE_KEY не задан в Environment Variables" });
    }

    const headers = {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
    };

    // 1. Функция рекурсивного поиска файлов (исправленная)
    async function listAllFiles(prefix = "") {
        const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ prefix, limit: 1000 }),
        });
        
        if (!resp.ok) throw new Error(`Не удалось получить список: ${resp.status}`);
        
        const entries = await resp.json();
        let files = [];
        
        for (const entry of entries) {
            // Формируем правильный путь без двойных слэшей
            const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
            
            // Если у объекта нет id и metadata — это папка
            if (entry.id == null && entry.metadata == null) {
                files = files.concat(await listAllFiles(fullPath));
            } else {
                files.push(fullPath);
            }
        }
        return files;
    }

    // 2. Функция перезаписи заголовков кэша
    async function reupload(path) {
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
        const fileResp = await fetch(publicUrl);
        if (!fileResp.ok) return { path, ok: false, reason: `Скачивание: ${fileResp.status}` };

        const contentType = fileResp.headers.get("content-type") || "application/octet-stream";
        const buffer = await fileResp.arrayBuffer();

        // Загружаем файл обратно поверх старого с нужным cache-control
        const uploadResp = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
            method: "POST",
            headers: {
                ...headers,
                "Content-Type": contentType,
                "cache-control": CACHE_CONTROL,
                "x-upsert": "true", // Разрешаем перезапись
            },
            body: buffer,
        });

        if (uploadResp.ok) return { path, ok: true };
        return { path, ok: false, reason: `Загрузка: ${uploadResp.status}` };
    }

    try {
        const files = await listAllFiles();
        const results = [];
        
        // Обрабатываем файлы по очереди
        for (const path of files) {
            results.push(await reupload(path));
        }
        
        const okCount = results.filter(r => r.ok).length;
        return res.status(200).json({
            message: "Кэш успешно обновлен для старых файлов!",
            total: files.length,
            success: okCount,
            details: results,
        });
    } catch (err) {
        return res.status(500).json({ error: String(err) });
    }
}
