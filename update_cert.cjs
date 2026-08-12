const fs = require('fs');

let file = fs.readFileSync('src/components/CertificateRenderer.tsx', 'utf8');

// Add import
if (!file.includes("QRCodeSVG")) {
    file = file.replace("import React, { forwardRef } from 'react';", "import React, { forwardRef } from 'react';\nimport { QRCodeSVG } from 'qrcode.react';");
}

const oldEnd = `        {/* Assinatura / Logo */}
        <div className="absolute bottom-6 right-10 opacity-30 pointer-events-none z-10">
          <p className={\`text-[12px] font-bold uppercase tracking-widest \${template.bgStyle === 'theme-solemn' ? 'text-slate-500' : 'text-slate-900'}\`}>Powered by DAVVERO System & FAJOPA</p>
        </div>
      </div>
    );
  }
);`;

const newEnd = `        {/* Código de Verificação */}
        <div className="absolute bottom-6 left-10 z-10 flex items-center gap-4">
          <div className="bg-white p-2 rounded shadow-sm border border-slate-200">
            <QRCodeSVG 
               value={\`\${window.location.origin}/verify?cert=\${event.id.slice(0,8).toUpperCase()}-\${(member.id || member.ra || "DOC").slice(0,8).toUpperCase()}\`} 
               size={64} 
               level="M" 
               includeMargin={false} 
            />
          </div>
          <div className={\`flex flex-col \${template.bgStyle === 'theme-solemn' ? 'text-slate-400' : 'text-slate-600'}\`}>
             <p className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-80">Validação Autenticidade</p>
             <p className="text-[14px] font-mono font-bold">\${event.id.slice(0,6).toUpperCase()}-\${(member.id || member.ra || "DOC").slice(0,6).toUpperCase()}</p>
          </div>
        </div>

        {/* Assinatura / Logo */}
        <div className="absolute bottom-6 right-10 opacity-30 pointer-events-none z-10">
          <p className={\`text-[12px] font-bold uppercase tracking-widest \${template.bgStyle === 'theme-solemn' ? 'text-slate-500' : 'text-slate-900'}\`}>Powered by DAVVERO System & FAJOPA</p>
        </div>
      </div>
    );
  }
);`;

file = file.replace(oldEnd, newEnd);
fs.writeFileSync('src/components/CertificateRenderer.tsx', file);
