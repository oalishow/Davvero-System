# Diretrizes e Checklist de Segurança Obrigatória

Este documento estabelece os critérios inegociáveis de segurança para a arquitetura do DAVVERO / FAJOPA. Esta checklist deve ser **revisada e validada obrigatoriamente** antes de aceitar qualquer alteração ou sugestão que toque em `firestore.rules`, `storage.rules`, controle de acesso (RBAC) ou endpoints do servidor.

---

## 🛡️ Checklist Pré-Aprovação de Regras e Código

Antes de aplicar qualquer modificação nas regras de segurança do Firestore/Storage ou no backend, verifique cada um dos 4 itens abaixo:

- [ ] **1. Proibição Absoluta de Escrita Aberta:**  
  **Nunca** usar `allow write: if true`, `allow create: if true` ou `allow read, write: if true` em nenhuma coleção, subcoleção ou coringa `{document=**}`.

- [ ] **2. Não Confiar em Domínios de E-mail para Privilégios Administrativos:**  
  **Nunca** conceder permissões de administrador (`isAdmin`) com base em sufixo ou domínio de e-mail (como `@gmail.com` ou `@fajopa.edu.br`). Privilégios de administração devem ser concedidos exclusivamente via coleção dedicada e controlada (`/admins/{uid}`) ou lista de UIDs restritos explicitamente autorizados.

- [ ] **3. Proteção de Dados Pessoais (LGPD e Autenticação Real):**  
  Toda operação de escrita em coleções que contenham dados pessoais, sensíveis ou cadastrais (como alunos, histórico acadêmico, registros de funcionários e convites) exige **autenticação real** e identificada, e não apenas sessão anônima (`loginAnon()`).

- [ ] **4. Nenhuma Chave Privada com Valor de Fallback no Código-Fonte:**  
  Nenhum segredo, chave privada (ex.: `VAPID_PRIVATE_KEY`, tokens de serviço, credenciais de API) deve conter valor default ou fallback hardcoded no repositório. Devem ser carregados **exclusivamente via variáveis de ambiente**, gerando erro explícito no log do servidor quando ausentes.

---

## 📋 Histórico e Referência das Regras
- O arquivo fonte oficial das regras do Firestore é o **`firestore.rules`** na raiz do projeto.
- Documentos de orientação antiga (como `REGRAS_FIREBASE_CORRECAO.md`) foram desativados e marcados como obsoletos por conterem diretivas permissivas inseguras.
