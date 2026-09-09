# StudiosBook - domínio oficial

Domínio oficial: `studiosbook.com.br`
Domínio com www: `www.studiosbook.com.br`

Status em 15/06/2026:

- `studiosbook.com.br`: ativo no Firebase Hosting.
- `www.studiosbook.com.br`: adicionado no Firebase Hosting e aguardando criação do CNAME no DNS do Registro.br.

## Firebase Hosting

O domínio customizado deve ser adicionado no Firebase Console:

1. Abrir `https://console.firebase.google.com/project/blackvision-27f1c/hosting/sites/studiosbook`
2. Entrar em `Add custom domain`
3. Informar `studiosbook.com.br` e `www.studiosbook.com.br`
4. Seguir os registros TXT/A indicados pelo Firebase
5. Depois da propagação, concluir a verificação SSL

## DNS esperado

O Firebase pode variar os registros por projeto. Em geral, o fluxo informa:

| Tipo | Nome | Valor |
| --- | --- | --- |
| TXT | @ | valor de verificação do Firebase |
| A | @ | IPs informados pelo Firebase |
| CNAME | www | studiosbook.web.app |

Registro confirmado pelo Firebase para liberar o `www`:

```txt
Tipo: CNAME
Nome/Host: www
Valor/Destino: studiosbook.web.app
TTL: padrão do provedor
```

Os nameservers atuais do domínio são do Registro.br:

```txt
d.sec.dns.br
e.sec.dns.br
```

## Backend Railway

Projeto Vercel atual: `studiosbook-api`

URL pública atual:

```txt
https://studiosbook-api-equipe-blackvision.vercel.app
```

O frontend usa diretamente a URL pública de produção da Vercel. Um domínio customizado para a API pode ser adicionado depois que o DNS correspondente estiver validado.
No serviço, mantenha:

```txt
PUBLIC_APP_URL=https://studiosbook.com.br
FRONTEND_ORIGINS=https://studiosbook.com.br,https://www.studiosbook.com.br,https://studiosbook.web.app
```

## Cuidados

- Remover outros registros `A` conflitantes no domínio raiz.
- Remover registros `AAAA` dos hostnames usados se o Firebase/Railway não informar IPv6.
- Se usar Cloudflare, deixar os registros como `DNS only` durante a validação.
- A emissão SSL é automática depois que Firebase e Railway validarem os domínios.
- A propagação pode levar até 48-72 horas.
