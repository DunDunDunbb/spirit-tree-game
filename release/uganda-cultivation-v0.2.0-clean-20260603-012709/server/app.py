from __future__ import annotations

import hashlib
import hmac
import json
import mimetypes
import os
import secrets
import sqlite3
import sys
from contextlib import closing
from datetime import UTC, datetime, timedelta
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
WEB_ROOT = ROOT / "web-dist"
DATA_DIR = ROOT / "tmp" / "server-data"
DATABASE = DATA_DIR / "uganda.sqlite3"
PID_FILE = ROOT / "tmp" / "dev-server.pid"
TOKEN_DAYS = 30
TEST_USERNAME = "tester_max"
TEST_PASSWORD = "UgandaTest888"
ADMIN_PASSWORD = os.environ.get("UGANDA_ADMIN_PASSWORD", "")


def utc_now() -> datetime:
    return datetime.now(UTC)


def iso_time(value: datetime) -> str:
    return value.isoformat(timespec="seconds")


def open_database() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password_salt TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          display_name TEXT NOT NULL,
          avatar_sprite TEXT NOT NULL DEFAULT 'hero-main-character',
          avatar_color TEXT NOT NULL DEFAULT '#f1bf62',
          rank_score INTEGER NOT NULL DEFAULT 1000,
          pvp_wins INTEGER NOT NULL DEFAULT 0,
          pvp_losses INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS leaderboard_score ON users(rank_score DESC, updated_at ASC);
        """
    )
    ensure_user_columns(connection)
    ensure_test_account(connection)
    return connection


def ensure_user_columns(connection: sqlite3.Connection) -> None:
    columns = {row["name"] for row in connection.execute("PRAGMA table_info(users)").fetchall()}
    if "avatar_sprite" not in columns:
        connection.execute("ALTER TABLE users ADD COLUMN avatar_sprite TEXT NOT NULL DEFAULT 'hero-main-character'")
    if "avatar_color" not in columns:
        connection.execute("ALTER TABLE users ADD COLUMN avatar_color TEXT NOT NULL DEFAULT '#f1bf62'")
    connection.commit()


def ensure_test_account(connection: sqlite3.Connection) -> None:
    existing = connection.execute("SELECT id FROM users WHERE username = ?", (TEST_USERNAME,)).fetchone()
    if existing:
        return
    now = iso_time(utc_now())
    salt = secrets.token_hex(16)
    connection.execute(
        """
        INSERT INTO users(username, password_salt, password_hash, display_name, rank_score, pvp_wins, pvp_losses, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (TEST_USERNAME, salt, hash_password(TEST_PASSWORD, salt), "满级测试员", 9_999_999, 9999, 0, now, now),
    )
    connection.commit()


def normalize_username(value: object) -> str:
    username = str(value or "").strip()
    if not 3 <= len(username) <= 16:
        raise ValueError("账号长度需要为 3 到 16 个字符")
    if not all(character.isalnum() or character in "_-" for character in username):
        raise ValueError("账号只能包含字母、数字、下划线和短横线")
    return username


def validate_password(value: object) -> str:
    password = str(value or "")
    if not 6 <= len(password) <= 72:
        raise ValueError("密码长度需要为 6 到 72 个字符")
    return password


def hash_password(password: str, salt_hex: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), 210_000).hex()


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def public_user(row: sqlite3.Row) -> dict[str, object]:
    return {
        "username": row["username"],
        "displayName": row["display_name"],
        "avatarSprite": row["avatar_sprite"],
        "avatarColor": row["avatar_color"],
        "rankScore": row["rank_score"],
        "pvpWins": row["pvp_wins"],
        "pvpLosses": row["pvp_losses"],
    }


