FROM node:24-alpine

WORKDIR /app

# Logs go to stdout as JSON for Docker to collect; tokens go in the /data volume
ENV NODE_ENV=production \
	LOG_CONFIG=/app/logging.docker.json \
	LOG_DIR=/data/logs \
	TOKEN_DIR=/data \
	LISTEN_HOST=0.0.0.0

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY api ./api
COPY global ./global
COPY server ./server
COPY logging.docker.json ./

RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data

EXPOSE 8888

# Requests from inside the container come from loopback, so need no API key
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
	CMD wget -qO /dev/null http://127.0.0.1:8888/metrics || exit 1

CMD ["node", "server/main.js"]