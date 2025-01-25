start:
	docker compose up -d --build

restart:
	docker compose restart

stop:
	docker compose stop

kill:
	docker compose kill

remove:
	docker compose down -v
