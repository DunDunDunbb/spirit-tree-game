from __future__ import annotations

import json
import tempfile
import threading
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import app


def request(base_url: str, path: str, method: str = "GET", payload=None, token: str = ""):
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        with urlopen(Request(base_url + path, data=body, headers=headers, method=method), timeout=5) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        return error.code, json.loads(error.read().decode("utf-8"))


def main() -> None:
    with tempfile.TemporaryDirectory() as temporary:
        app.DATABASE = Path(temporary) / "test.sqlite3"
        server = app.ThreadingHTTPServer(("127.0.0.1", 0), app.UgandaHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base_url = f"http://127.0.0.1:{server.server_port}"
        try:
            status, first = request(base_url, "/api/auth/register", "POST", {"username": "alpha", "password": "secret1"})
            assert status == 201 and first["ok"]
            status, second = request(base_url, "/api/auth/register", "POST", {"username": "beta", "password": "secret2"})
            assert status == 201 and second["ok"]
            status, invalid = request(base_url, "/api/auth/login", "POST", {"username": "alpha", "password": "wrong-password"})
            assert status == 401 and not invalid["ok"]
            status, _ = request(base_url, "/api/leaderboard/sync", "POST", {"displayName": "甲", "rankScore": 1220, "pvpWins": 4, "pvpLosses": 1}, first["token"])
            assert status == 200
            status, _ = request(base_url, "/api/leaderboard/sync", "POST", {"displayName": "乙", "rankScore": 1480, "pvpWins": 8, "pvpLosses": 2}, second["token"])
            assert status == 200
            status, leaderboard = request(base_url, "/api/leaderboard", token=first["token"])
            assert status == 200
            assert [entry["name"] for entry in leaderboard["entries"]] == ["满级测试员", "乙", "甲"]
            assert leaderboard["entries"][2]["self"]
            status, tester = request(base_url, "/api/auth/login", "POST", {"username": app.TEST_USERNAME, "password": app.TEST_PASSWORD})
            assert status == 200 and tester["user"]["rankScore"] == 9_999_999
            print("PASS register login rejection sync leaderboard")
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    main()
