import flask
import os

app = flask.Flask(__name__)

FILE_PATH = 'data/files/'


def check_path(path):
    path = os.path.normpath(os.path.join(FILE_PATH, path))

    if not path.startswith(FILE_PATH):
        return flask.abort(400)

    return path


def get_tmp_path(path):
    dirpath, basename = os.path.split(path)
    basename = f".{basename}.tmp"
    return os.path.join(dirpath, basename)


def make_dir(path):
    try:
        os.makedirs(os.path.dirname(path))
    except Exception:
        pass


@app.route("/files/<path:path>", methods=['PUT'])
def file_put(path):
    path = check_path(path)
    request_range = flask.request.headers.get('range')
    start, end = map(int, request_range.split('-', 1))
    body = flask.request.data
    assert len(body) == end - start + 1

    tmp_path = get_tmp_path(path)

    if start == 0 and os.path.exists(tmp_path):
        print(f"first data of {path}")
        os.unlink(tmp_path)

    make_dir(tmp_path)
    with open(tmp_path, "a+b") as fh:
        fh.seek(start, os.SEEK_SET)
        fh.write(body)

    print(f"write {path} {len(body)}B from {start}")

    return ""


@app.route("/files/<path:path>", methods=['POST'])
def file_post(path):
    path = check_path(path)
    args = flask.request.json

    # commit file?
    if args['action'] == 'finish':
        tmp_path = get_tmp_path(path)
        make_dir(path)
        os.rename(tmp_path, path)
        print(f"commit {path}")
        ret = {"status": "ok"}

    else:
        return flask.abort(400)

    return flask.jsonify(ret)
