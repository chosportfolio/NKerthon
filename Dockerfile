FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY chatbot/requirements.txt ./chatbot/requirements.txt
RUN python3 -m venv /app/.venv \
    && /app/.venv/bin/pip install --no-cache-dir --upgrade pip \
    && /app/.venv/bin/pip install --no-cache-dir -r chatbot/requirements.txt

COPY package.json package-lock.json ./
COPY server ./server
COPY scripts/start-production.mjs ./scripts/start-production.mjs
COPY chatbot ./chatbot

ENV NODE_ENV=production \
    CHATBOT_PYTHON=/app/.venv/bin/python \
    DATABASE_PATH=/data/campus.db

EXPOSE 5174
CMD ["node", "scripts/start-production.mjs"]
