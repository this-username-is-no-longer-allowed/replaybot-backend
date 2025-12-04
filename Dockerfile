FROM node:20
RUN apt-get update && apt-get install -y \
    gconf-service \
    libasound2 \
    libatk1.0-0 \
    libcairo2 \
    libfontconfig1 \
    lingbk-pixbuf2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libpango-1.0-0 \
    libxss1 \
    fonts-liberation \
    libappindicator1 \
    libnss3 \
    lsb-release \
    xdg-utils \
    wget \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /usr/src/app
ENV PUPPETEER_CACHE_DIR=/usr/src/app/.cache
COPY package*.json ./
RUN npm install
COPY . .
RUN chown -R node:node /usr/src/app
USER node
CMD [ "node", "index.js" ]
