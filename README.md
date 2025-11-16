# Example App

Full-stack aplikace vytvořená s React, Vite, shadcn/ui a Node.js Express backendem.

## Technologie

### Frontend
- React 19
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui komponenty

### Backend
- Node.js
- Express
- TypeScript
- CORS

## Struktura projektu

```
example-app/
├── frontend/          # React + Vite frontend
│   ├── src/
│   │   ├── components/ui/  # shadcn komponenty
│   │   ├── lib/            # utility funkce
│   │   ├── App.tsx         # hlavní komponenta
│   │   └── main.tsx
│   └── package.json
└── backend/           # Node.js Express backend
    ├── src/
    │   └── index.ts   # API server
    └── package.json
```

## Instalace a spuštění

### Backend

```bash
cd backend
npm install
npm run dev
```

Backend běží na `http://localhost:3000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend běží na `http://localhost:5173`

## API Endpoints

- `GET /api/messages` - Získá všechny zprávy
- `POST /api/messages` - Vytvoří novou zprávu
  ```json
  {
    "text": "Vaše zpráva"
  }
  ```
- `GET /api/health` - Health check endpoint

## Funkce

- Zobrazení seznamu zpráv
- Přidání nové zprávy pomocí formuláře
- Responsivní design s Tailwind CSS
- shadcn/ui komponenty (Button, Card, Input)
- TypeScript pro type safety
- CORS povolený pro vývoj
- Vite proxy pro API požadavky

## Vývoj

Frontend automaticky proxuje `/api/*` požadavky na backend díky Vite proxy konfiguraci v `vite.config.ts`.
