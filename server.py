"""
机械选型 App Flask 服务端
运行: python server.py
访问: http://localhost:5001
"""
import os
from flask import Flask, send_from_directory, send_file, make_response

APP_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0


@app.route('/')
def index():
    """主页 - 使用 index.html + 外部 app.js"""
    return send_file(
        os.path.join(APP_DIR, 'index.html'),
        mimetype='text/html'
    )


@app.route('/style.css')
def style_css():
    return send_file(os.path.join(APP_DIR, 'style.css'), mimetype='text/css')


@app.route('/app.js')
def app_js():
    response = make_response(send_file(os.path.join(APP_DIR, 'app.js'), mimetype='application/javascript'))
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


@app.route('/data.js')
def data_js():
    response = make_response(send_file(os.path.join(APP_DIR, 'data.js'), mimetype='application/javascript'))
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


@app.route('/app.bundled.js')
def app_bundled_js():
    response = make_response(send_file(os.path.join(APP_DIR, 'app.bundled.js'), mimetype='application/javascript'))
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


@app.route('/crane_images/<path:filename>')
def crane_images(filename):
    return send_from_directory(os.path.join(APP_DIR, 'crane_images'), filename)


if __name__ == '__main__':
    print('=' * 50)
    print('  吊机选型 App')
    print('  http://localhost:5001')
    print('  Ctrl+C 停止')
    print('=' * 50)
    app.run(host='0.0.0.0', port=5001, debug=False)
