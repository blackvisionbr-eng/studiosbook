# StudiosBook - Recuperacao do Firestore

## Politica definida

- Banco: `blackvision-27f1c/(default)`.
- Nome visivel do projeto: `StudiosBook Production`.
- Regiao: `nam5`.
- Protecao contra exclusao: obrigatoria.
- PITR: sete dias, gerenciado pelo Firestore.
- Backup: diario, com retencao de 14 dias.
- Restauracao: sempre para um novo database; nunca sobrescrever producao durante o teste.

## Consultar o estado

```powershell
.\ops\firestore-protection.ps1
```

## Aplicar apos habilitar billing

```powershell
.\ops\firestore-protection.ps1 -Apply
```

O script e idempotente: mantem a protecao existente, habilita PITR apenas quando necessario e cria uma agenda diaria somente se nenhuma agenda existir.

## Teste de restauracao PITR concluido

Em 3 de julho de 2026, o snapshot PITR de `2026-07-04T02:08:00Z` foi clonado para `restore-drill-20260703`.

- Operacao: `SUCCESSFUL`.
- Colecoes comparadas: `8`.
- Contagens comparadas: `231` documentos no total, todas coincidentes.
- Acesso do clone: fechado por padrao.
- Limpeza: database temporario removido.
- Producao depois da limpeza: somente `(default)`, com delete protection ativa.

## Teste de backup gerenciado

Execute depois que o primeiro backup aparecer como disponivel:

1. Liste os backups e copie o nome completo do mais recente.

```powershell
firebase firestore:backups:list --location nam5 --project blackvision-27f1c
```

2. Restaure para um database temporario, sem alterar o `(default)`.

```powershell
firebase firestore:databases:restore `
  --backup "NOME_COMPLETO_DO_BACKUP" `
  --database "recovery-test-AAAAMMDD" `
  --project blackvision-27f1c
```

3. Confirme contagens, documentos de perfis, clientes, agenda, procedimentos e cobranca.
4. Confirme que o database restaurado inicia com acesso web bloqueado e nao recebe trafego do app.
5. Registre o resultado e remova o database temporario somente apos aprovacao operacional.

## Criterio de aprovacao

- Protecao contra exclusao: `ENABLED`.
- PITR: `ENABLED` e retencao de sete dias.
- Agenda de backup: `DAILY`, retencao de 14 dias.
- Restauracao PITR: aprovada em database separado e removida apos validacao.
- Primeiro backup gerenciado: confirmar quando a agenda concluir a primeira execucao.
