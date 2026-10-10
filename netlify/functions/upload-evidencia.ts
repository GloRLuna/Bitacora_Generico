import { Handler } from '@netlify/functions';


export const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const appsScriptUrl = process.env.APPS_SCRIPT_URL;
        if (!appsScriptUrl) {
            return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'APPS_SCRIPT_URL no configurada' }) };
        }

        const { base64, filename, mimeType, fecha } = JSON.parse(event.body || '{}');

        if (!base64 || !filename) {
            return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Faltan base64 o filename' }) };
        }

        const payload = JSON.stringify({ action: 'uploadFile', base64, filename, mimeType, fecha });

        const resp = await fetch(appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'data=' + encodeURIComponent(payload),
        });

        const json = await resp.json();
        return { statusCode: 200, body: JSON.stringify(json) };
    } catch (error: any) {
        return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message }) };
    }
};
