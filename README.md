# Reservas Cristal

Sistema interno de gestão de reservas da Cristal Pizza. O monorepo contém:

- `frontend/`: Next.js, TypeScript e Tailwind CSS;
- `backend/`: FastAPI, SQLAlchemy e Alembic;
- `docs/`: requisitos, arquitetura, decisões e referências visuais.

O Supabase é usado somente como PostgreSQL gerenciado. A aplicação não usa Supabase Auth nem o SDK
do Supabase; o frontend acessa apenas a API REST do FastAPI.

## Requisitos

- Python 3.12+
- Node.js 20+
- PostgreSQL 15+

## Configuração

Na raiz do repositório, copie `.env.example` para `.env` e ajuste `DATABASE_URL`. Para Supabase, use
uma connection string PostgreSQL compatível com psycopg, mantendo o prefixo
`postgresql+psycopg://`.

```powershell
Copy-Item .env.example .env
```

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

O primeiro administrador é criado por um comando local e também define a própria senha. O adaptador
de e-mail de desenvolvimento imprime o link temporário no terminal; o token bruto nunca é salvo no
banco.

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
- `GET /health`

Em produção, configure `SESSION_COOKIE_SECURE=true` e substitua o adaptador de e-mail de
desenvolvimento por uma implementação do contrato `EmailSender`.
