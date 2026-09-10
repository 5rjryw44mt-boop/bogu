FROM node:18-alpine
WORKDIR /app
COPY server.js index.html ./
ENV PORT=80
EXPOSE 80
CMD ["node","server.js"]
