# packages/pipeline/Dockerfile
# syntax=docker/dockerfile:1.7

# ── Builder stage ────────────────────────────────────────────────
FROM python:3.11-slim-bookworm AS builder

ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_DOWNLOADS=never

COPY --from=ghcr.io/astral-sh/uv:0.5.10 /uv /bin/uv

WORKDIR /app

# Install Python deps first for layer caching
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy source, install project
COPY src/ ./src/
RUN uv sync --frozen --no-dev

# ── Runtime stage ────────────────────────────────────────────────
FROM python:3.11-slim-bookworm AS runtime

# WeasyPrint system deps (Phase 4 installs even though Phase 6 owns PDF)
# Source: research §8 (merged CONTEXT D-28 list + research's comprehensive list)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpango-1.0-0 libpangoft2-1.0-0 libpangocairo-1.0-0 libcairo2 \
        libgdk-pixbuf-2.0-0 libharfbuzz0b libharfbuzz-subset0 \
        libjpeg62-turbo libopenjp2-7 libffi-dev \
        shared-mime-info fontconfig fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN useradd --create-home --uid 10001 app
WORKDIR /app

# Copy installed venv from builder
COPY --from=builder --chown=app:app /app /app

USER app
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "eisenbalm_pipeline.api.main:app", \
     "--host", "0.0.0.0", "--port", "8000"]
