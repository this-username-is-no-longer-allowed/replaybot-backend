FROM ghcr.io/puppeteer/puppeteer:21.5.0
USER root
WORKDIR /usr/src/app
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
COPY package*.json ./
RUN npm install
COPY . .
RUN chown -R pptruser:pptruser /usr/src/app
USER pptruser
CMD [ "node", "index.js" ]
