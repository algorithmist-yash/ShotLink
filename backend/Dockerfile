# syntax=docker/dockerfile:1.7
FROM node:24.18.0-bookworm-slim AS dependencies
WORKDIR /opt/shotlink
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:24.18.0-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=5000
WORKDIR /opt/shotlink
RUN groupadd --gid 10001 shotlink && useradd --uid 10001 --gid shotlink --no-create-home --shell /usr/sbin/nologin shotlink
COPY --from=dependencies --chown=shotlink:shotlink /opt/shotlink/node_modules ./node_modules
COPY --chown=shotlink:shotlink package.json ./package.json
COPY --chown=shotlink:shotlink config ./config
COPY --chown=shotlink:shotlink src ./src
USER 10001:10001
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:5000/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "src/server.js"]
