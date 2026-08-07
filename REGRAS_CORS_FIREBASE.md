# Como corrigir o erro de CORS do Firebase Storage

O Firebase Storage bloqueia uploads feitos diretamente do navegador por padrão, a menos que o domínio de origem seja explicitamente autorizado. Como você está usando a pré-visualização (e não a URL padrão do appspot.com), você precisa configurar o **CORS** (Cross-Origin Resource Sharing) no seu bucket do Google Cloud Platform (GCP).

## Passo a Passo para habilitar o Upload:

1. Acesse o **Google Cloud Console**: https://console.cloud.google.com/
2. Faça login com a mesma conta Google que você usa no Firebase.
3. No painel superior, selecione o seu projeto: `banco-de-dados-fajopa`
4. Abra o **Cloud Shell** (é um ícone de "terminal / terminal com >_" no canto superior direito).
5. O terminal vai abrir na parte inferior da tela. Dentro do terminal, crie um arquivo chamado `cors.json` executando exatamente este comando:

```bash
echo '[{"origin": ["*"],"responseHeader": ["Content-Type"],"method": ["GET", "HEAD", "POST", "PUT", "DELETE"],"maxAgeSeconds": 3600}]' > cors.json
```

6. Em seguida, aplique as regras no seu bucket do Storage executando este comando no mesmo terminal:

```bash
gsutil cors set cors.json gs://banco-de-dados-fajopa.appspot.com
```

**(Opcional para novos buckets criados)**: Caso a versão do seu `gsutil` for nova e você ver avisos de usar o `gcloud storage`, o comando é:
```bash
gcloud storage buckets update gs://banco-de-dados-fajopa.appspot.com --cors-file=cors.json
```

Pronto! Atualize a página do aplicativo aqui e os uploads de arquivos, PDFs e imagens no Mural irão funcionar imediatamente sem travar na porcentagem.
