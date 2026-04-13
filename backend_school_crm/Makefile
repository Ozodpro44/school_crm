.PHONY: help swagger run run-grpc build build-grpc proto test fmt lint migrate-up migrate-down migrate-create docker-up docker-down db-create db-drop db-reset

# Default environment variables
POSTGRES_USER ?= school_user
POSTGRES_PASSWORD ?= school_password
POSTGRES_DATABASE ?= school_crm
POSTGRES_PORT ?= 5432
POSTGRES_HOST ?= localhost

# Load environment variables from .env file if it exists
-include .env

CURRENT_DIR=$(shell pwd)
APP=$(shell basename ${CURRENT_DIR})
APP_CMD_DIR=${CURRENT_DIR}/cmd

# Build variables
TAG=latest
ENV_TAG=latest

# Database connection string
POSTGRESQL_URL='postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}?sslmode=disable'
POSTGRESQL_MASTER_URL='postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/postgres?sslmode=disable'

help:
	@echo "Available commands:"
	@echo "  make run                 - Run REST API server locally"
	@echo "  make run-grpc            - Run gRPC server locally (default port 9090)"
	@echo "  make build               - Build REST server executable"
	@echo "  make build-grpc          - Build gRPC server executable"
	@echo "  make proto               - Regenerate protobuf Go code from .proto files"
	@echo "  make test                - Run all tests"
	@echo "  make fmt                 - Format code"
	@echo "  make lint                - Lint code"
	@echo "  make swagger             - Generate Swagger documentation"
	@echo "  make db-create           - Create database"
	@echo "  make migrate-up          - Run migrations up"
	@echo "  make migrate-down        - Run migrations down"
	@echo "  make migrate-create      - Create new migration"
	@echo "  make docker-up           - Start Docker containers"
	@echo "  make docker-down         - Stop Docker containers"
	@echo "  make install-migrate     - Install migrate tool"

# Swagger
swagger:
	swag init -g cmd/main.go --output ./docs || echo "Swagger not installed. Install with: go install github.com/swaggo/swag/cmd/swag@latest"

# Protobuf code generation
# Requires: protoc, protoc-gen-go, protoc-gen-go-grpc
# Install: go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
#          go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
PROTO_SRC=proto/schoolcrm/v1/school_crm.proto
PROTO_OUT=internal/grpc/pb
PROTOBUF_SRC=$(shell go env GOPATH)/pkg/mod/google.golang.org/protobuf@$(shell go list -m -f '{{.Version}}' google.golang.org/protobuf)/src

proto:
	@mkdir -p $(PROTO_OUT)
	protoc \
		--go_out=$(PROTO_OUT) \
		--go_opt=paths=source_relative \
		--go-grpc_out=$(PROTO_OUT) \
		--go-grpc_opt=paths=source_relative \
		-I proto \
		-I $(PROTOBUF_SRC) \
		$(PROTO_SRC)
	@echo "✓ Protobuf code generated in $(PROTO_OUT)"

# Development
run:
	go run cmd/main.go

run-grpc:
	go run cmd/grpc/main.go

build:
	go build -o bin/school-crm cmd/main.go

build-grpc:
	go build -o bin/school-crm-grpc cmd/grpc/main.go

test:
	go test -v ./...

fmt:
	go fmt ./...

lint:
	golangci-lint run ./... || echo "golangci-lint not installed. Install with: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest"

# Migrations
install-migrate:
	@echo "Installing migrate..."
	curl -L https://github.com/golang-migrate/migrate/releases/download/v4.15.2/migrate.linux-amd64 -o /usr/local/bin/migrate && chmod +x /usr/local/bin/migrate || echo "Failed to install. Download from: https://github.com/golang-migrate/migrate/releases"

print-db-url:
	@echo "Database URL: ${POSTGRESQL_URL}"

# Database operations
db-create:
	@echo "Creating database: ${POSTGRES_DATABASE}..."
	@sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '${POSTGRES_DATABASE}'" | grep -q 1 && \
		echo "✓ Database already exists" || \
		(sudo -u postgres psql -c "CREATE USER ${POSTGRES_USER} WITH PASSWORD '${POSTGRES_PASSWORD}';" 2>/dev/null || true && \
		sudo -u postgres psql -c "CREATE DATABASE ${POSTGRES_DATABASE} OWNER ${POSTGRES_USER};" && \
		sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DATABASE} TO ${POSTGRES_USER};" && \
		echo "✓ Database created successfully")

db-drop:
	@echo "Dropping database: ${POSTGRES_DATABASE}..."
	@sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${POSTGRES_DATABASE};" 2>/dev/null || echo "✓ Database already dropped"
	@sudo -u postgres psql -c "DROP USER IF EXISTS ${POSTGRES_USER};" 2>/dev/null || echo ""
	@echo "✓ Database dropped"

db-reset: db-drop db-create
	@echo "Setting up permissions..."
	@echo "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${POSTGRES_USER}; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${POSTGRES_USER}; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${POSTGRES_USER}; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${POSTGRES_USER};" | sudo -u postgres psql -d ${POSTGRES_DATABASE} 2>/dev/null || true
	@echo "✓ Database reset complete"

migrate-create:
	@read -p "Enter migration name: " MIGRATION_NAME; \
	migrate create -ext sql -dir migrations -seq $$MIGRATION_NAME

migrate-up:
	migrate -path migrations -database ${POSTGRESQL_URL} up

migrate-down:
	migrate -path migrations -database ${POSTGRESQL_URL} down

migrate-force:
	@read -p "Enter version: " VERSION; \
	migrate -path migrations -database ${POSTGRESQL_URL} force $$VERSION

migrate-status:
	migrate -path migrations -database ${POSTGRESQL_URL} version

# Docker
docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f postgres

# Combined commands
setup: docker-up install-migrate db-create migrate-up
	@echo "✓ Setup complete! Run 'make run' to start the application"

init: docker-up db-create migrate-up
	@echo "✓ Database initialized! Run 'make run' to start"

clean:
	rm -rf bin/
	go clean

help-docker:
	@echo "Docker commands:"
	@echo "  make docker-up          - Start PostgreSQL container"
	@echo "  make docker-down        - Stop PostgreSQL container"
	@echo "  make docker-logs        - View PostgreSQL logs"

help-migrate:
	@echo "Migration commands:"
	@echo "  make install-migrate    - Install migrate tool"
	@echo "  make migrate-up         - Apply migrations"
	@echo "  make migrate-down       - Rollback migrations"
	@echo "  make migrate-create     - Create new migration"
	@echo "  make migrate-force      - Force migration version"
	@echo "  make migrate-status     - Show migration status"

# Development workflow
dev-setup: docker-up migrate-up
	@echo "Development environment ready"

dev-run: docker-up run

dev-reset: docker-down docker-up migrate-down migrate-up
	@echo "Development environment reset"

# Continuous development
watch:
	@command -v entr >/dev/null 2>&1 || { echo "entr not installed. Install with: apt-get install entr"; exit 1; }
	find . -name "*.go" | entr -r make run

# Default target
default: help
