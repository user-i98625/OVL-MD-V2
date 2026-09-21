FROM node:20-bookworm-slim

# Le dépôt est déjà copié dans l'image : git n'est pas nécessaire.
# Les retries réduisent les échecs temporaires des miroirs Debian sur Render.
RUN rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && apt-get update -o Acquire::Retries=5 \
    && apt-get install -y --no-install-recommends --fix-missing ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /ovl_bot

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 8000

CMD ["npm", "start"]
