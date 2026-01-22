FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install git for fetching dependencies
RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -ldflags="-w -s" -o out ./cmd/main.go

FROM alpine:latest

WORKDIR /root/

COPY --from=builder /app/out .

EXPOSE 8080

CMD ["./out"]
