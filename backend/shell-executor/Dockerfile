FROM node:22-slim

# Minimal runtime deps for HTTPS uploads and bash-compatible command execution.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates bash curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY runner.js /app/runner.js

# Run as a non-root user
RUN useradd -u 10001 -m runner \
  && mkdir -p /workspace \
  && chown -R runner:runner /app /workspace

USER runner
ENV NODE_ENV=production

ENTRYPOINT ["node", "/app/runner.js"]


