#!/usr/bin/env bash
set -euo pipefail

CERTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/certs"
CERT_FILE="${CERTS_DIR}/localhost-cert.pem"
KEY_FILE="${CERTS_DIR}/localhost-key.pem"

mkdir -p "${CERTS_DIR}"

if [[ -f "${CERT_FILE}" && -f "${KEY_FILE}" ]]; then
  echo "Certificados SSL locales ya existen en ${CERTS_DIR}"
  exit 0
fi

openssl req \
  -x509 \
  -nodes \
  -newkey rsa:2048 \
  -sha256 \
  -days 825 \
  -keyout "${KEY_FILE}" \
  -out "${CERT_FILE}" \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1"

echo "Certificado SSL local generado:"
echo "- Cert: ${CERT_FILE}"
echo "- Key:  ${KEY_FILE}"
