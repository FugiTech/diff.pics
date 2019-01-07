FROM mhart/alpine-node:10 AS build

WORKDIR /app
COPY . .
RUN yarn build


FROM nginx:stable
COPY --from=build /app/dist/ /var/www
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
