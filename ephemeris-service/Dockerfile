# Keep in sync with local dev venv (install:all pins py -3.13)
FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
# pyswisseph ships no prebuilt wheel for Python 3.13, so pip compiles its C
# extension (libswe) from source — which needs a compiler the -slim base image
# doesn't include (build fails: "command 'gcc' failed: No such file or
# directory"). Install build tooling, compile, then purge it in the same layer
# so the runtime image stays lean. The compiled .so links only against libc/libm
# (pyswisseph bundles libswe + sqlite3 internally), so the toolchain isn't
# needed at runtime.
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential \
 && pip install --no-cache-dir -r requirements.txt \
 && apt-get purge -y --auto-remove build-essential \
 && rm -rf /var/lib/apt/lists/*

COPY . .

ENV SE_EPHE_PATH=/app/ephe

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
