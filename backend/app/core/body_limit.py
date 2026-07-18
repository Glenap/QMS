"""body_limit.py — reject oversized request bodies before they are buffered.

``MAX_UPLOAD_BYTES`` is enforced in the document/report services, but only after
the whole body has been parsed and read into memory. The public token routers
(``/external/lab-report``, ``/external/mix-design``) accept multipart uploads
with **no authentication** — the token is validated inside the service, i.e.
after the read. That makes an unauthenticated request able to push an arbitrary
amount of data through the parser before anything rejects it, which on a small
hosted instance is enough to exhaust memory or disk.

This middleware refuses the request up front, on the declared Content-Length,
so an oversized body never reaches the route. A body that lies about (or omits)
its length is still bounded by the service-level check afterwards.
"""

from starlette.datastructures import Headers
from starlette.responses import PlainTextResponse
from starlette.types import ASGIApp, Receive, Scope, Send

# Multipart adds boundary/header overhead around the file itself, so the wire
# body is allowed to exceed the file cap by a small margin.
_MULTIPART_OVERHEAD_BYTES = 1024 * 1024  # 1 MB


class BodySizeLimitMiddleware:
    """Rejects a request whose declared Content-Length exceeds the limit."""

    def __init__(self, app: ASGIApp, *, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes + _MULTIPART_OVERHEAD_BYTES

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        raw_length = Headers(scope=scope).get("content-length")
        if raw_length is not None:
            try:
                declared = int(raw_length)
            except ValueError:
                declared = None
            if declared is not None and declared > self.max_bytes:
                response = PlainTextResponse(
                    "Request body too large.", status_code=413
                )
                await response(scope, receive, send)
                return

        await self.app(scope, receive, send)
