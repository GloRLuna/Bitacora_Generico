import { Handler } from '@netlify/functions';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

export const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const { to, cc, subject, text, pdfBase64 } = JSON.parse(event.body || '{}');
        const base64Data = pdfBase64; // ya llega limpio sin prefijo data URI

        const toArray = to.split(/[,;]/).map((e: string) => e.trim()).filter(Boolean);
        const ccArray = cc ? cc.split(/[,;]/).map((e: string) => e.trim()).filter(Boolean) : [];

        await transporter.sendMail({
            from: `Bitácora SOC <${process.env.GMAIL_USER}>`,
            to: toArray,
            cc: ccArray,
            subject,
            text,
            attachments: [{
                filename: 'Bitacora_SOC.pdf',
                content: Buffer.from(base64Data, 'base64'),
                contentType: 'application/pdf',
            }],
        });

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error: any) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
