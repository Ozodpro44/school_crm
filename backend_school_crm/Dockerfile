FROM golang:1.25-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -ldflags="-w -s" -o rest-api ./cmd/main.go

FROM alpine:latest

WORKDIR /app

COPY --from=builder /app/rest-api .
COPY --from=builder /app/migrations ./migrations

# PORT is set by Railway at runtime
EXPOSE 8080

CMD ["./rest-api"]
