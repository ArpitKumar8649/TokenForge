#!/usr/bin/env bash
set -euo pipefail

: "${RENDER_NIM_PROXY_API_KEY:?RENDER_NIM_PROXY_API_KEY must be configured}"
: "${RENDER_NIM_PROXY_MODEL:?RENDER_NIM_PROXY_MODEL must be configured}"

endpoints=(
  "https://nim-playground-proxy.onrender.com"
  "https://nim-playground-proxy-2.onrender.com"
  "https://nim-playground-proxy-3.onrender.com"
  "https://nim-playground-proxy-4.onrender.com"
  "https://nim-playground-proxy-5.onrender.com"
  "https://nim-playground-proxy-6.onrender.com"
)

for pass in 1 2; do
  echo "Warm-up pass ${pass}/2"
  for endpoint in "${endpoints[@]}"; do
    response_file="$(mktemp)"
    status_file="$(mktemp)"
    model_json="${RENDER_NIM_PROXY_MODEL//\\/\\\\}"
    model_json="${model_json//\"/\\\"}"
    payload=$(printf '{"model":"%s","stream":false,"max_tokens":16,"messages":[{"role":"user","content":"Reply exactly: Render endpoint warm."}]}' "$model_json")

    if curl --silent --show-error --connect-timeout 10 --max-time 120 \
      --request POST "${endpoint}/v1/chat/completions" \
      --header "Authorization: Bearer ${RENDER_NIM_PROXY_API_KEY}" \
      --header "Content-Type: application/json" \
      --header "Accept: application/json" \
      --data "$payload" \
      --output "$response_file" \
      --write-out "%{http_code} %{time_total}" >"$status_file"; then
      status="$(cat "$status_file")"
      preview="$(tr '\n' ' ' <"$response_file" | cut -c1-180)"
      echo "${endpoint} | HTTP/time: ${status} | response: ${preview}"
    else
      status="$(cat "$status_file" 2>/dev/null || true)"
      echo "${endpoint} | curl transport failure | HTTP/time: ${status:-unavailable}"
    fi

    rm -f "$response_file" "$status_file"
  done
done
