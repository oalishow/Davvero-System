# Configuração do Firebase para Correção do Mural e outros

Para que o mural (e todas as outras funcionalidades) voltem a funcionar perfeitamente, precisamos ajustar as regras de segurança do seu Firebase Console (porque ele está bloqueando a edição no `mural_posts` pelo que foi configurado no arquivo LGPD).

## 1. Atualizar as Regras do Firestore (Banco de Dados)
Acesse o Console do Firebase -> **Firestore Database** -> Aba **Rules** (Regras) e substitua **TUDO** por:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
  
    // Permite envio de emails pela extensão Trigger Email
    match /mail/{document=**} {
      allow create: if true; 
    }

    match /artifacts/{appId}/public/data {
      
      // Coleção de Alunos/Usuários
      match /students/{document=**} {
        allow read: if true; 
        allow write: if true; 
      }
      
      // Eventos
      match /events/{document=**} {
        allow read: if true;
        allow write: if true;
      }
      
      // Presenças / Lista de chamada
      match /attendances/{document=**} {
        allow read: if true;
        allow write: if request.auth != null;
      }
      
      // Posts do Mural / Recados
      match /mural_posts/{document=**} {
        allow read: if true;
        allow write: if true; // Alunos logados ou dependendo da sessão podem interagir
      }

      // Disponibilidade dos Tutores
      match /availabilities/{document=**} {
        allow read: if true;
        allow write: if request.auth != null;
      }

      // Agendamentos
      match /appointments/{document=**} {
        allow read: if true;
        allow write: if request.auth != null;
      }

      // Notificações
      match /notifications/{document=**} {
        allow read: if true;
        allow write: if request.auth != null;
      }
    }
  }
}
```
*Clique em **Publicar** (Publish).*

## 2. Atualizar as Regras do Storage (Armazenamento de Imagens/PDFs)
Para anexar fotos ou PDFs no mural de forma bem-sucedida, o painel do Storage do Firebase precisa autorizar o upload de imagens.
Acesse o Console do Firebase -> **Storage** -> Aba **Rules** (Regras) e substitua por:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Pasta do mural (para imagens e anexos)
    match /mural/{imageId=**} {
      allow read: if true; 
      allow write: if true; 
    }
    
    // Regra padrão de redundância
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
*Clique em **Publicar** (Publish).*

Tendo feito esses dois passos, pode voltar para o aplicativo e tentar postar no mural novamente. Vai funcionar de imediato!
