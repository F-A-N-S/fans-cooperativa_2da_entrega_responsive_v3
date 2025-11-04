FROM php:8.2-apache
RUN docker-php-ext-install pdo pdo_mysql fileinfo
RUN a2enmod rewrite headers
RUN sed -i 's/AllowOverride None/AllowOverride All/i' /etc/apache2/apache2.conf
COPY uploads.ini /usr/local/etc/php/conf.d/uploads.ini