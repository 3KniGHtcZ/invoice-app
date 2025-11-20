# Invoice App

Invoice management application with Gmail integration and AI-powered invoice data extraction.

## Running the Application

**IMPORTANT**: Always run servers from their respective directories!

### Start Backend
```bash
cd backend
yarn dev
```

### Start Frontend
```bash
cd frontend
yarn dev
```

### Access
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

## Troubleshooting

### "Connection refused" error
Make sure you're in the correct directory:
- Backend must run from `/backend` directory
- Frontend must run from `/frontend` directory

### Backend not responding
```bash
# Kill all background processes and restart
cd backend
yarn dev
```
