import flask
import time

app = flask.Flask(__name__)


@app.route("/files/<path:path>", methods=['PUT'])
def file_put(path):
    request_range = flask.request.headers.get('range')
    body = flask.request.data
    body_kb = len(body) / 1024.0
    print(f"PUT {path} {request_range} {body_kb}")
    time.sleep(1)
    return ""
