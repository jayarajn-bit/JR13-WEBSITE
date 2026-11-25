import functools
import secrets
from flask import g, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash
from models import AdminUser, User


def hash_password(raw_password: str) -> str:
    return generate_password_hash(raw_password, method="scrypt")


def verify_password(raw_password: str, stored_hash: str) -> bool:
    return check_password_hash(stored_hash, raw_password)


def ensure_csrf_token() -> str:
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_urlsafe(32)
    return session["csrf_token"]


def require_csrf(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            header_token = request.headers.get("X-CSRF-Token", "")
            session_token = session.get("csrf_token", "")
            if not session_token or not secrets.compare_digest(header_token, session_token):
                return jsonify({"error": "Invalid or missing CSRF token"}), 403
        return fn(*args, **kwargs)

    return wrapper


def require_auth(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({"error": "Authentication required"}), 401
        user = User.query.get(user_id)
        if not user or user.account_status != "ACTIVE":
            return jsonify({"error": "Active user account required"}), 403
        g.current_user = user
        return fn(*args, **kwargs)

    return wrapper


def require_admin(allowed_roles=("COMPLIANCE_ADMIN", "RECONCILIATION_OFFICER", "SUPER_ADMIN")):
    def decorator(fn):
        @functools.wraps(fn)
        @require_auth
        def wrapper(*args, **kwargs):
            admin_rec = AdminUser.query.filter_by(uid=g.current_user.id, active=True).first()
            if not admin_rec or admin_rec.role not in allowed_roles:
                return jsonify({"error": "Admin role authorization required"}), 403
            g.admin_role = admin_rec.role
            return fn(*args, **kwargs)

        return wrapper

    return decorator
