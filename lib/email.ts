import { Resend } from "resend";

// Remetente. Configure EMAIL_FROM em produção (ex.: "DRR Projetos <nao-responda@drrprojetos.com.br>").
// Sem domínio verificado no Resend, use o remetente de teste deles.
const FROM = process.env.EMAIL_FROM || "DRR Projetos <onboarding@resend.dev>";

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

// Envia um e-mail. Retorna true se enviou. Nunca lança — se não estiver
// configurado (sem RESEND_API_KEY), apenas registra e segue.
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn(`[email] RESEND_API_KEY ausente — não enviado: "${opts.subject}" para ${opts.to}`);
    return false;
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) {
      console.error("[email] erro do Resend:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] falha ao enviar:", e);
    return false;
  }
}

// Layout HTML com a cara da DRR (estilos inline p/ compatibilidade com e-mail).
// subtitle: texto ao lado da marca (ex.: a seção de origem do aviso).
export function emailLayout(heading: string, bodyHtml: string, subtitle = "Equipamentos"): string {
  return `
  <div style="background:#f1f5f9;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
      <div style="background:#0a1628;padding:20px 28px;">
        <span style="color:#ffffff;font-size:18px;font-weight:bold;">DRR&nbsp;Projetos</span>
        <span style="color:#94a3b8;font-size:12px;"> · ${subtitle}</span>
      </div>
      <div style="padding:28px;">
        <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;">${heading}</h1>
        <div style="font-size:14px;line-height:1.6;color:#334155;">${bodyHtml}</div>
      </div>
      <div style="padding:16px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;font-size:11px;color:#94a3b8;">
        Este é um e-mail automático do sistema de gestão da DRR Projetos. Se não reconhece esta ação, ignore.
      </div>
    </div>
  </div>`;
}

// Botão grande (CTA) para os e-mails.
export function emailButton(label: string, href: string): string {
  return `<div style="margin:20px 0;"><a href="${href}" style="display:inline-block;background:#f0a500;color:#0a1628;font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;">${label}</a></div>`;
}

// Código grande e destacado (para o reset de senha).
export function emailCode(code: string): string {
  return `<div style="margin:20px 0;text-align:center;"><span style="display:inline-block;background:#f1f5f9;border:1px dashed #cbd5e1;border-radius:8px;padding:14px 28px;font-size:28px;font-weight:bold;letter-spacing:6px;color:#0f172a;">${code}</span></div>`;
}
