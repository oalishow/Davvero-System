import { AppSettings } from '../context/SettingsContext';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface EmailTemplateConfig {
  subject: string;
  title: string;
  body: string;
  buttonText: string;
}

export type EmailTemplateKey = 
  | 'pendingStudent' 
  | 'approvedStudent' 
  | 'rejectedStudent'
  | 'deactivatedStudent'
  | 'newRequestSecretariat' 
  | 'editSuggestionSecretariat'
  | 'certificateAvailableOrganizer'
  | 'certificateAvailableAttendee';

export interface EmailTemplatesSettings {
  pendingStudent?: EmailTemplateConfig;
  approvedStudent?: EmailTemplateConfig;
  rejectedStudent?: EmailTemplateConfig;
  deactivatedStudent?: EmailTemplateConfig;
  newRequestSecretariat?: EmailTemplateConfig;
  editSuggestionSecretariat?: EmailTemplateConfig;
  certificateAvailableOrganizer?: EmailTemplateConfig;
  certificateAvailableAttendee?: EmailTemplateConfig;
}

export const DEFAULT_EMAIL_TEMPLATES: Record<EmailTemplateKey, EmailTemplateConfig> = {
  pendingStudent: {
    subject: "Recebemos sua Solicitação de Cadastro - {{headerName}}",
    title: "Recebemos sua Solicitação de Cadastro ⏳",
    body: `<p>Olá, <strong>{{name}}</strong>!</p>
<p>Recebemos com sucesso a sua solicitação de identificação no <strong>{{instName}}</strong> através do <strong>{{headerName}}</strong>.</p>
<div class="highlight-card">
  <p style="margin: 0 0 6px; font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase;">Código de Acompanhamento (AlphaCode):</p>
  <div style="font-size: 26px; font-weight: 900; letter-spacing: 2px; color: #0284c7;">{{alphaCode}}</div>
  <p style="margin: 6px 0 0; font-size: 12px; color: #64748b;">Status: <strong>Pendente de Homologação pela Secretaria</strong></p>
</div>
<p>Nossa equipe está conferindo as informações e a sua foto. Assim que a validação for concluída, você receberá uma nova notificação por e-mail com a liberação da sua carteirinha digital.</p>`,
    buttonText: "Acompanhar Minha Solicitação"
  },
  approvedStudent: {
    subject: "Sua Carteirinha Foi Aprovada! 🎉 - {{headerName}}",
    title: "Sua Carteirinha Foi Aprovada! 🎉",
    body: `<p>Olá, <strong>{{name}}</strong>!</p>
<p>Temos ótimas notícias! A sua solicitação de identificação no <strong>{{instName}}</strong> foi avaliada e <strong>aprovada</strong> pela secretaria com sucesso.</p>
<div class="highlight-card">
  <p style="margin: 0 0 6px; font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase;">Seu Código de Identificação (AlphaCode):</p>
  <div style="font-size: 26px; font-weight: 900; letter-spacing: 2px; color: #0284c7;">{{alphaCode}}</div>
  <p style="margin: 6px 0 0; font-size: 12px; color: #64748b;">Vínculo: <strong>{{roles}}</strong></p>
</div>
<p>Você já pode acessar o aplicativo com seu RA ou CPF para visualizar e emitir a sua <strong>Carteirinha Digital Oficial</strong> com QR Code de autenticidade.</p>`,
    buttonText: "Acessar Minha Carteirinha"
  },
  rejectedStudent: {
    subject: "Aviso sobre Solicitação de Carteirinha - {{headerName}}",
    title: "Status da Solicitação de Carteirinha ⚠️",
    body: `<p>Olá, <strong>{{name}}</strong>!</p>
<p>Informamos que a sua solicitação de identificação no <strong>{{instName}}</strong> não pôde ser homologada pela secretaria neste momento.</p>
<div class="highlight-card" style="border-left-color: #ef4444; background: #fef2f2;">
  <p style="margin: 0 0 4px; font-size: 12px; color: #dc2626; font-weight: 700; text-transform: uppercase;">Motivo / Observação da Secretaria:</p>
  <p style="margin: 0; font-size: 14px; color: #991b1b; font-weight: 500;">{{reason}}</p>
</div>
<p>Caso queira corrigir os dados, reenviar uma foto nítida de acordo com os padrões ou tirar dúvidas, acesse o aplicativo e realize um novo envio ou contate a secretaria.</p>`,
    buttonText: "Acessar Sistema para Corrigir"
  },
  deactivatedStudent: {
    subject: "Aviso de Desativação de Carteirinha - {{headerName}}",
    title: "Carteirinha Digital Desativada 🛑",
    body: `<p>Olá, <strong>{{name}}</strong>.</p>
<p>Informamos que a sua carteirinha digital no <strong>{{instName}}</strong> foi temporariamente <strong>desativada / suspensa</strong> pela administração.</p>
<div class="highlight-card" style="border-left-color: #f59e0b; background: #fffbeb;">
  <p style="margin: 0 0 4px; font-size: 12px; color: #b45309; font-weight: 700; text-transform: uppercase;">Status do Cadastro:</p>
  <p style="margin: 0 0 6px; font-size: 14px; color: #92400e;"><strong>Identificação:</strong> {{name}} (RA: {{ra}})</p>
  <p style="margin: 0; font-size: 14px; color: #92400e;"><strong>Motivo / Observação:</strong> {{reason}}</p>
</div>
<p>Durante o período em que a carteirinha permanecer inativa, a validação por QR Code constará como suspensa. Para regularizar a situação ou solicitar reativação, procure a secretaria.</p>`,
    buttonText: "Acessar Portal do Aluno"
  },
  newRequestSecretariat: {
    subject: "[{{headerName}}] Nova Solicitação de Carteirinha: {{name}}",
    title: "Nova Solicitação de Carteirinha Pendente 📬",
    body: `<p>Olá, equipe da <strong>Secretaria</strong>!</p>
<p>Uma nova solicitação de cadastro/carteirinha foi registrada no <strong>{{headerName}}</strong> e aguarda a sua homologação.</p>
<div class="highlight-card">
  <p style="margin:0 0 4px;"><strong>Nome:</strong> {{name}}</p>
  <p style="margin:0 0 4px;"><strong>Vínculo:</strong> {{roles}}</p>
  <p style="margin:0 0 4px;"><strong>Curso:</strong> {{course}}</p>
  <p style="margin:0 0 4px;"><strong>Diocese / Seminário:</strong> {{diocese}} - {{seminary}}</p>
  <p style="margin:0 0 4px;"><strong>E-mail:</strong> {{email}}</p>
  <p style="margin:0 0 4px;"><strong>RA:</strong> {{ra}}</p>
  <p style="margin:0;"><strong>Código:</strong> {{alphaCode}}</p>
</div>
<p>Acesse o Painel Administrativo para revisar a foto, dados cadastrais e homologar a emissão.</p>`,
    buttonText: "Acessar Painel da Secretaria"
  },
  editSuggestionSecretariat: {
    subject: "[{{headerName}}] Sugestão de Edição de Dados: {{name}}",
    title: "Nova Sugestão de Edição de Perfil 📝",
    body: `<p>Olá, equipe da <strong>Secretaria</strong>!</p>
<p>O usuário <strong>{{name}}</strong> (RA: <strong>{{ra}}</strong>) enviou uma <strong>sugestão de correção em seus dados cadastrais</strong> para análise.</p>
<div class="highlight-card">
  <p style="margin:0 0 4px;"><strong>Nome:</strong> {{name}}</p>
  <p style="margin:0 0 4px;"><strong>Vínculo:</strong> {{roles}}</p>
  <p style="margin:0 0 4px;"><strong>Curso:</strong> {{course}}</p>
  <p style="margin:0 0 4px;"><strong>Diocese / Seminário:</strong> {{diocese}} - {{seminary}}</p>
  <p style="margin:0 0 4px;"><strong>E-mail:</strong> {{email}}</p>
  <p style="margin:0 0 4px;"><strong>Código:</strong> {{alphaCode}}</p>
  <p style="margin:0;"><strong>Alterações Propostas:</strong> {{changedFields}}</p>
</div>
<p>Acesse o Painel Administrativo para conferir as diferenças e aprovar ou rejeitar a solicitação.</p>`,
    buttonText: "Revisar Alteração no Painel"
  },
  certificateAvailableOrganizer: {
    subject: "Seu Certificado de Organização Está Disponível! 🏆 - {{eventTitle}}",
    title: "Certificado de Organização Disponível 🏆",
    body: `<p>Olá, <strong>{{name}}</strong>!</p>
<p>Agradecemos imensamente pela sua valorosa dedicação como membro da <strong>Comissão Organizadora</strong> do evento <strong>{{eventTitle}}</strong>.</p>
<div class="highlight-card" style="border-left-color: #f59e0b; background: #fffbeb;">
  <p style="margin:0 0 4px; font-size: 13px; color: #b45309; font-weight:700; text-transform: uppercase;">Dados da Certificação Oficial:</p>
  <p style="margin:0 0 4px;"><strong>Evento:</strong> {{eventTitle}}</p>
  <p style="margin:0 0 4px;"><strong>Função:</strong> Comissão Organizadora</p>
  <p style="margin:0 0 4px;"><strong>Carga Horária:</strong> {{hours}}</p>
  <p style="margin:0;"><strong>Instituição:</strong> {{instName}}</p>
</div>
<p>O seu <strong>Certificado Oficial de Organizador(a)</strong> já foi homologado e emitido com autenticação digital via QR Code. Você já pode visualizá-lo e fazer o download do documento em PDF de alta qualidade.</p>`,
    buttonText: "Acessar e Baixar Meu Certificado"
  },
  certificateAvailableAttendee: {
    subject: "Seu Certificado de Participação Está Disponível! 📜 - {{eventTitle}}",
    title: "Certificado de Participação Disponível 📜",
    body: `<p>Olá, <strong>{{name}}</strong>!</p>
<p>Informamos que o seu <strong>Certificado de Participação</strong> referente ao evento <strong>{{eventTitle}}</strong> já está liberado para emissão no sistema.</p>
<div class="highlight-card">
  <p style="margin:0 0 4px;"><strong>Evento:</strong> {{eventTitle}}</p>
  <p style="margin:0 0 4px;"><strong>Carga Horária:</strong> {{hours}}</p>
  <p style="margin:0;"><strong>Instituição:</strong> {{instName}}</p>
</div>
<p>Acesse o aplicativo para visualizar seu certificado com código de verificação autêntico e fazer o download do arquivo em alta definição.</p>`,
    buttonText: "Visualizar Meu Certificado"
  }
};

