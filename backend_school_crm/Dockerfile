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

WORKDIR /app

COPY --from=builder /app/rest-api .
COPY --from=builder /app/migrations ./migrations

# PORT is set by Railway at runtime
EXPOSE 8080

CMD ["./rest-api"]
