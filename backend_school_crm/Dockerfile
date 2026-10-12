FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS builder

ARG TARGETOS
ARG TARGETARCH

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64} go build -ldflags="-w -s" -o rest-api ./cmd/main.go

FROM alpine:3.19

RUN addgroup -S app && adduser -S -G app -u 10001 app
WORKDIR /app

COPY --from=builder --chown=app:app /app/rest-api .
COPY --from=builder --chown=app:app /app/migrations ./migrations

# PORT is set by Railway at runtime
EXPOSE 8080

USER app

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/health" >/dev/null || exit 1

CMD ["./rest-api"]