def admin_user(row: sqlite3.Row) -> dict[str, object]:
    return {
        **public_user(row),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def normalize_display_name(value: object, fallback: str = "") -> str:
    display_name = str(value or "").strip()[:8]
    return display_name or fallback


def clamp_int(value: object, minimum: int, maximum: int, fallback: int) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        number = fallback
    return max(minimum, min(maximum, number))


def normalize_avatar_sprite(value: object) -> str:
    sprite = str(value or "hero-main-character").strip()
    allowed = {
        "hero-main-character",
        "hero-skin-streetwear",
        "hero-skin-wuxia",
        "hero-skin-royal",
        "hero-skin-bunny",
        "hero-skin-nurse",
        "hero-skin-bocchi-shirt",
    }
    return sprite if sprite in allowed else "hero-main-character"


def normalize_avatar_color(value: object) -> str:
    color = str(value or "#f1bf62").strip()
    if len(color) == 7 and color.startswith("#") and all(character in "0123456789abcdefABCDEF" for character in color[1:]):
        return color
    return "#f1bf62"


def pvp_realm(score: int) -> str:
    if score >= 2600:
        return "筑基后期"
    if score >= 2100:
        return "筑基中期"
    if score >= 1600:
        return "筑基初期"
    if score >= 1200:
        return "炼气九层"
    return "炼气七层"


def pvp_opponent(row: sqlite3.Row, index: int) -> dict[str, object]:
    score = max(800, min(50_000, int(row["rank_score"])))
    wins = max(0, int(row["pvp_wins"]))
    losses = max(0, int(row["pvp_losses"]))
    power = max(900, min(50_000, score + wins * 35 - losses * 18))
    return {
        "username": row["username"],
        "name": row["display_name"],
        "avatarSprite": row["avatar_sprite"],
        "avatarColor": row["avatar_color"],
        "realm": pvp_realm(score),
        "power": power,
        "wins": wins,
        "losses": losses,
        "hp": max(320, min(5000, 260 + power // 4)),
        "atk": max(36, min(420, 28 + power // 90)),
        "spd": max(110, min(220, 118 + wins * 2 - losses)),
        "type": "brute" if index % 3 == 1 else "wisp" if index % 3 == 2 else "imp",
        "quote": f"{row['display_name']} 前来演武切磋。",
    }


class UgandaHandler(SimpleHTTPRequestHandler):
    server_version = "UgandaCultivation/0.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def log_message(self, format_string: str, *args: object) -> None:
        sys.stdout.write(f"[{self.log_date_time_string()}] {format_string % args}\n")
        sys.stdout.flush()

    def send_json(self, status: HTTPStatus, payload: dict[str, object]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict[str, object]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > 32_768:
            raise ValueError("请求内容无效")
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def bearer_token(self) -> str:
        authorization = self.headers.get("Authorization", "")
        if not authorization.startswith("Bearer "):
            raise PermissionError("请先登录")
        return authorization[7:].strip()

    def require_admin(self) -> None:
        if not ADMIN_PASSWORD:
            raise PermissionError("后台未启用：请先设置 UGANDA_ADMIN_PASSWORD")
        password = self.headers.get("X-Admin-Password", "")
        if not hmac.compare_digest(password, ADMIN_PASSWORD):
            raise PermissionError("后台密码错误")

    def current_user(self, connection: sqlite3.Connection) -> sqlite3.Row:
        token = self.bearer_token()
        now = iso_time(utc_now())
        row = connection.execute(
            """
            SELECT users.*
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token_hash = ? AND sessions.expires_at > ?
            """,
            (hash_token(token), now),
        ).fetchone()
        if not row:
            raise PermissionError("登录已过期，请重新登录")
        return row

    def create_session(self, connection: sqlite3.Connection, user_id: int) -> str:
        token = secrets.token_urlsafe(36)
        now = utc_now()
        connection.execute("DELETE FROM sessions WHERE expires_at <= ?", (iso_time(now),))
        connection.execute(
            "INSERT INTO sessions(token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (hash_token(token), user_id, iso_time(now + timedelta(days=TOKEN_DAYS)), iso_time(now)),
        )
        connection.commit()
        return token

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if not path.startswith("/api/"):
            return super().do_GET()
        try:
            with closing(open_database()) as connection:
                if path == "/api/health":
                    return self.send_json(HTTPStatus.OK, {"ok": True})
                if path == "/api/admin/users":
                    self.require_admin()
                    rows = connection.execute(
                        """
                        SELECT username, display_name, avatar_sprite, avatar_color, rank_score, pvp_wins, pvp_losses, created_at, updated_at
                        FROM users
                        ORDER BY updated_at DESC, username ASC
                        LIMIT 200
                        """
                    ).fetchall()
                    return self.send_json(HTTPStatus.OK, {"ok": True, "users": [admin_user(row) for row in rows]})
                if path == "/api/auth/me":
                    user = self.current_user(connection)
                    return self.send_json(HTTPStatus.OK, {"ok": True, "user": public_user(user)})
                if path == "/api/leaderboard":
                    current = self.current_user(connection)
                    rows = connection.execute(
                        """
                        SELECT username, display_name, avatar_sprite, avatar_color, rank_score, pvp_wins, pvp_losses
                        FROM users
                        ORDER BY rank_score DESC, updated_at ASC
                        LIMIT 50
                        """
                    ).fetchall()
                    entries = [
                        {
                            "username": row["username"],
                            "name": row["display_name"],
                            "avatarSprite": row["avatar_sprite"],
                            "avatarColor": row["avatar_color"],
                            "score": row["rank_score"],
                            "wins": row["pvp_wins"],
                            "losses": row["pvp_losses"],
                            "self": row["username"] == current["username"],
                        }
                        for row in rows
                    ]
                    return self.send_json(HTTPStatus.OK, {"ok": True, "entries": entries})
                if path == "/api/pvp/opponents":
                    current = self.current_user(connection)
                    rows = connection.execute(
                        """
                        SELECT username, display_name, avatar_sprite, avatar_color, rank_score, pvp_wins, pvp_losses
                        FROM users
                        WHERE id != ?
                        ORDER BY updated_at DESC, rank_score DESC
                        LIMIT 4
                        """,
                        (current["id"],),
                    ).fetchall()
                    opponents = [pvp_opponent(row, index) for index, row in enumerate(rows)]
                    return self.send_json(HTTPStatus.OK, {"ok": True, "opponents": opponents})
                self.send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "接口不存在"})
        except PermissionError as error:
            self.send_json(HTTPStatus.UNAUTHORIZED, {"ok": False, "error": str(error)})
        except Exception as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(error)})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        try:
            payload = self.read_json()
            with closing(open_database()) as connection:
                if path == "/api/admin/users/update":
                    self.require_admin()
                    username = normalize_username(payload.get("username"))
                    user = connection.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
                    if not user:
                        return self.send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "玩家不存在"})
                    display_name = normalize_display_name(payload.get("displayName"), user["display_name"])
                    avatar_sprite = normalize_avatar_sprite(payload.get("avatarSprite", user["avatar_sprite"]))
                    avatar_color = normalize_avatar_color(payload.get("avatarColor", user["avatar_color"]))
                    score = clamp_int(payload.get("rankScore"), 0, 10_000_000, int(user["rank_score"]))
                    wins = clamp_int(payload.get("pvpWins"), 0, 1_000_000, int(user["pvp_wins"]))
                    losses = clamp_int(payload.get("pvpLosses"), 0, 1_000_000, int(user["pvp_losses"]))
                    connection.execute(
                        """
                        UPDATE users
                        SET display_name = ?, avatar_sprite = ?, avatar_color = ?, rank_score = ?, pvp_wins = ?, pvp_losses = ?, updated_at = ?
                        WHERE username = ?
                        """,
                        (display_name, avatar_sprite, avatar_color, score, wins, losses, iso_time(utc_now()), username),
                    )
                    connection.commit()
                    updated = connection.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
                    return self.send_json(HTTPStatus.OK, {"ok": True, "user": admin_user(updated)})
                if path == "/api/admin/users/reset-password":
                    self.require_admin()
                    username = normalize_username(payload.get("username"))
                    password = validate_password(payload.get("password"))
                    user = connection.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
                    if not user:
                        return self.send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "玩家不存在"})
                    salt = secrets.token_hex(16)
                    connection.execute(
                        "UPDATE users SET password_salt = ?, password_hash = ?, updated_at = ? WHERE username = ?",
                        (salt, hash_password(password, salt), iso_time(utc_now()), username),
                    )
                    connection.execute("DELETE FROM sessions WHERE user_id = ?", (user["id"],))
                    connection.commit()
                    return self.send_json(HTTPStatus.OK, {"ok": True})
                if path == "/api/admin/users/delete":
                    self.require_admin()
                    username = normalize_username(payload.get("username"))
                    if username == TEST_USERNAME:
                        return self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "测试账号不能删除"})
                    cursor = connection.execute("DELETE FROM users WHERE username = ?", (username,))
                    connection.commit()
                    if cursor.rowcount <= 0:
                        return self.send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "玩家不存在"})
                    return self.send_json(HTTPStatus.OK, {"ok": True})
                if path == "/api/auth/register":
                    username = normalize_username(payload.get("username"))
                    password = validate_password(payload.get("password"))
                    now = iso_time(utc_now())
                    salt = secrets.token_hex(16)
                    try:
                        cursor = connection.execute(
                            """
                            INSERT INTO users(username, password_salt, password_hash, display_name, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?)
                            """,
                            (username, salt, hash_password(password, salt), username, now, now),
                        )
                        connection.commit()
                    except sqlite3.IntegrityError:
                        return self.send_json(HTTPStatus.CONFLICT, {"ok": False, "error": "账号已存在"})
                    token = self.create_session(connection, cursor.lastrowid)
                    user = connection.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
                    return self.send_json(HTTPStatus.CREATED, {"ok": True, "token": token, "user": public_user(user)})
                if path == "/api/auth/login":
                    username = normalize_username(payload.get("username"))
                    password = validate_password(payload.get("password"))
                    user = connection.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
                    if not user or not hmac.compare_digest(hash_password(password, user["password_salt"]), user["password_hash"]):
                        return self.send_json(HTTPStatus.UNAUTHORIZED, {"ok": False, "error": "账号或密码错误"})
                    token = self.create_session(connection, user["id"])
                    return self.send_json(HTTPStatus.OK, {"ok": True, "token": token, "user": public_user(user)})
                if path == "/api/leaderboard/sync":
                    user = self.current_user(connection)
                    score_limit = 10_000_000 if user["username"] == TEST_USERNAME else 100_000
                    score = max(0, min(score_limit, int(payload.get("rankScore", user["rank_score"]))))
                    wins = max(0, min(1_000_000, int(payload.get("pvpWins", user["pvp_wins"]))))
                    losses = max(0, min(1_000_000, int(payload.get("pvpLosses", user["pvp_losses"]))))
                    display_name = str(payload.get("displayName") or user["display_name"]).strip()[:8] or user["display_name"]
                    avatar_sprite = normalize_avatar_sprite(payload.get("avatarSprite"))
                    avatar_color = normalize_avatar_color(payload.get("avatarColor"))
                    connection.execute(
                        """
                        UPDATE users
                        SET display_name = ?, avatar_sprite = ?, avatar_color = ?, rank_score = ?, pvp_wins = ?, pvp_losses = ?, updated_at = ?
                        WHERE id = ?
                        """,
                        (display_name, avatar_sprite, avatar_color, score, wins, losses, iso_time(utc_now()), user["id"]),
                    )
                    connection.commit()
                    return self.send_json(HTTPStatus.OK, {"ok": True})
                if path == "/api/auth/logout":
                    connection.execute("DELETE FROM sessions WHERE token_hash = ?", (hash_token(self.bearer_token()),))
                    connection.commit()
                    return self.send_json(HTTPStatus.OK, {"ok": True})
                self.send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "接口不存在"})
        except PermissionError as error:
            self.send_json(HTTPStatus.UNAUTHORIZED, {"ok": False, "error": str(error)})
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(error)})
        except Exception as error:
            self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": str(error)})


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
    global WEB_ROOT
    WEB_ROOT = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else WEB_ROOT
    if not WEB_ROOT.exists():
        raise SystemExit(f"Web directory is missing: {WEB_ROOT}")
    server = ThreadingHTTPServer(("0.0.0.0", port), UgandaHandler)
    PID_FILE.parent.mkdir(parents=True, exist_ok=True)
    PID_FILE.write_text(str(os.getpid()), encoding="ascii")
    print(f"Uganda Cultivation server listening on http://127.0.0.1:{port}/", flush=True)
    try:
        server.serve_forever()
    finally:
        PID_FILE.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
