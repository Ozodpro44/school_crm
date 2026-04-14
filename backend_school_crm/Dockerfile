FROM --platform=linux/amd64 golang:1.23-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o rest-api ./cmd/main.go

FROM --platform=linux/amd64 alpine:3.19

WORKDIR /app

COPY --from=builder /app/rest-api .
COPY --from=builder /app/migrations ./migrations

# PORT is set by Railway at runtime
EXPOSE 8080

CMD ["./rest-api"]