/**
 * Normaliza e extrai uma lista limpa de e-mails válidos a partir de strings separadas por vírgula, ponto e vírgula, espaços ou quebras de linha
 */
export function parseEmailList(input?: string | string[]): string[] {
  if (!input) return [];
  const rawList = Array.isArray(input) ? input : String(input).split(/[,;\s\n\r\t]+/);
  return rawList
    .map(e => e.trim())
    .filter(e => e.length > 3 && e.includes('@') && !e.startsWith('@') && !e.endsWith('@'));
}

/**
 * Substitui tags dinâmicas como {{name}}, {{alphaCode}}, {{instName}}, {{headerName}}, {{reason}}, etc.
 */
export function interpolateVariables(template: string, vars: Record<string, string | undefined>): string {
  if (!template) return '';
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    return vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : '';
  });
}

/**
 * Monta o e-mail completo a partir dos templates personalizados ou padrões com as variáveis interpoladas
 */
export function getCompiledEmail({
  templateKey,
  customTemplates,
  vars,
  settings,
  buttonUrl,
  customTitle,
  customPreheader
}: {
  templateKey: EmailTemplateKey;
  customTemplates?: EmailTemplatesSettings;
  vars: Record<string, string | undefined>;
  settings?: AppSettings;
  buttonUrl?: string;
  customTitle?: string;
  customPreheader?: string;
}) {
  const baseTpl = customTemplates?.[templateKey] || DEFAULT_EMAIL_TEMPLATES[templateKey];
  const instName = settings?.instName || 'DAVVERO System';
  const headerName = settings?.emailHeaderName || 'DAVVERO System';
  const instColor = settings?.instColor || '#0ea5e9';

  const mergedVars: Record<string, string | undefined> = {
    instName,
    headerName,
    appName: headerName,
    reason: 'Conforme orientações do regimento institucional.',
    hours: '10 Horas Complementares',
    eventTitle: 'Evento Institucional',
    date: new Date().toLocaleDateString('pt-BR'),
    ...vars
  };

  const rawSubject = baseTpl?.subject || DEFAULT_EMAIL_TEMPLATES[templateKey].subject;
  const rawTitle = customTitle || baseTpl?.title || DEFAULT_EMAIL_TEMPLATES[templateKey].title;
  const rawBody = baseTpl?.body || DEFAULT_EMAIL_TEMPLATES[templateKey].body;
  const rawButtonText = baseTpl?.buttonText || DEFAULT_EMAIL_TEMPLATES[templateKey].buttonText;

  const subject = interpolateVariables(rawSubject, mergedVars);
  const title = interpolateVariables(rawTitle, mergedVars);
  const bodyHtml = interpolateVariables(rawBody, mergedVars);
  const buttonText = interpolateVariables(rawButtonText, mergedVars);

  const fullHtml = generateEmailTemplate({
    title,
    preheader: customPreheader ? interpolateVariables(customPreheader, mergedVars) : undefined,
    contentHtml: bodyHtml,
    buttonText: buttonUrl ? buttonText : undefined,
    buttonUrl,
    headerName: headerName,
    institutionName: instName,
    institutionColor: instColor,
    logoMode: settings?.emailLogoMode,
    customLogoUrl: settings?.emailCustomLogoUrl,
    institutionLogo: settings?.instLogo || undefined
  });

  return {
    subject,
    title,
    bodyHtml,
    buttonText,
    fullHtml
  };
}

