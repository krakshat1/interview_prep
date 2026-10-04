FROM node:20-bookworm-slim

# Python powers the graded Code practice mode.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PYTHON_BIN=python3 \
    DATA_DIR=/data \
    PORT=3000

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# Run unprivileged; /data is the persistent volume (accounts + progress).
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
