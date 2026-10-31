FROM node:22-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --chown=node:node package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund
COPY --chown=node:node apps ./apps
COPY --chown=node:node db ./db
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node docs/images/dashboard-preview.svg ./docs/images/dashboard-preview.svg
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","apps/api/server.js"]
