"""Shared pagination helpers for list endpoints.

Every list endpoint accepts `limit` / `offset` query params. When `limit` is
provided the query is sliced, and the total row count is always reported via
the `X-Total-Count` response header so clients can compute `has_more`
(offset + len(items) < total) without a shape-breaking envelope.

Endpoints that aggregate (stats, PRs, trends) return computed values and do
not paginate.
"""

from typing import Optional

from fastapi import Query, Response
from sqlalchemy.orm import Query as SAQuery


def pagination_params(
    limit: Optional[int] = Query(None, ge=1, le=500, description="Max rows to return"),
    offset: int = Query(0, ge=0, description="Rows to skip"),
) -> tuple[Optional[int], int]:
    """Declare the standard `limit`/`offset` query params (dependency-injectable)."""
    return limit, offset


def apply_pagination(query: SAQuery, limit: Optional[int], offset: int, response: Response) -> SAQuery:
    """Slice `query` by limit/offset and stamp the total count on the response.

    The count runs on the un-sliced query so `X-Total-Count` is the true total.
    """
    total = query.count()
    response.headers["X-Total-Count"] = str(total)
    if limit is not None:
        query = query.offset(offset).limit(limit)
    return query
