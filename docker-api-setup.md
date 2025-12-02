# Настройка доступа к Docker API через TCP порт на Linux Debian

## Введение

Данная инструкция описывает процесс настройки удаленного доступа к Docker API через TCP порт, что позволяет управлять контейнерами Docker удаленно.

## Шаг 1: Создание файла конфигурации Docker daemon

Создайте или отредактируйте файл `/etc/docker/daemon.json`:

```bash
sudo mkdir -p /etc/docker
sudo nano /etc/docker/daemon.json
```

Добавьте следующую конфигурацию:

```json
{
  "hosts": ["unix:///var/run/docker.sock", "tcp://0.0.0.0:2375"]
}
```

**Важно:** Порт 2375 - это незащищенное соединение. Для production используйте порт 2376 с TLS.

## Шаг 2: Настройка systemd service

Отредактируйте systemd unit файл Docker:

```bash
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo nano /etc/systemd/system/docker.service.d/override.conf
```

Добавьте следующее содержимое:

```ini
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd
```

Это необходимо, потому что systemd может конфликтовать с настройками `hosts` в `daemon.json`.

## Шаг 3: Перезапуск Docker

Перезагрузите конфигурацию systemd и перезапустите Docker:

```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
```

## Шаг 4: Проверка доступности API

Проверьте, что Docker API доступен:

```bash
curl http://localhost:2375/version

curl http://10.174.18.242:2375/version
```

Вы должны увидеть JSON ответ с информацией о версии Docker.

## Шаг 5: Настройка файрвола (опционально)

### Если используете ufw:

```bash
sudo ufw allow 2375/tcp
```

### Если используете iptables:

```bash
sudo iptables -A INPUT -p tcp --dport 2375 -j ACCEPT
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

## ⚠️ Важные предупреждения о безопасности

**ВНИМАНИЕ!** Открытие Docker API без защиты дает полный root-доступ к системе!

Любой, кто имеет доступ к порту Docker API, может:
- Запускать привилегированные контейнеры
- Монтировать файловую систему хоста
- Получить полный контроль над системой

## Настройка защищенного соединения с TLS

Для безопасного использования в продакшене обязательно используйте TLS.

### Создание сертификатов

```bash
# Создайте директорию для сертификатов
sudo mkdir -p /etc/docker/certs
cd /etc/docker/certs

# Сгенерируйте CA ключ
openssl genrsa -aes256 -out ca-key.pem 4096

# Сгенерируйте CA сертификат
openssl req -new -x509 -days 365 -key ca-key.pem -sha256 -out ca.pem

# Сгенерируйте серверный ключ
openssl genrsa -out server-key.pem 4096

# Создайте CSR для сервера (замените YOUR_HOST на ваш hostname)
openssl req -subj "/CN=YOUR_HOST" -sha256 -new -key server-key.pem -out server.csr

# Создайте файл расширений (замените YOUR_HOST и YOUR_IP на ваши значения)
echo subjectAltName = DNS:YOUR_HOST,IP:YOUR_IP,IP:127.0.0.1 >> extfile.cnf
echo extendedKeyUsage = serverAuth >> extfile.cnf

# Подпишите серверный сертификат
openssl x509 -req -days 365 -sha256 -in server.csr -CA ca.pem -CAkey ca-key.pem \
  -CAcreateserial -out server-cert.pem -extfile extfile.cnf

# Создайте клиентский ключ
openssl genrsa -out key.pem 4096

# Создайте CSR для клиента
openssl req -subj '/CN=client' -new -key key.pem -out client.csr

# Создайте файл расширений для клиента
echo extendedKeyUsage = clientAuth > extfile-client.cnf

# Подпишите клиентский сертификат
openssl x509 -req -days 365 -sha256 -in client.csr -CA ca.pem -CAkey ca-key.pem \
  -CAcreateserial -out cert.pem -extfile extfile-client.cnf

# Установите правильные права доступа
sudo chmod -v 0400 ca-key.pem key.pem server-key.pem
sudo chmod -v 0444 ca.pem server-cert.pem cert.pem

# Удалите временные файлы
rm -v client.csr server.csr extfile.cnf extfile-client.cnf
```

### Конфигурация daemon.json с TLS

Отредактируйте `/etc/docker/daemon.json`:

```json
{
  "hosts": ["unix:///var/run/docker.sock", "tcp://0.0.0.0:2376"],
  "tls": true,
  "tlscacert": "/etc/docker/certs/ca.pem",
  "tlscert": "/etc/docker/certs/server-cert.pem",
  "tlskey": "/etc/docker/certs/server-key.pem",
  "tlsverify": true
}
```

После изменения конфигурации перезапустите Docker:

```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
```

### Настройка файрвола для TLS

```bash
# Откройте порт 2376 для TLS соединений
sudo ufw allow 2376/tcp

# Закройте незащищенный порт 2375, если он открыт
sudo ufw delete allow 2375/tcp
```

## Использование Docker API удаленно

### Без TLS (только для разработки/тестирования):

```bash
# Через переменную окружения
export DOCKER_HOST=tcp://your-server-ip:2375

# Или напрямую в командах
docker -H tcp://your-server-ip:2375 ps
docker -H tcp://your-server-ip:2375 images
docker -H tcp://your-server-ip:2375 run -d nginx
```

### С TLS (рекомендуется):

Скопируйте клиентские сертификаты на клиентскую машину:

```bash
# На сервере
scp /etc/docker/certs/{ca,cert,key}.pem user@client-machine:~/.docker/
```

На клиентской машине:

```bash
# Через переменные окружения
export DOCKER_HOST=tcp://your-server-ip:2376
export DOCKER_TLS_VERIFY=1
export DOCKER_CERT_PATH=~/.docker

