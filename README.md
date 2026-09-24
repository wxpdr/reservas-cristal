# Reservas Cristal

Sistema interno de gestão de reservas da Cristal Pizza. O monorepo contém:

- `frontend/`: Next.js, TypeScript e Tailwind CSS;
- `backend/`: FastAPI, SQLAlchemy e Alembic;
- `docs/`: requisitos, arquitetura, decisões e referências visuais.

O Supabase é usado somente como PostgreSQL gerenciado. A aplicação não usa Supabase Auth nem o SDK
do Supabase; o frontend acessa apenas a API REST do FastAPI.

## Requisitos

- Python 3.12+
- Node.js 20.9+
- PostgreSQL 15+

## Configuração

Na raiz do repositório, copie `.env.example` para `.env` e ajuste `DATABASE_URL`. Para Supabase, use
uma connection string PostgreSQL compatível com psycopg, mantendo o prefixo
`postgresql+psycopg://`.

```powershell
Copy-Item .env.example .env
```

Para entrega real de convites e recuperação em desenvolvimento, configure no `.env` usado pelo
backend uma conta Gmail exclusiva de teste e uma senha de app do Google:

```dotenv
FRONTEND_URL=http://localhost:3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=seu-email-de-teste@gmail.com
SMTP_PASSWORD=sua-senha-de-app
SMTP_FROM=seu-email-de-teste@gmail.com
```

O Gmail exige autenticação em duas etapas e uma senha de app; não use a senha normal da conta.
Se as variáveis SMTP forem omitidas, o backend usa o adaptador local que exibe o link no terminal.

Instale o backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
```

Instale o frontend:

```powershell
cd frontend
npm install
```

## Banco e primeiro administrador

Com o PostgreSQL configurado em `.env`, aplique as migrations:

```powershell
cd backend
alembic upgrade head
```

O primeiro administrador é criado por um comando local e também define a própria senha. Com SMTP
configurado, o link temporário é enviado ao endereço do usuário; sem SMTP, ele aparece no terminal.
O token bruto nunca é salvo no banco.

```powershell
python -m app.scripts.create_admin --name "Nome do administrador" --email "admin@exemplo.com"
```

## Execução

Backend, em `backend/`:

```powershell
uvicorn app.main:app --reload
```

Frontend, em `frontend/`:

```powershell
npm run dev
```

Abra `http://localhost:3000`. A documentação interativa da API fica em
`http://localhost:8000/docs`.

### Dados fictícios para validar a Agenda do Dia

Somente no ambiente DEV, execute manualmente o script abaixo para criar reservas fictícias na data
atual. O script reutiliza os serviços do domínio, gera auditoria e ignora os registros do próprio
seed que já existirem:

```powershell
cd backend
python -m app.scripts.seed_dev_reservations --confirm-dev
```

O comando usa o banco configurado no ambiente atual. Não o execute apontando para produção.

## Verificações

Backend, em `backend/`:

```powershell
pytest
ruff check .
mypy app tests
alembic upgrade head --sql
alembic check
```

`alembic check` exige acesso ao PostgreSQL configurado. O comando com `--sql` valida a cadeia e gera
o SQL sem se conectar ao banco.

Frontend, em `frontend/`:

```powershell
npm run lint
npm run typecheck
npm run build
```

## Endpoints implementados

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/first-access`
- `POST /api/auth/password-reset/request`
- `POST /api/auth/password-reset/complete`
- `POST /api/users` (somente administrador)
- `POST /api/reservations`
- `GET /api/reservations?date=YYYY-MM-DD`
- `GET /api/reservations/monthly?year=YYYY&month=M`
- `GET /api/reservations/{id}`
- `PATCH /api/reservations/{id}`
- `POST /api/reservations/{id}/confirm`
- `POST /api/reservations/{id}/check-in`
- `POST /api/reservations/{id}/undo-check-in`
- `POST /api/reservations/{id}/cancel`
- `GET /health`

Em produção, configure `SESSION_COOKIE_SECURE=true` e use credenciais de entrega apropriadas ao
ambiente. O provider SMTP e os adaptadores de desenvolvimento implementam o mesmo `EmailSender`.
