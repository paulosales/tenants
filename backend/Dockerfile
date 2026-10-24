# ==========================================
# Stage 1: Cargo Chef Planner
# ==========================================
FROM lukemathwalker/cargo-chef:latest-rust-1.80-bookworm AS chef
WORKDIR /app

FROM chef AS planner
COPY Cargo.toml Cargo.lock ./
COPY backend/Cargo.toml backend/Cargo.toml
COPY backend/src backend/src
RUN cargo chef prepare --recipe-path recipe.json

# ==========================================
# Stage 2: Cargo Chef Builder (Cached Deps)
# ==========================================
FROM chef AS builder
WORKDIR /app
COPY --from=planner /app/recipe.json recipe.json

# Build and cache dependencies only
RUN cargo chef cook --release --recipe-path recipe.json

# Build application binary
COPY Cargo.toml Cargo.lock ./
COPY backend backend
RUN cargo build --release --bin backend

# ==========================================
# Stage 3: Distroless Minimal Non-Root Runtime
# ==========================================
FROM gcr.io/distroless/cc-debian12:nonroot

WORKDIR /app

# Copy compiled binary from builder
COPY --from=builder /app/target/release/backend /app/backend

# Copy migration files for startup execution
COPY --from=builder /app/backend/migrations /app/migrations

# Run as nonroot user (UID 65532 in distroless)
USER nonroot:nonroot

EXPOSE 8080

ENV RUST_LOG=info
ENV APP_ENV=production

ENTRYPOINT ["/app/backend"]
