import flask

app = flask.Flask(__name__)


@app.route("/files/<path:path>", methods=['PUT'])
def file_put(path):
    request_range = flask.request.headers.get('range')
    body = flask.request.data
    print(f"PUT {path} {request_range} {body}")
    return ""
