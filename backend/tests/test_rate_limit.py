from starlette.requests import Request

from app.core.rate_limit import get_client_ip


def make_request(client_host: str, headers: dict[str, str] | None = None) -> Request:
    raw_headers = [
        (name.lower().encode("latin-1"), value.encode("latin-1"))
        for name, value in (headers or {}).items()
    ]
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/auth/login",
        "headers": raw_headers,
        "client": (client_host, 12345),
        "server": ("testserver", 80),
        "scheme": "http",
        "query_string": b"",
    }
    return Request(scope)


def test_client_ip_uses_cloudflare_header_from_trusted_proxy():
    request = make_request(
        "172.18.0.5",
        {
            "CF-Connecting-IP": "203.0.113.44",
            "X-Forwarded-For": "198.51.100.10, 172.18.0.5",
        },
    )

    assert get_client_ip(request) == "203.0.113.44"


def test_client_ip_uses_first_forwarded_for_from_trusted_proxy():
    request = make_request(
        "172.18.0.5",
        {"X-Forwarded-For": "198.51.100.10, 172.18.0.5"},
    )

    assert get_client_ip(request) == "198.51.100.10"


def test_client_ip_ignores_forwarded_headers_from_untrusted_remote():
    request = make_request(
        "8.8.8.8",
        {"X-Forwarded-For": "198.51.100.10"},
    )

    assert get_client_ip(request) == "8.8.8.8"
