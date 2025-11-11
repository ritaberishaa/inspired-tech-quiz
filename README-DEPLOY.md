# Deploy në Netlify

## Hapat për Deploy:

### 1. Backend (Server)
Backend duhet të deploy-ohet veçmas në një platform si:
- **Heroku** (rekomandohet)
- **Railway**
- **Render**
- **DigitalOcean**

Backend kërkon Node.js dhe Socket.io, kështu që nuk mund të deploy-ohet në Netlify (që është vetëm për static files).

### 2. Frontend (Netlify)

1. **Build frontend:**
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. **Në Netlify:**
   - Krijo një site të ri
   - Zgjidh "Deploy manually"
   - Upload folder-in `frontend/dist/quiz-app`
   - Ose lidh me GitHub dhe përdor këto settings:
     - Build command: `cd frontend && npm install && npm run build`
     - Publish directory: `frontend/dist/quiz-app`

3. **Ndrysho URL-në e serverit:**
   Në `frontend/src/app/services/socket.service.ts`, ndrysho:
   ```typescript
   private readonly serverUrl = 'http://localhost:3000';
   ```
   Në URL-në e backend-it të deploy-uar (p.sh. `https://your-backend.herokuapp.com`)

### 3. Environment Variables (Opsionale)

Mund të përdorësh environment variables për URL-në e serverit:
- Në Netlify: Site settings → Environment variables
- Shto: `VITE_SERVER_URL` ose `REACT_APP_SERVER_URL`

## Shënim:
Netlify është vetëm për frontend. Backend duhet të jetë në një platform tjetër që mbështet Node.js dhe WebSockets.