# Проверка подключения
docker version
docker ps
```

Или напрямую в командах:

```bash
docker --tlsverify \
  --tlscacert=~/.docker/ca.pem \
  --tlscert=~/.docker/cert.pem \
  --tlskey=~/.docker/key.pem \
  -H=tcp://your-server-ip:2376 \
  ps
```

## Использование через API напрямую

### Примеры с curl:

```bash
# Получить версию Docker
curl http://your-server-ip:2375/version

# Список контейнеров
curl http://your-server-ip:2375/containers/json

# Список образов
curl http://your-server-ip:2375/images/json

# Информация о системе
curl http://your-server-ip:2375/info
```

### С TLS:

```bash
curl --cert ~/.docker/cert.pem \
     --key ~/.docker/key.pem \
     --cacert ~/.docker/ca.pem \
     https://your-server-ip:2376/version
```

## Ограничение доступа по IP адресам

Для дополнительной безопасности ограничьте доступ только с определенных IP:

### С использованием iptables:

```bash
# Разрешить доступ только с определенного IP
sudo iptables -A INPUT -p tcp -s 192.168.1.100 --dport 2376 -j ACCEPT

# Заблокировать доступ со всех остальных IP
sudo iptables -A INPUT -p tcp --dport 2376 -j DROP

# Сохранить правила
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

### С использованием ufw:

```bash
# Разрешить доступ только с определенного IP
sudo ufw allow from 192.168.1.100 to any port 2376

# Или с подсети
sudo ufw allow from 192.168.1.0/24 to any port 2376
```

## Использование с Docker Compose

Вы также можете использовать удаленный Docker с Docker Compose:

```bash
export DOCKER_HOST=tcp://your-server-ip:2376
export DOCKER_TLS_VERIFY=1
export DOCKER_CERT_PATH=~/.docker

docker-compose up -d
docker-compose ps
docker-compose logs
```

## Рекомендации по безопасности

1. **Никогда не открывайте порт 2375 в интернет без TLS** - это равносильно предоставлению root доступа к вашей системе
2. **Всегда используйте TLS в продакшене** - порт 2376 с сертификатами
3. **Используйте файрвол** для ограничения доступа к определенным IP адресам или подсетям
4. **Рассмотрите использование VPN** для доступа к Docker API через зашифрованный туннель
5. **Регулярно обновляйте Docker** до последней версии для получения патчей безопасности
6. **Используйте сильные пароли** для защиты приватных ключей сертификатов
7. **Мониторьте логи Docker** на предмет подозрительной активности
8. **Ограничьте срок действия сертификатов** и регулярно их обновляйте
9. **Используйте Docker Socket Proxy** для дополнительного уровня защиты
10. **Рассмотрите альтернативы** - SSH туннель или Docker Context

## Альтернативный метод: SSH туннель

Более безопасный способ - использовать SSH туннель:

```bash
# На клиентской машине создайте SSH туннель
ssh -NL localhost:2375:/var/run/docker.sock user@your-server-ip

# В другом терминале
export DOCKER_HOST=tcp://localhost:2375
docker ps
```

## Использование Docker Context (рекомендуется)

Docker Context - это современный способ управления удаленными Docker хостами:

```bash
# Создать контекст для удаленного хоста с TLS
docker context create remote-server \
  --docker "host=tcp://your-server-ip:2376,ca=/path/to/ca.pem,cert=/path/to/cert.pem,key=/path/to/key.pem"

# Переключиться на удаленный контекст
docker context use remote-server

# Теперь все команды docker будут выполняться на удаленном сервере
docker ps
docker images

# Вернуться к локальному контексту
docker context use default

# Посмотреть список контекстов
docker context ls
```

## Отладка и решение проблем

### Docker не запускается после изменения конфигурации

Проверьте логи Docker:

```bash
sudo journalctl -u docker.service -n 50 --no-pager
```

### Проверка, слушает ли Docker на порту

```bash
sudo netstat -tlnp | grep dockerd
# или
sudo ss -tlnp | grep dockerd
```

Должно показать что-то вроде:

```
tcp        0      0 0.0.0.0:2375            0.0.0.0:*               LISTEN      1234/dockerd
```

### Тестирование подключения

```bash
# Проверка доступности порта
telnet your-server-ip 2375

# Проверка API
curl -v http://your-server-ip:2375/version
```

### Ошибка: "Cannot connect to the Docker daemon"

1. Убедитесь, что Docker запущен: `sudo systemctl status docker`
2. Проверьте, что порт открыт: `sudo netstat -tlnp | grep 2375`
3. Проверьте файрвол: `sudo ufw status`
4. Проверьте логи: `sudo journalctl -u docker.service -f`

## Откат изменений

Если нужно вернуться к стандартной конфигурации:

```bash
# Удалите файл конфигурации
sudo rm /etc/docker/daemon.json

# Удалите override файл
sudo rm -rf /etc/systemd/system/docker.service.d/

# Перезапустите Docker
sudo systemctl daemon-reload
sudo systemctl restart docker
```

## Заключение

Настройка удаленного доступа к Docker API - мощный инструмент для управления контейнерами, но требует особого внимания к безопасности. Всегда используйте TLS в продакшене и ограничивайте доступ только доверенным хостам.

---

**Дата создания:** 2 ноября 2025 г.  
**Версия Docker:** Совместимо с Docker 20.10+ и Docker Engine 24.0+
