FROM node:22-alpine
WORKDIR /app
COPY server.mjs ./server.mjs
RUN mkdir -p /data && addgroup -S relay && adduser -S relay -G relay && chown -R relay:relay /app /data
USER relay
EXPOSE 8080
CMD ["node", "server.mjs"]
