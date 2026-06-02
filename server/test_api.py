from __future__ import annotations

import json
import tempfile
import threading
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import app


def request(base_url: str, path: str, method: str = "GET", payload=None, token: str = "", admin_password: str = ""):
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if admin_password:
        headers["X-Admin-Password"] = admin_password
    try:
        with urlopen(Request(base_url + path, data=body, headers=headers, method=method), timeout=5) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        return error.code, json.loads(error.read().decode("utf-8"))


def main() -> None:
    with tempfile.TemporaryDirectory() as temporary:
        app.DATABASE = Path(temporary) / "test.sqlite3"
        app.ADMIN_PASSWORD = "admin-secret"
        server = app.ThreadingHTTPServer(("127.0.0.1", 0), app.UgandaHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base_url = f"http://127.0.0.1:{server.server_port}"
        try:
            status, first = request(base_url, "/api/auth/register", "POST", {"username": "alpha", "password": "secret1"})
            assert status == 201 and first["ok"]
            status, second = request(base_url, "/api/auth/register", "POST", {"username": "beta", "password": "secret2"})
            assert status == 201 and second["ok"]
            status, third = request(base_url, "/api/auth/register", "POST", {"username": "gamma", "password": "secret3"})
            assert status == 201 and third["ok"]
            status, invalid = request(base_url, "/api/auth/login", "POST", {"username": "alpha", "password": "wrong-password"})
            assert status == 401 and not invalid["ok"]
            status, _ = request(
                base_url,
                "/api/leaderboard/sync",
                "POST",
                {
                    "displayName": "alpha",
                    "avatarSprite": "hero-skin-wuxia",
                    "avatarColor": "#78c9ff",
                    "rankScore": 1220,
                    "pvpWins": 4,
                    "pvpLosses": 1,
                },
                first["token"],
            )
            assert status == 200
            status, alpha_me = request(base_url, "/api/auth/me", token=first["token"])
            assert status == 200
            assert alpha_me["user"]["displayName"] == "alpha"
            status, _ = request(
                base_url,
                "/api/leaderboard/sync",
                "POST",
                {
                    "displayName": "beta",
                    "avatarSprite": "hero-skin-bunny",
                    "avatarColor": "#e5b8ff",
                    "rankScore": 1480,
                    "pvpWins": 8,
                    "pvpLosses": 2,
                },
                second["token"],
            )
            assert status == 200
            status, leaderboard = request(base_url, "/api/leaderboard", token=first["token"])
            assert status == 200
            assert [entry["username"] for entry in leaderboard["entries"][:3]] == [app.TEST_USERNAME, "beta", "alpha"]
            assert leaderboard["entries"][1]["avatarSprite"] == "hero-skin-bunny"
            assert leaderboard["entries"][2]["self"]
            status, opponents = request(base_url, "/api/pvp/opponents", token=first["token"])
            assert status == 200
            assert opponents["ok"]
            opponent_names = [entry["username"] for entry in opponents["opponents"]]
            assert "beta" in opponent_names
            assert "alpha" not in opponent_names
            assert any(entry["avatarSprite"] == "hero-skin-bunny" for entry in opponents["opponents"])
            assert all(entry["hp"] > 0 and entry["atk"] > 0 and entry["power"] > 0 for entry in opponents["opponents"])
            status, denied = request(base_url, "/api/admin/users")
            assert status == 401 and not denied["ok"]
            status, admin_users = request(base_url, "/api/admin/users", admin_password="admin-secret")
            assert status == 200 and any(entry["username"] == "beta" for entry in admin_users["users"])
            status, updated = request(
                base_url,
                "/api/admin/users/update",
                "POST",
                {
                    "username": "beta",
                    "displayName": "BetaGM",
                    "rankScore": 2222,
                    "pvpWins": 12,
                    "pvpLosses": 3,
                    "avatarSprite": "hero-skin-royal",
                    "avatarColor": "#ffd86b",
                },
                admin_password="admin-secret",
            )
            assert status == 200 and updated["user"]["displayName"] == "BetaGM"
            status, _ = request(base_url, "/api/admin/users/reset-password", "POST", {"username": "beta", "password": "secret-new"}, admin_password="admin-secret")
            assert status == 200
            status, old_login = request(base_url, "/api/auth/login", "POST", {"username": "beta", "password": "secret2"})
            assert status == 401 and not old_login["ok"]
            status, new_login = request(base_url, "/api/auth/login", "POST", {"username": "beta", "password": "secret-new"})
            assert status == 200 and new_login["user"]["displayName"] == "BetaGM"
            status, _ = request(base_url, "/api/admin/users/delete", "POST", {"username": "gamma"}, admin_password="admin-secret")
            assert status == 200
            status, deleted_login = request(base_url, "/api/auth/login", "POST", {"username": "gamma", "password": "secret3"})
            assert status == 401 and not deleted_login["ok"]
            status, tester = request(base_url, "/api/auth/login", "POST", {"username": app.TEST_USERNAME, "password": app.TEST_PASSWORD})
            assert status == 200 and tester["user"]["rankScore"] == 9_999_999
            print("PASS register login rejection sync leaderboard pvp avatars")
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    main()
