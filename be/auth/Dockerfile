FROM rust:1-alpine3.23 AS builder

WORKDIR /app

ENV OPENSSL_STATIC=1

COPY Cargo.toml Cargo.lock ./
RUN apk add --no-cache musl-dev pkgconfig openssl openssl-dev openssl-libs-static

COPY src ./src
RUN touch src/main.rs && \
    touch src/lib.rs && \
    cargo build --release

FROM alpine:3.23

RUN apk add --no-cache ca-certificates && \
    apk update && apk add bash && \
    addgroup -S authappgroup && \
    adduser -S authappuser -G authappgroup

ENV PORT=3000

COPY --from=builder /app/target/release/auth-service /usr/local/bin/

USER authappuser

EXPOSE 3000

CMD ["auth-service"]