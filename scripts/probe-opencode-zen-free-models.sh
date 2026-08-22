#!/usr/bin/env bash
set -u -o pipefail

: "${OPENCODE_ZEN_API_KEY:?OPENCODE_ZEN_API_KEY must be configured}"

models=(
  "deepseek-v4-flash-free"
  "x-preview-f-free"
  "muse-spark-1.2-contributor-free"
  "mimo-v2.5-free"
  "hy3-free"
  "nemotron-3-ultra-free"
  "nemotron-3.5-lightning-free"
  "laguna-s-2.1-free"
)

printf 'model\thttp_status\tlatency_seconds\tresult\tsafe_response_preview\n'

for model in "${models[@]}"; do
  response_file="$(mktemp)"
  status_file="$(mktemp)"
  curl_exit=0

  curl --silent --show-error --max-time 90 \
    --request POST "https://opencode.ai/zen/v1/chat/completions" \
    --header "Authorization: Bearer ${OPENCODE_ZEN_API_KEY}" \
    --header "Content-Type: application/json" \
    --header "Accept: application/json" \
    --data "{\"model\":\"${model}\",\"stream\":false,\"max_tokens\":16,\"messages\":[{\"role\":\"user\",\"content\":\"Reply exactly: probe ok\"}]}" \
    --output "$response_file" \
    --write-out '%{http_code}\t%{time_total}' >"$status_file" || curl_exit=$?

  IFS=$'\t' read -r http_status latency_seconds <"$status_file"
  preview="$(tr '\n' ' ' <"$response_file" | cut -c1-220 | sed -E 's/(Bearer|api[_-]?key|token)[[:space:]:=]+[^[:space:]"}]+/\1 [redacted]/Ig')"
  if [[ "$curl_exit" -eq 0 && "$http_status" =~ ^2 ]]; then
    result="available"
  elif [[ "$curl_exit" -ne 0 ]]; then
    result="transport_error_${curl_exit}"
  else
    result="unavailable"
  fi

  printf '%s\t%s\t%s\t%s\t%s\n' "$model" "${http_status:-000}" "${latency_seconds:-0}" "$result" "$preview"
  rm -f "$response_file" "$status_file"
done
