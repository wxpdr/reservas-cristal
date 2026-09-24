# Producao e entrega

O codigo esta pronto para publicacao, mas o repositorio nao define um provedor de hospedagem. Use um
servico com HTTPS para o Next.js e outro para o processo Python, preferencialmente em subdominios do
mesmo dominio (por exemplo, `reservas.exemplo.com` e `api.exemplo.com`) para manter o cookie
`SameSite=Lax` coerente com a arquitetura.

## Backend

Configure no ambiente do processo, sem versionar valores reais:

- `APP_ENVIRONMENT=production`
- `DATABASE_URL=postgresql+psycopg://...` (PostgreSQL/Supabase; use o Session Pooler se a rede nao
  tiver IPv6)
- `FRONTEND_URL=https://reservas.exemplo.com` (origem exata, sem `*`)
- `SESSION_COOKIE_NAME=cristal_session`
- `SESSION_COOKIE_SECURE=true`
- `SESSION_TTL_HOURS=12`
- `PASSWORD_TOKEN_TTL_HOURS=24`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` e `SMTP_FROM`

Em producao, a aplicacao recusa iniciar sem HTTPS no frontend, cookie seguro e SMTP completo. Instale
com `python -m pip install .`, aplique `alembic upgrade head` e inicie com:

```sh
uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers
```

Use a porta fornecida pelo provedor quando aplicavel. O health check e `GET /health`.

## Frontend

Configure `NEXT_PUBLIC_API_URL=https://api.exemplo.com` no ambiente de build. Execute `npm ci`,
`npm run build` e `npm start`. Essa variavel e incorporada ao bundle durante o build.

## Primeiro uso

1. Configure os ambientes e DNS/HTTPS.
2. Aplique `alembic upgrade head` no backend.
3. Confirme `GET /health` e publique o frontend.
4. No terminal seguro do backend, execute
   `python -m app.scripts.create_admin --name "Nome" --email "admin@exemplo.com"`.
5. O administrador recebe o convite por SMTP, define a propria senha e entra no sistema.
6. Valide login, Agenda, criacao de reserva, Mes e area administrativa.

O script `seed_dev_reservations` e manual, nao participa da inicializacao nem das migrations e recusa
execucao quando `APP_ENVIRONMENT=production`.

## Checklist de entrega

- definir provedor, dominios e credenciais;
- executar migrations antes de liberar trafego;
- validar CORS entre as duas origens HTTPS;
- executar o fluxo de primeiro acesso e os smoke tests acima;
- obter a validacao do cliente e entao marcar a Sprint 6 como concluida.
