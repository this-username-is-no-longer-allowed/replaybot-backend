FROM ghcr.io/puppeteer/puppeteer:21.5.0
USER root
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --ignore-scripts
COPY . .
RUN chown -R pptruser:pptruser /usr/src/app
USER pptruser
CMD [ "node", "index.js" ]
