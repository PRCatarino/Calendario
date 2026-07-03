# Calendario

Calendario de reunioes. **Next** (front) + **Express/Oracle XE** (back). Views mes/semana,
reunioes com nome do cliente + imagem + horario, e push pro **Google Calendar**.

```
calendario/
├── docker-compose.yml      # Oracle XE 21 (gvenzl/oracle-xe)
├── backend/                # Express + node-oracledb
│   └── src/
│       ├── server.js
│       ├── db.js           # pool oracledb
│       ├── google.js       # OAuth + push de eventos
│       ├── routes/         # meetings.js, google.js
│       └── sql/initdb.sql  # schema (roda no 1o boot do container)
└── frontend/               # Next 14 (app router)
    ├── app/                # layout, page, globals.css
    ├── components/         # MonthView, WeekView, MeetingForm
    └── lib/                # date.js, api.js
```

## 1. Subir Oracle XE

```bash
docker compose up -d
# primeiro boot demora ~1-2min (cria DB + roda initdb.sql). Acompanhe:
docker compose logs -f oracle   # espera "DATABASE IS READY TO USE!"
```

Banco: `localhost:1521/XEPDB1` · user `cal` / senha `cal` (schema ja criado pelo initdb.sql).

## 2. Backend

```bash
cd backend
cp .env.example .env      # ajuste se preciso
npm install
npm run dev               # http://localhost:4000
```

> `node-oracledb` 6+ usa modo **thin** por padrao — nao precisa Oracle Instant Client.

Teste: `curl http://localhost:4000/api/health`

## 3. Frontend

```bash
cd frontend
npm install
npm run dev               # http://localhost:3000
```

O Next faz rewrite de `/api/*` pro backend (`next.config.js`), entao sem CORS no browser.

## 4. Google Calendar (push)

1. [console.cloud.google.com](https://console.cloud.google.com) → cria projeto → ativa **Google Calendar API**.
2. OAuth consent screen (External, modo Testing, adiciona seu email em test users).
3. Credentials → OAuth Client ID → **Web application**.
   Redirect URI: `http://localhost:4000/api/google/callback`
4. Poe `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` no `backend/.env`, reinicia o backend.
5. No app, clica **Conectar Google** (canto sup. direito) → autoriza.

Depois disso, toda reuniao criada vira evento no Google Calendar (`google_event_id` salvo na tabela).
Apagar a reuniao apaga o evento. Sync e **one-way** (app → Google).

## Modelo de dados (`meetings`)

| coluna | tipo | nota |
|---|---|---|
| id | NUMBER identity | PK |
| client_name | VARCHAR2 | obrigatorio |
| title | VARCHAR2 | assunto |
| starts_at / ends_at | TIMESTAMP | horario |
| notes | CLOB | |
| image_blob / image_mime | BLOB | imagem do cliente |
| google_event_id | VARCHAR2 | id do evento no Google |

## Notas

- Imagem servida em `GET /api/meetings/:id/image` (limite upload 8MB).
- Listagem por range: `GET /api/meetings?from=ISO&to=ISO` (eventos que sobrepoem a janela).
- Semana comeca segunda; grid de 24h com slots por hora (clica no slot → form pre-preenchido).
