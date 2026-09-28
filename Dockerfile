# Agents Office — a container image (V4.4, B3). The office is built to run on the owner's own computer; this file only
# makes a later move to Railway, Fly or any Docker host possible without rewriting anything. Nothing here runs by itself.
# READ docs/despliegue.md FIRST: the office has no login yet (issue #2) — never expose it publicly as it is.
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production AO_HOST=0.0.0.0 PORT=4520 AO_DATA=/data
# The Claude Code CLI gives the agents their tools; it signs in with ANTHROPIC_API_KEY (set it as a secret on the host, never here)
RUN npm install -g @anthropic-ai/claude-code && apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN node build.mjs
VOLUME ["/data"]
EXPOSE 4520
HEALTHCHECK --interval=60s --timeout=10s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4520)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "serve.mjs"]
