#!/bin/bash

echo "🔄 Пересборка и перезапуск Docker Manager..."
echo ""

# Остановка и удаление старого контейнера
echo "⏹️  Остановка старого контейнера..."
docker stop docker-manager 2>/dev/null
docker rm docker-manager 2>/dev/null

# Удаление старого образа для чистой пересборки
echo "🗑️  Удаление старого образа..."
docker rmi docker-manager 2>/dev/null
docker rmi dockermanager-docker-manager 2>/dev/null

# Пересборка образа
echo ""
echo "🏗️  Сборка нового образа (без кэша)..."
docker compose build --no-cache

if [ $? -eq 0 ]; then
    # Запуск контейнера
    echo ""
    echo "🚀 Запуск контейнера..."
    docker compose up -d
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Контейнер успешно запущен!"
        echo ""
        echo "📊 Проверка статуса:"
        docker ps | grep docker-manager
        echo ""
        echo "⏳ Ожидание запуска сервера..."
        sleep 3
        echo ""
        echo "📝 Последние логи:"
        docker logs --tail 30 docker-manager
        echo ""
        echo "════════════════════════════════════════════════════════"
        echo "🌐 Приложение доступно по адресу:"
        echo "   👉 http://10.174.18.242:3011/"
        echo "════════════════════════════════════════════════════════"
        echo ""
        echo "💡 Полезные команды:"
        echo "   📋 Логи в реальном времени: docker logs -f docker-manager"
        echo "   🔍 Статус контейнера: docker ps | grep docker-manager"
        echo "   ⏹️  Остановить: docker stop docker-manager"
    else
        echo ""
        echo "❌ Ошибка при запуске контейнера"
        echo "📋 Проверьте логи: docker logs docker-manager"
        exit 1
    fi
else
    echo ""
    echo "❌ Ошибка при сборке образа"
    exit 1
fi
