FROM node:22-slim

# Minimal runtime deps for HTTPS uploads and bash-compatible command execution.
# Also installs AWS CLI v2 so shell jobs can run `aws ...` commands.
#
# NOTE: We install the AWS CLI that matches the container CPU architecture:
# - linux/amd64  -> awscli-exe-linux-x86_64-<version>.zip
# - linux/arm64  -> awscli-exe-linux-aarch64-<version>.zip
#
# Updated 2025-12-29: Added Playwright dependencies (libglib, libnss, etc)
ARG AWS_CLI_VERSION=2.27.54
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates bash curl unzip \
    # Playwright / Chromium dependencies
    libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    libpango-1.0-0 libpangocairo-1.0-0 libgtk-3-0 \
  # Install AWS CLI v2 (pinned for reproducibility)
  && ARCH="$(uname -m)" \
  && case "${ARCH}" in \
      x86_64) AWS_ARCH="x86_64" ;; \
      aarch64|arm64) AWS_ARCH="aarch64" ;; \
      *) echo "Unsupported architecture for AWS CLI v2 install: ${ARCH}" >&2; exit 1 ;; \
    esac \
  && curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${AWS_ARCH}-${AWS_CLI_VERSION}.zip" -o "/tmp/awscliv2.zip" \
  && unzip -q /tmp/awscliv2.zip -d /tmp \
  && /tmp/aws/install --bin-dir /usr/local/bin --install-dir /usr/local/aws-cli --update \
  && rm -rf /tmp/aws /tmp/awscliv2.zip \
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


