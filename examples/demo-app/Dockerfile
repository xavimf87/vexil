FROM golang:1.25-alpine AS builder
WORKDIR /app
RUN go mod init demo-app
COPY main.go .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /demo-app .

FROM gcr.io/distroless/static:nonroot
COPY --from=builder /demo-app /demo-app
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/demo-app"]
