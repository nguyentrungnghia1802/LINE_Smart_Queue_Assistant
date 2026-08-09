FROM nginx:1.27-alpine

COPY docker/nginx/validation.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx/validation-proxy-headers.conf /etc/nginx/validation-proxy-headers.conf
