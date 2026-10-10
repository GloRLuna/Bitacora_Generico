import { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const { email, password } = JSON.parse(event.body || '{}');

        const validUser = process.env.LOGIN_USER;
        const validPassword = process.env.LOGIN_PASSWORD;

        if (!validUser || !validPassword) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Servidor no configurado' }) };
        }

        if (email.trim().toLowerCase() !== validUser.toLowerCase() || password !== validPassword) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Credenciales incorrectas' }) };
        }

        // Token simple: base64 del email + timestamp
        const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');

        return { statusCode: 200, body: JSON.stringify({ token }) };
    } catch (error: any) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
