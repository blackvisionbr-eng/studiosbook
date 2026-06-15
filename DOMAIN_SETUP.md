# StudioBook - domínio oficial

Domínio oficial: `studiosbook.com.br`

## Firebase Hosting

O domínio customizado deve ser adicionado no Firebase Console:

1. Abrir `https://console.firebase.google.com/project/blackvision-27f1c/hosting/sites/studiosbook`
2. Entrar em `Add custom domain`
3. Informar `studiosbook.com.br`
4. Seguir os registros TXT/A indicados pelo Firebase
5. Depois da propagação, concluir a verificação SSL

## DNS esperado

O Firebase pode variar os registros por projeto. Em geral, o fluxo informa:

| Tipo | Nome | Valor |
| --- | --- | --- |
| TXT | @ | valor de verificação do Firebase |
| A | @ | IPs informados pelo Firebase |
| CNAME | www | destino informado pelo Firebase |

## Backend Railway

O backend não deve usar o domínio raiz. Use um subdomínio, por exemplo:

```txt
api.studiosbook.com.br
```

No Railway, adicione o domínio customizado no serviço `studiosbook-api` e copie o CNAME informado pelo Railway.

## Cuidados

- Remover outros registros `A` conflitantes no domínio raiz.
- Remover registros `AAAA` dos hostnames usados se o Firebase/Railway não informar IPv6.
- Se usar Cloudflare, deixar os registros como `DNS only` durante a validação.
- A emissão SSL é automática depois que Firebase e Railway validarem os domínios.
- A propagação pode levar até 48-72 horas.