/**
 * Envia e-mail através do endpoint seguro do servidor backend (/api/email/send)
 */
export async function sendEmailNotification(options: SendEmailOptions, customSmtp?: AppSettings['smtpConfig']): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...options,
        customSmtp
      }),
    });

    const data = await res.json();
    return data;
  } catch (error: any) {
    console.warn('[EmailNotifier] Falha na requisição de e-mail:', error);
    return { success: false, error: error?.message || 'Erro de conexão com o serviço de e-mail.' };
  }
}

/**
 * Template de e-mail com layout moderno, responsivo, logotipo oficial do Davvero System e personalização
 */
export function generateEmailTemplate({
  title,
  preheader,
  contentHtml,
  buttonText,
  buttonUrl,
  headerName = 'DAVVERO System',
  institutionName = 'DAVVERO System',
  institutionColor = '#0ea5e9',
  logoMode = 'davvero',
  customLogoUrl,
  institutionLogo
}: {
  title: string;
  preheader?: string;
  contentHtml: string;
  buttonText?: string;
  buttonUrl?: string;
  headerName?: string;
  institutionName?: string;
  institutionColor?: string;
  logoMode?: 'davvero' | 'institution' | 'custom' | 'none';
  customLogoUrl?: string;
  institutionLogo?: string;
}): string {
  // Gera o HTML do Logotipo
  let logoHtml = '';

  if (logoMode === 'none') {
    logoHtml = '';
  } else if (logoMode === 'custom' && customLogoUrl) {
    logoHtml = `
      <div style="margin-bottom: 12px;">
        <img src="${customLogoUrl}" alt="Logo" style="max-height: 52px; max-width: 180px; object-fit: contain;" />
      </div>
    `;
  } else if (logoMode === 'institution' && institutionLogo) {
    logoHtml = `
      <div style="margin-bottom: 12px;">
        <img src="${institutionLogo}" alt="${institutionName}" style="max-height: 52px; max-width: 180px; object-fit: contain;" />
      </div>
    `;
  } else {
    // Padrão: Logotipo Oficial do DAVVERO System
    logoHtml = `
      <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto 14px auto;">
        <tr>
          <td style="background-color: #ffffff; padding: 10px 18px; border-radius: 12px; box-shadow: 0 4px 14px rgba(0,0,0,0.12); text-align: center;">
            <table border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align: middle; padding-right: 10px;">
                  <!-- DAVVERO Icon Badge -->
                  <div style="width: 32px; height: 32px; background: linear-gradient(135deg, ${institutionColor} 0%, #0284c7 100%); border-radius: 8px; text-align: center; line-height: 32px; color: #ffffff; font-weight: 900; font-size: 18px; font-family: sans-serif;">
                    D
                  </div>
                </td>
                <td style="vertical-align: middle; text-align: left;">
                  <div style="font-size: 15px; font-weight: 900; letter-spacing: 1px; color: #0f172a; text-transform: uppercase; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    DAVVERO <span style="color: ${institutionColor}; font-weight: 700;">SYSTEM</span>
                  </div>
                  <div style="font-size: 9px; font-weight: 700; letter-spacing: 0.5px; color: #64748b; text-transform: uppercase; margin-top: 1px;">
                    Plataforma de Identificação Digital
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
  }

  const effectiveHeader = headerName || institutionName || 'DAVVERO System';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; -webkit-font-smoothing: antialiased; }
    .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.07); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(145deg, ${institutionColor} 0%, #0369a1 100%); padding: 34px 24px 28px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 21px; font-weight: 800; letter-spacing: -0.4px; text-shadow: 0 1px 2px rgba(0,0,0,0.1); }
    .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.92; font-weight: 500; }
    .content { padding: 34px 28px; font-size: 15px; color: #334155; }
    .highlight-card { background: #f8fafc; border-left: 4px solid ${institutionColor}; border-radius: 10px; padding: 18px 20px; margin: 22px 0; font-size: 14px; }
    .btn-container { text-align: center; margin: 32px 0 12px; }
    .btn { display: inline-block; background: ${institutionColor}; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 30px; font-weight: 800; font-size: 14px; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(14, 165, 233, 0.35); text-transform: uppercase; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; background: #f8fafc; border-top: 1px solid #f1f5f9; }
    .footer strong { color: #64748b; }
    .badge { display: inline-block; padding: 4px 12px; font-size: 12px; font-weight: 700; border-radius: 20px; background: #e0f2fe; color: #0369a1; }
  </style>
</head>
<body>
  ${preheader ? `<div style="display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</div>` : ''}
  <div class="container">
    <div class="header">
      ${logoHtml}
      <h1>${effectiveHeader}</h1>
      <p>Notificação Automática do Sistema</p>
    </div>
    
    <div class="content">
      <h2 style="margin-top:0;font-size:18px;color:#0f172a;font-weight:700;letter-spacing:-0.3px;">${title}</h2>
      
      ${contentHtml}
      
      ${buttonText && buttonUrl ? `
        <div class="btn-container">
          <a href="${buttonUrl}" class="btn" target="_blank">${buttonText}</a>
        </div>
      ` : ''}
    </div>
    
    <div class="footer">
      <p style="margin:0 0 6px;">Esta é uma mensagem automática enviada pelo <strong>${effectiveHeader}</strong>.</p>
      <p style="margin:0;">Por favor, não responda diretamente a este e-mail.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}


