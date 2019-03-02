FROM mhart/alpine-node:10 AS build

WORKDIR /app
COPY . .
RUN rm -rf node_modules package-lock.json && npm install
RUN yarn build


FROM nginx:stable
COPY --from=build /app/dist/ /var/www
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
