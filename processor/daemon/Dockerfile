#FROM node
#COPY . /app
#WORKDIR /app
#RUN npm install
#CMD node app.js

FROM alpine
RUN apk add && \
    apk add nodejs npm

COPY . /app
WORKDIR /app
CMD node app.js

